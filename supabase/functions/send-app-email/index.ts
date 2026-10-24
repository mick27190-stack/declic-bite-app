import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendAndLog } from '../_shared/sendAndLog.ts'

// Invoice and delivery-time emails triggered from the app.
// Admins may send these templates; a customer may only receive their own
// invoice, at the email address of their own profile.
const ALLOWED_TEMPLATES = new Set(['invoice', 'delivery-estimate'])
const ADMIN_ROLES = new Set([
  'super_admin',
  'secondary_super_admin',
  'site_admin_conches',
  'site_admin_beaumont',
  'secondary_admin_conches',
  'secondary_admin_beaumont',
])

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return json({ error: 'Unauthorized' }, 401)
  const jwt = authHeader.slice('bearer '.length).trim()

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return json({ error: 'Server configuration error' }, 500)

  const { data: claimsData, error: claimsError } = await createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.getClaims(jwt)
  const callerId = claimsData?.claims?.sub as string | undefined
  if (claimsError || !callerId) return json({ error: 'Unauthorized' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON in request body' }, 400) }
  const templateName = String(body.templateName ?? body.template_name ?? '')
  const recipientEmail = String(body.recipientEmail ?? body.recipient_email ?? '').trim()
  const templateData = body.templateData && typeof body.templateData === 'object'
    ? body.templateData as Record<string, unknown> : {}
  const idempotencyKey = String(body.idempotencyKey ?? body.idempotency_key ?? crypto.randomUUID()).slice(0, 200)

  if (!ALLOWED_TEMPLATES.has(templateName)) return json({ error: 'Template not allowed' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return json({ error: 'recipientEmail is required' }, 400)

  const admin = createClient(url, serviceKey)
  const { data: roles, error: rolesError } = await admin.from('user_roles').select('role').eq('user_id', callerId)
  if (rolesError) return json({ error: 'Authorization check failed' }, 500)
  const isAdmin = (roles ?? []).some((r: { role: string }) => ADMIN_ROLES.has(r.role))
  if (!isAdmin) {
    let allowed = false
    if (templateName === 'invoice') {
      const { data: prof } = await admin.from('profiles').select('email').eq('user_id', callerId).maybeSingle()
      allowed = (prof?.email ?? '').trim().toLowerCase() === recipientEmail.toLowerCase()
    }
    if (!allowed) return json({ error: 'Forbidden' }, 403)
  }

  const r = await sendAndLog(admin, templateName, recipientEmail, templateData, idempotencyKey)
  if (r.outcome === 'suppressed') return json({ success: false, reason: 'email_suppressed' })
  if (r.outcome === 'failed') return json({ error: 'Failed to send email' }, 500)
  return json({ success: true })
})
