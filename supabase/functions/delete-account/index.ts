import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = 'Declic-Pizza-app'
const SENDER_DOMAIN = 'notify.declicpizza.fr'
const FROM_DOMAIN = 'notify.declicpizza.fr'
const TEMPLATE_NAME = 'account-deleted'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Deletes the AUTHENTICATED caller's own account and queues a confirmation
// email to their on-file address. Recipient/user id come from the verified
// JWT — never from the request body — so a user cannot delete anyone else.
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

  // Resolve recipient info server-side.
  let recipientEmail: string | null = claimEmail ?? null
  let customerName: string | undefined
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('user_id', callerId)
    .maybeSingle()
  if (profile) {
    if (!recipientEmail && profile.email) recipientEmail = profile.email as string
    const full = `${(profile.first_name as string | null) ?? ''} ${(profile.last_name as string | null) ?? ''}`.trim()
    if (full) customerName = full
  }
  if (!recipientEmail) {
    const { data: authUser } = await supabase.auth.admin.getUserById(callerId)
    recipientEmail = authUser?.user?.email ?? null
  }

  // Try to enqueue the confirmation email BEFORE deletion, but never block
  // deletion on email issues (bounce, suppression, missing address, etc.).
  if (recipientEmail) {
    try {
      const template = TEMPLATES[TEMPLATE_NAME]
      const nowParis = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(new Date())
      const deletedAt = `${nowParis} (heure de Paris)`
      const templateData = { customerName, deletedAt }
      const messageId = crypto.randomUUID()
      const idempotencyKey = `account-deleted:${callerId}:${Math.floor(Date.now() / 1000)}`
      const normalizedEmail = recipientEmail.toLowerCase()

      const { data: suppressed } = await supabase
        .from('suppressed_emails')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (!suppressed && template) {
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

        await supabase.rpc('enqueue_email', {
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
      }
    } catch (err) {
      console.error('account-deleted email enqueue failed:', err)
    }
  }

  // Resolve site (best-effort) for the RGPD deletion log.
  let deletionSite: string | null = null
  try {
    const { data: cust } = await supabase
      .from('customers')
      .select('site')
      .eq('user_id', callerId)
      .maybeSingle()
    deletionSite = (cust?.site as string | null) ?? null
  } catch (_) { /* non-fatal */ }

  // Anonymize orders / customers / invoices / chat BEFORE deleting the auth user
  // so accounting data is preserved without personal identifiers. If this step
  // fails we abort — better to leave the account intact than to orphan PII.
  const { error: anonError } = await supabase.rpc('anonymize_user_orders', {
    user_id_param: callerId,
  })
  if (anonError) {
    console.error('anonymize_user_orders failed:', anonError.message)
    return new Response(JSON.stringify({ error: 'Failed to anonymize account data' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // RGPD proof-of-deletion log (no identity stored).
  try {
    await supabase.from('account_deletion_log').insert({ site: deletionSite })
  } catch (err) {
    console.error('account_deletion_log insert failed (non-fatal):', err)
  }

  // Delete the auth user. Related PII rows (profiles, addresses, push_tokens)
  // cascade via FK on auth.users.
  const { error: deleteError } = await supabase.auth.admin.deleteUser(callerId)
  if (deleteError) {
    console.error('deleteUser failed:', deleteError)
    return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
