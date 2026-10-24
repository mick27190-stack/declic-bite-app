import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.4.0'
import { sendTemplateEmail } from './transactional-email-templates/send-email.ts'

// deno-lint-ignore no-explicit-any
type Sb = any

export type SendOutcome = 'sent' | 'suppressed' | 'failed'
export type SendResult = { outcome: SendOutcome; error?: string }

const SITE_NAME = 'Déclic Pizza'
const SENDER_DOMAIN = 'notify.declicpizza.fr'
const FROM_DOMAIN = 'notify.declicpizza.fr'

async function log(sb: Sb, row: Record<string, unknown>) {
  const { error } = await sb.from('email_send_log').insert(row)
  if (error) console.error('email_send_log insert failed', { code: error.code, message: error.message })
}

async function run(
  sb: Sb,
  templateName: string,
  to: string,
  metadata: Record<string, unknown> | undefined,
  send: () => Promise<boolean>,
): Promise<SendResult> {
  // Own id per send keeps "latest status per message" reads working.
  const base = {
    message_id: crypto.randomUUID(),
    template_name: templateName,
    recipient_email: to,
    ...(metadata ? { metadata } : {}),
  }
  try {
    if (await send()) {
      await log(sb, { ...base, status: 'sent' })
      return { outcome: 'sent' }
    }
    await log(sb, { ...base, status: 'suppressed' })
    return { outcome: 'suppressed' }
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 1000)
    await log(sb, { ...base, status: 'failed', error_message: msg })
    return { outcome: 'failed', error: msg }
  }
}

/** Sends a registered template and records the outcome in email_send_log. Never throws. */
export function sendAndLog(
  sb: Sb,
  templateName: string,
  to: string,
  templateData: Record<string, unknown>,
  idempotencyKey: string,
  metadata?: Record<string, unknown>,
): Promise<SendResult> {
  return run(sb, templateName, to, metadata, async () =>
    (await sendTemplateEmail(templateName, to, { templateData, idempotencyKey })).sent)
}

/** Sends pre-rendered HTML (account verification emails) and records the outcome. Never throws. */
export function sendRenderedAndLog(
  sb: Sb,
  p: { label: string; to: string; subject: string; html: string; text: string; idempotencyKey: string; metadata?: Record<string, unknown> },
): Promise<SendResult> {
  return run(sb, p.label, p.to, p.metadata, async () => {
    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured')
    try {
      await sendLovableEmail(
        {
          to: p.to,
          from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: p.subject,
          html: p.html,
          text: p.text,
          purpose: 'transactional',
          label: p.label,
          idempotency_key: p.idempotencyKey,
        },
        { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') },
      )
      return true
    } catch (e) {
      if (e instanceof EmailAPIError && e.code === 'recipient_suppressed') return false
      throw e
    }
  })
}
