import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'

const SITE_NAME = 'Déclic Pizza'
const SENDER_DOMAIN = 'notify.declicpizza.fr'
const FROM_DOMAIN = 'notify.declicpizza.fr'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const parseProviderMessage = async (response: Response) => {
  const text = await response.text()
  try {
    const parsed = JSON.parse(text)
    return parsed.msg || parsed.error_description || parsed.message || parsed.error || text
  } catch {
    return text
  }
}

const isAlreadyUsedMessage = (message: string) => {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('already in use') ||
    normalized.includes('already used') ||
    normalized.includes('user already exists') ||
    normalized.includes('email exists')
  )
}

const friendlyProviderMessage = (message: string) => {
  const normalized = message.toLowerCase()
  if (normalized.includes('email rate limit') || normalized.includes('rate limit')) {
    return "Trop de demandes d'email ont été envoyées en peu de temps. Réessayez dans quelques minutes."
  }
  if (isAlreadyUsedMessage(message)) {
    return 'Cette adresse email était déjà utilisée. Réessayez : nous allons la rattacher à votre compte actuel.'
  }
  return message || "Impossible d'envoyer le lien de vérification"
}

const extractActionLinkToken = (actionLink: string) => {
  try {
    const url = new URL(actionLink)
    return url.searchParams.get('token') || url.searchParams.get('token_hash')
  } catch {
    return null
  }
}

const buildAppConfirmationUrl = ({
  actionLink,
  fallbackTokenHash,
  kind,
  redirectTo,
}: {
  actionLink: string
  fallbackTokenHash?: string | null
  kind: 'signup' | 'email_change'
  redirectTo?: string
}) => {
  const redirectUrl = redirectTo || 'https://declicpizza.fr/auth/confirm'

  // Important: for `email_change_new`, GoTrue has returned an invalid
  // `properties.hashed_token` in some versions. The action link contains the
  // token actually stored for verification, so prefer that token and only use
  // `hashed_token` as a signup fallback.
  const tokenHash = extractActionLinkToken(actionLink) || (kind === 'signup' ? fallbackTokenHash : null)
  if (!tokenHash) {
    return actionLink
  }

  const confirmationType = kind === 'email_change' ? 'email_change' : 'signup'
  return `${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}token_hash=${encodeURIComponent(
    tokenHash,
  )}&type=${confirmationType}`
}

// Resend the email verification link for the authenticated caller.
// Handles the edge case where the target email is already registered on
// another auth account created before the current verification flow existed:
// the blocking account is anonymized for accounting history, deleted from auth,
// then the email is attached to the authenticated caller.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const jwt = authHeader.slice('bearer '.length).trim()

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Server configuration error' }, 500)
  }

  let body: { email?: string; redirectTo?: string } = {}
  try {
    body = await req.json()
  } catch {
    // ignore
  }
  const targetEmail = (body.email ?? '').trim().toLowerCase()
  const redirectTo = body.redirectTo || undefined
  if (!targetEmail) {
    return json({ error: 'Email requis' }, 400)
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(jwt)
  const callerId = claimsData?.claims?.sub as string | undefined
  if (claimsError || !callerId) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: caller, error: callerError } = await admin.auth.admin.getUserById(callerId)
  if (callerError || !caller?.user) {
    return json({ error: 'Utilisateur introuvable' }, 401)
  }

  const syncProfileEmail = async () => {
    try {
      await admin.from('profiles').update({ email: targetEmail }).eq('user_id', callerId)
    } catch (e) {
      console.error('profile email sync failed:', (e as Error).message)
    }
  }

  const enqueueManualVerificationEmail = async (kind: 'signup' | 'email_change') => {
    const currentEmailForLink = (caller.user.email ?? targetEmail).toLowerCase()
    const linkParams =
      kind === 'email_change'
        ? {
            type: 'email_change_new' as const,
            email: currentEmailForLink,
            newEmail: targetEmail,
            options: redirectTo ? { redirectTo } : undefined,
          }
        : {
            type: 'signup' as const,
            email: targetEmail,
            options: redirectTo ? { redirectTo } : undefined,
          }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink(linkParams)
    if (linkError || !linkData?.properties?.action_link) {
      const message = linkError?.message || 'Impossible de générer un nouveau lien de vérification'
      console.error('generateLink failed:', message)
      return { ok: false, message }
    }

    const confirmationUrl = buildAppConfirmationUrl({
      actionLink: linkData.properties.action_link,
      fallbackTokenHash: linkData.properties.hashed_token,
      kind,
      redirectTo,
    })
    const templateProps =
      kind === 'email_change'
        ? {
            siteName: SITE_NAME,
            oldEmail: currentEmailForLink,
            email: targetEmail,
            newEmail: targetEmail,
            confirmationUrl,
          }
        : {
            siteName: SITE_NAME,
            siteUrl: redirectTo ? new URL(redirectTo).origin : 'https://declicpizza.fr',
            recipient: targetEmail,
            confirmationUrl,
          }
    const component = kind === 'email_change' ? EmailChangeEmail : SignupEmail
    const html = await renderAsync(React.createElement(component, templateProps))
    const text = await renderAsync(React.createElement(component, templateProps), { plainText: true })
    const messageId = crypto.randomUUID()
    const templateName = kind === 'email_change' ? 'email_change' : 'signup'

    const normalizedEmail = targetEmail.toLowerCase()
    let unsubscribeToken = generateToken()
    const { data: existingToken } = await admin
      .from('email_unsubscribe_tokens')
      .select('token, used_at')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingToken && !existingToken.used_at) {
      unsubscribeToken = existingToken.token as string
    } else {
      await admin
        .from('email_unsubscribe_tokens')
        .upsert(
          { token: unsubscribeToken, email: normalizedEmail },
          { onConflict: 'email', ignoreDuplicates: true },
        )
      const { data: storedToken } = await admin
        .from('email_unsubscribe_tokens')
        .select('token')
        .eq('email', normalizedEmail)
        .maybeSingle()
      if (storedToken?.token) unsubscribeToken = storedToken.token as string
    }

    await admin.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: targetEmail,
      status: 'pending',
    })

    const { error: enqueueError } = await admin.rpc('enqueue_email', {
      queue_name: 'auth_emails',
      payload: {
        message_id: messageId,
        to: targetEmail,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: kind === 'email_change' ? 'Confirmez votre nouvelle adresse email' : 'Confirmez votre adresse email',
        html,
        text,
        purpose: 'transactional',
        label: templateName,
        idempotency_key: `verify-${callerId}-${targetEmail}-${Date.now()}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    })

    if (enqueueError) {
      console.error('manual verification enqueue failed:', enqueueError.message)
      await admin.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: targetEmail,
        status: 'failed',
        error_message: 'Failed to enqueue manual verification email',
      })
      return { ok: false, message: "Impossible d'envoyer le lien de vérification" }
    }

    console.log('Manual verification email enqueued', { templateName, email: targetEmail })
    return { ok: true, message: null }
  }

  const currentEmail = (caller.user.email ?? '').toLowerCase()
  const pendingEmail = ((caller.user as unknown as { new_email?: string }).new_email ?? '').toLowerCase()
  const alreadyAttached = currentEmail === targetEmail
  const alreadyPending = pendingEmail === targetEmail

  if (alreadyAttached && caller.user.email_confirmed_at) {
    await syncProfileEmail()
    return json({
      ok: true,
      status: 'already_verified',
      message: 'Votre adresse email est déjà vérifiée.',
    })
  }

  if (alreadyAttached || alreadyPending) {
    const manualEmail = await enqueueManualVerificationEmail(alreadyPending ? 'email_change' : 'signup')
    if (!manualEmail.ok) {
      return json({
        ok: false,
        status: 'verification_send_failed',
        message: friendlyProviderMessage(manualEmail.message ?? ''),
      })
    }
    await syncProfileEmail()
    return json({
      ok: true,
      status: 'verification_sent',
      message: 'Email de vérification envoyé. Vérifiez votre boîte de réception.',
    })
  }

  const findBlockingUserId = async () => {
    for (let page = 1; page <= 50; page += 1) {
      const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (listError) throw listError
      const users = list?.users ?? []
      const match = users.find((u) => {
        const email = (u.email ?? '').toLowerCase()
        const pending = ((u as unknown as { new_email?: string }).new_email ?? '').toLowerCase()
        return u.id !== callerId && (email === targetEmail || pending === targetEmail)
      })
      if (match) return match.id
      if (users.length < 200) break
    }
    return null
  }

  const releaseBlockingEmail = async (blockingUserId: string) => {
    // Keep legal/accounting rows, but remove personal data before deleting the
    // old auth identity so the email can be verified on the current account.
    try {
      await admin.rpc('anonymize_user_orders', { user_id_param: blockingUserId })
    } catch (e) {
      console.error('anonymize_user_orders (blocking account) failed:', (e as Error).message)
    }

    try {
      await admin
        .from('profiles')
        .update({
          first_name: 'Client',
          last_name: 'supprimé',
          phone: null,
          email: null,
          preferred_restaurant: null,
        })
        .eq('user_id', blockingUserId)
    } catch (e) {
      console.error('blocking profile anonymization failed:', (e as Error).message)
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(blockingUserId)
    if (deleteError) {
      console.error('deleteUser (blocking account) failed:', deleteError.message)
      return false
    }
    return true
  }

  // Locate any existing auth user with this email or pending email.
  let conflictUserId: string | null = null
  try {
    conflictUserId = await findBlockingUserId()
  } catch (e) {
    console.error('listUsers failed:', (e as Error).message)
  }

  if (conflictUserId) {
    const released = await releaseBlockingEmail(conflictUserId)
    if (!released) {
      return json({ error: "Impossible de libérer l'adresse email. Réessayez plus tard." }, 500)
    }
  }

  // Attach (or re-attach) the email to the caller. This triggers the
  // confirmation email through the standard auth flow.
  // Call GoTrue REST directly with the user JWT so the confirmation email is sent.
  // (SDK's auth.updateUser requires a persisted session which we don't have here.)
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: targetEmail,
      ...(redirectTo ? { email_redirect_to: redirectTo } : {}),
    }),
  })
  if (!resp.ok) {
    const msg = await parseProviderMessage(resp)
    console.error('updateUser (REST) failed:', resp.status, msg)
    if (isAlreadyUsedMessage(msg)) {
      try {
        const blockingUserId = await findBlockingUserId()
        if (blockingUserId && (await releaseBlockingEmail(blockingUserId))) {
          const retry = await fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'PUT',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${jwt}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: targetEmail,
              ...(redirectTo ? { email_redirect_to: redirectTo } : {}),
            }),
          })
          if (retry.ok) {
            await syncProfileEmail()
            return json({
              ok: true,
              status: 'verification_sent',
              message: 'Adresse enregistrée. Email de vérification envoyé, vérifiez votre boîte de réception.',
            })
          }
          const retryMsg = await parseProviderMessage(retry)
          console.error('updateUser retry failed:', retry.status, retryMsg)
          return json({
            ok: false,
            status: 'verification_send_failed',
            message: friendlyProviderMessage(retryMsg),
          })
        }
      } catch (e) {
        console.error('release/retry after already-used failed:', (e as Error).message)
      }

      return json({ error: "Impossible de libérer l'adresse email. Réessayez plus tard." }, 500)
    }
    return json({
      ok: false,
      status: 'verification_send_failed',
      message: friendlyProviderMessage(msg),
    })
  }

  await syncProfileEmail()

  return json({
    ok: true,
    status: 'verification_sent',
    message: 'Email de vérification envoyé. Vérifiez votre boîte de réception.',
  })
})
