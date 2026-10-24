import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { sendAndLog } from '../_shared/sendAndLog.ts'

const TEMPLATE_NAME = 'password-changed'

// Sends the password-changed confirmation email to the AUTHENTICATED caller's
// own email address only. No admin role required — the recipient is always
// derived from the verified JWT, never from the request body, so a user
// cannot use this to email anyone else.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const jwt = authHeader.slice('bearer '.length).trim()

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(jwt)
  const callerId = claimsData?.claims?.sub as string | undefined
  const claimEmail = claimsData?.claims?.email as string | undefined
  if (claimsError || !callerId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Resolve the recipient from server-side data — never trust the client.
  let recipientEmail: string | null = claimEmail ?? null
  let customerName: string | undefined
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('user_id', callerId)
    .maybeSingle()
  if (profile) {
    if (!recipientEmail && profile.email) recipientEmail = profile.email as string
    const fn = (profile.first_name as string | null) ?? ''
    const ln = (profile.last_name as string | null) ?? ''
    const full = `${fn} ${ln}`.trim()
    if (full) customerName = full
  }
  if (!recipientEmail) {
    const { data: authUser } = await supabase.auth.admin.getUserById(callerId)
    recipientEmail = authUser?.user?.email ?? null
  }
  if (!recipientEmail) {
    return new Response(JSON.stringify({ error: 'No email on file' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const template = TEMPLATES[TEMPLATE_NAME]
  if (!template) {
    return new Response(JSON.stringify({ error: 'Template missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Format "changedAt" in Paris time, always computed server-side.
  const nowParis = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date())
  const changedAt = `${nowParis} (heure de Paris)`

  const idempotencyKey = `pwd-changed:${callerId}:${Math.floor(Date.now() / 1000)}`
  const templateData = { customerName, changedAt }
  const r = await sendAndLog(supabase, TEMPLATE_NAME, recipientEmail, templateData, idempotencyKey)
  if (r.outcome === 'suppressed') {
    return new Response(JSON.stringify({ success: false, reason: 'email_suppressed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (r.outcome === 'failed') {
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
