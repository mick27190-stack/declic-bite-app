import { sendTemplateEmail } from './transactional-email-templates/send-email.ts'

// deno-lint-ignore no-explicit-any
type Sb = any

export type SendOutcome = 'sent' | 'suppressed' | 'failed'

async function log(sb: Sb, row: Record<string, unknown>) {
  const { error } = await sb.from('email_send_log').insert(row)
  if (error) console.error('email_send_log insert failed', { code: error.code, message: error.message })
}

/** Sends a registered template and records the outcome in email_send_log. Never throws. */
export async function sendAndLog(
  sb: Sb,
  templateName: string,
  to: string,
  templateData: Record<string, unknown>,
  idempotencyKey: string,
): Promise<{ outcome: SendOutcome; error?: string }> {
  const base = { message_id: null, template_name: templateName, recipient_email: to }
  try {
    const r = await sendTemplateEmail(templateName, to, { templateData, idempotencyKey })
    if (r.sent) {
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
