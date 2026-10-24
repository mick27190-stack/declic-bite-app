import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { legacyRejection, verificationOutcome } from './verificationDeliveryOutcomes.ts';

const event = { timestamp: '2026-10-24T17:00:00Z', recipient: 'TEST@example.invalid', message_id: 'test-message', tags: ['email_change'], event_type: 'rejected' };

Deno.test('rejected validation sends remain failures for Super Admin alerts', () => {
  assertEquals(verificationOutcome(event)?.status, 'failed');
  assertEquals(verificationOutcome(event)?.template_name, 'email_change');
  assertEquals(verificationOutcome(event)?.recipient_email, 'test@example.invalid');
});
Deno.test('signup bounces remain visible validation failures', () => {
  assertEquals(verificationOutcome({ ...event, tags: ['signup'], event_type: 'email.bounced' })?.status, 'bounced');
});
Deno.test('delivery success clears a previous validation failure', () => {
  assertEquals(verificationOutcome({ ...event, event_type: 'delivered' })?.status, 'sent');
});
Deno.test('temporary failures and rate limits do not become terminal rejections', () => {
  assertEquals(verificationOutcome({ ...event, event_type: 'temporary_fail' }), null);
  assertEquals(verificationOutcome({ ...event, event_type: 'rate_limited' }), null);
});
Deno.test('order emails never become validation failure alerts', () => {
  assertEquals(verificationOutcome({ ...event, tags: ['order-confirmed'] }), null);
});
Deno.test('legacy final failures retain identity and failure time', () => {
  const row = { message_id: 'test-message', template_name: 'email_change', recipient_email: 'test@example.invalid', status: 'dlq', created_at: event.timestamp, error_message: 'Expired' };
  assertEquals(legacyRejection(row), { ...row, status: 'failed' });
  assertEquals(legacyRejection({ ...row, status: 'pending' }), null);
});