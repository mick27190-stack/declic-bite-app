export type DeliveryEvent = {
  timestamp: string;
  recipient: string;
  event_type: string;
  status?: string;
  message_id?: string;
  tags?: string[] | null;
};

export function verificationOutcome(event: DeliveryEvent) {
  const template = event.tags?.find((tag) => tag === 'signup' || tag === 'email_change');
  if (!template || !event.recipient || !event.message_id) return null;
  const kind = event.event_type.replace(/^email\./, '');
  const status = kind === 'delivered' || kind === 'sent' ? 'sent'
    : kind === 'bounced' || kind === 'permanent_fail' ? 'bounced'
    : kind === 'rejected' || event.status === 'rejected' ? 'failed' : null;
  if (!status) return null;
  return {
    message_id: event.message_id,
    template_name: template,
    recipient_email: event.recipient.toLowerCase(),
    status,
    created_at: event.timestamp,
    error_message: status === 'sent' ? null : 'Échec de livraison du lien de validation',
  };
}

// Keep the legacy record's message identity and timestamp. This is an outcome
// read, not a callback on retry counts or on moving a queue message.
export function legacyRejection(row: {
  message_id: string | null; template_name: string; recipient_email: string;
  status: string; created_at: string; error_message: string | null;
}) {
  if (!['signup', 'email_change'].includes(row.template_name) || row.status !== 'dlq') return null;
  return { ...row, status: 'failed' };
}