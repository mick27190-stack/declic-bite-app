import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

// Baked-in sender config (same as send-transactional-email).
const SITE_NAME = 'Declic-Pizza-app'
const SENDER_DOMAIN = 'notify.declicpizza.fr'
const FROM_DOMAIN = 'notify.declicpizza.fr'
const TEMPLATE_NAME = 'password-changed'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

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

  const messageId = crypto.randomUUID()
  const idempotencyKey = `pwd-changed:${callerId}:${Math.floor(Date.now() / 1000)}`

  // Suppression check (fail-closed).
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', recipientEmail.toLowerCase())
    .maybeSingle()
  if (suppressionError) {
    return new Response(JSON.stringify({ error: 'Failed to verify suppression' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (suppressed) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: TEMPLATE_NAME,
      recipient_email: recipientEmail,
      status: 'suppressed',
    })
    return new Response(JSON.stringify({ success: false, reason: 'email_suppressed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get or create unsubscribe token.
  const normalizedEmail = recipientEmail.toLowerCase()
  let unsubscribeToken: string
  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()
  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token as string
  } else {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true },
      )
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (stored?.token) unsubscribeToken = stored.token as string
  }

  const templateData = { customerName, changedAt }
  const html = await renderAsync(React.createElement(template.component, templateData))
  const plainText = await renderAsync(
    React.createElement(template.component, templateData),
    { plainText: true },
  )
  const resolvedSubject =
    typeof template.subject === 'function' ? template.subject(templateData) : template.subject

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: TEMPLATE_NAME,
    recipient_email: recipientEmail,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: TEMPLATE_NAME,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })
  if (enqueueError) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: TEMPLATE_NAME,
      recipient_email: recipientEmail,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true, queued: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
