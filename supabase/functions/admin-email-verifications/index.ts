import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'

// Super Admin : liste des e-mails de validation d'adresse en échec et
// renvoi d'un nouveau lien de validation au client concerné.
const SITE_NAME = 'Déclic Pizza'
const SENDER_DOMAIN = 'notify.declicpizza.fr'
const FROM_DOMAIN = 'notify.declicpizza.fr'
const REDIRECT = 'https://declicpizza.fr/auth/confirm'
const FAILED = ['dlq', 'failed', 'bounced']

const json = (p: unknown, status = 200) =>
  new Response(JSON.stringify(p), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// deno-lint-ignore no-explicit-any
type U = any

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^bearer /i, '').trim()
    if (!jwt) return json({ error: 'Unauthorized' }, 401)
    const { data: c } = await createClient(url, anon).auth.getClaims(jwt)
    const callerId = c?.claims?.sub as string | undefined
    if (!callerId) return json({ error: 'Unauthorized' }, 401)
    const { data: isSuper } = await admin.rpc('is_super_admin', { _user_id: callerId })
    if (!isSuper) return json({ error: 'Réservé aux Super Admins' }, 403)

    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? 'list')

    const allUsers: U[] = []
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      allUsers.push(...(data?.users ?? []))
      if ((data?.users ?? []).length < 200) break
    }
    const findUser = (email: string) =>
      allUsers.find((u) => (u.new_email ?? '').toLowerCase() === email) ??
      allUsers.find((u) => (u.email ?? '').toLowerCase() === email)

    if (action === 'list') {
      const { data: rows, error } = await admin
        .from('email_send_log')
        .select('message_id, template_name, recipient_email, status, error_message, created_at')
        .in('template_name', ['email_change', 'signup'])
        .order('created_at', { ascending: false })
        .limit(5000)
      if (error) throw error
      // Dernier statut par message, puis dernier e-mail par destinataire.
      const latestByMsg = new Map<string, U>()
      for (const r of rows ?? []) if (r.message_id && !latestByMsg.has(r.message_id)) latestByMsg.set(r.message_id, r)
      const latestByEmail = new Map<string, U>()
      for (const r of latestByMsg.values()) {
        const e = String(r.recipient_email).toLowerCase()
        const cur = latestByEmail.get(e)
        if (!cur || cur.created_at < r.created_at) latestByEmail.set(e, r)
      }
      const items = [...latestByEmail.entries()]
        .filter(([, r]) => FAILED.includes(r.status))
        .map(([email, r]) => {
          const u = findUser(email)
          const pending = u
            ? (u.new_email ?? '').toLowerCase() === email || ((u.email ?? '').toLowerCase() === email && !u.email_confirmed_at)
            : false
          const verified = !!u && (u.email ?? '').toLowerCase() === email && !!u.email_confirmed_at
          return {
            email, template: r.template_name, status: r.status, error: r.error_message,
            failed_at: r.created_at, user_id: u?.id ?? null, phone: u?.phone ?? null,
            state: verified ? 'verified' : pending ? 'pending' : 'unknown',
          }
        })
        .sort((a, b) => (a.failed_at < b.failed_at ? 1 : -1))
      return json({ items })
    }

    if (action === 'resend') {
      const email = String(body.email ?? '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Adresse invalide' }, 400)
      const u = findUser(email)
      if (!u) return json({ error: 'Aucun compte client ne correspond à cette adresse' }, 404)
      const isChange = (u.new_email ?? '').toLowerCase() === email
      if (!isChange && u.email_confirmed_at) return json({ ok: true, status: 'already_verified', message: 'Adresse déjà validée.' })

      const { data: link, error: linkErr } = await admin.auth.admin.generateLink(
        isChange
          ? { type: 'email_change_new', email: (u.email ?? email).toLowerCase(), newEmail: email, options: { redirectTo: REDIRECT } }
          : { type: 'signup', email, options: { redirectTo: REDIRECT } } as U,
      )
      const action_link = link?.properties?.action_link
      if (linkErr || !action_link) throw new Error(linkErr?.message ?? 'Lien impossible à générer')
      let tokenHash: string | null = null
      try { const p = new URL(action_link).searchParams; tokenHash = p.get('token') || p.get('token_hash') } catch { /* */ }
      if (!tokenHash && !isChange) tokenHash = link.properties.hashed_token ?? null
      const kind = isChange ? 'email_change' : 'signup'
      const confirmationUrl = tokenHash ? `${REDIRECT}?token_hash=${encodeURIComponent(tokenHash)}&type=${kind}` : action_link

      const props = isChange
        ? { siteName: SITE_NAME, oldEmail: u.email, email, newEmail: email, confirmationUrl }
        : { siteName: SITE_NAME, siteUrl: 'https://declicpizza.fr', recipient: email, confirmationUrl }
      const comp = isChange ? EmailChangeEmail : SignupEmail
      const html = await renderAsync(React.createElement(comp as U, props))
      const text = await renderAsync(React.createElement(comp as U, props), { plainText: true })

      let token: string
      const { data: t } = await admin.from('email_unsubscribe_tokens').select('token, used_at').eq('email', email).maybeSingle()
      if (t && !t.used_at) token = t.token
      else {
        const b = new Uint8Array(32); crypto.getRandomValues(b)
        token = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')
        await admin.from('email_unsubscribe_tokens').upsert({ token, email }, { onConflict: 'email', ignoreDuplicates: true })
        const { data: s } = await admin.from('email_unsubscribe_tokens').select('token').eq('email', email).maybeSingle()
        if (s?.token) token = s.token
      }

      const messageId = crypto.randomUUID()
      await admin.from('email_send_log').insert({
        message_id: messageId, template_name: kind, recipient_email: email, status: 'pending',
        metadata: { resent_by_admin: callerId },
      })
      const { error: qErr } = await admin.rpc('enqueue_email', {
        queue_name: 'auth_emails',
        payload: {
          message_id: messageId, to: email, from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`, sender_domain: SENDER_DOMAIN,
          subject: isChange ? 'Confirmez votre nouvelle adresse email' : 'Confirmez votre adresse email',
          html, text, purpose: 'transactional', label: kind,
          idempotency_key: `admin-verify-${u.id}-${email}-${Date.now()}`,
          unsubscribe_token: token, queued_at: new Date().toISOString(),
        },
      })
      if (qErr) {
        await admin.from('email_send_log').insert({
          message_id: messageId, template_name: kind, recipient_email: email, status: 'failed',
          error_message: qErr.message.slice(0, 1000),
        })
        throw new Error("Impossible d'envoyer le lien")
      }
      return json({ ok: true, status: 'sent', message: 'Nouveau lien de validation envoyé.' })
    }

    return json({ error: 'Action inconnue' }, 400)
  } catch (e) {
    console.error('admin-email-verifications:', (e as Error).message)
    return json({ error: (e as Error).message }, 500)
  }
})
