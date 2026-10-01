/// <reference types="npm:@types/react@18.3.1" />
// Déclenchée par le trigger orders (status -> confirmed) via pg_net.
// Ne bloque jamais la confirmation : toute erreur est journalisée.
import * as React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts';
import { formatItems } from '../_shared/orderCancelledEmail.ts';

const SITE_NAME = 'Declic-Pizza-app';
const SENDER_DOMAIN = 'notify.declicpizza.fr';
const FROM_DOMAIN = 'notify.declicpizza.fr';
const TEMPLATE_NAME = 'order-confirmed';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

function claimsRole(token: string): string | null {
  try {
    const p = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
    return JSON.parse(atob(p.padEnd(Math.ceil(p.length / 4) * 4, '='))).role ?? null;
  } catch { return null; }
}

const euros = (n: number) => `${n.toFixed(2).replace('.', ',')}€`;

function parisTime(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  if (/^\d{1,2}[:h]\d{2}$/.test(v.trim())) return v.trim().replace('h', ':');
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(d);
}

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ') || claimsRole(auth.slice(7).trim()) !== 'service_role') {
    return json({ error: 'Forbidden' }, 403);
  }
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let orderId = '';
  let recipientEmail = '';
  try {
    const body = await req.json().catch(() => ({}));
    orderId = String(body.order_id ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'order_id invalide' }, 400);

    // Réservation atomique anti-doublon.
    const { data: order } = await sb
      .from('orders')
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'confirmed')
      .is('confirmation_email_sent_at', null)
      .select('id, user_id, restaurant, order_type, items, total_price, created_at, pickup_time, delivery_estimate, delivery_time_confirmed, delivery_time_proposed')
      .maybeSingle();
    if (!order) return json({ skipped: 'already_sent_or_not_confirmed' });

    const { data: profile } = await sb.from('profiles')
      .select('email, first_name, last_name').eq('user_id', order.user_id).maybeSingle();
    recipientEmail = (profile?.email ?? '').trim();
    if (!recipientEmail) {
      const { data: u } = await sb.auth.admin.getUserById(order.user_id);
      recipientEmail = u?.user?.email ?? '';
    }
    if (!recipientEmail) { console.warn('order-confirmed: no email', orderId); return json({ skipped: 'no_email' }); }
    const normalized = recipientEmail.toLowerCase();

    const { data: suppressed } = await sb.from('suppressed_emails').select('id').eq('email', normalized).maybeSingle();
    if (suppressed) return json({ skipped: 'suppressed' });

    let token: string | undefined;
    const { data: tok } = await sb.from('email_unsubscribe_tokens').select('token, used_at').eq('email', normalized).maybeSingle();
    if (tok && !tok.used_at) token = tok.token;
    else {
      const b = new Uint8Array(32); crypto.getRandomValues(b);
      token = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
      await sb.from('email_unsubscribe_tokens').upsert({ token, email: normalized }, { onConflict: 'email', ignoreDuplicates: true });
      const { data: s } = await sb.from('email_unsubscribe_tokens').select('token').eq('email', normalized).maybeSingle();
      if (s?.token) token = s.token;
    }

    let unitPrices: number[] | undefined;
    try {
      const { data: lines } = await sb.rpc('compute_order_line_prices', { _items: order.items, _now: order.created_at });
      // deno-lint-ignore no-explicit-any
      if (Array.isArray(lines)) unitPrices = lines.map((r: any) => Number(r?.unit_price ?? 0) + Number(r?.supplements_total ?? 0));
    } catch { /* ignore */ }

    const isDelivery = order.order_type === 'livraison';
    const time = isDelivery
      ? parisTime(order.delivery_time_confirmed) ?? parisTime(order.delivery_estimate) ?? parisTime(order.delivery_time_proposed) ?? parisTime(order.pickup_time)
      : parisTime(order.pickup_time);
    const full = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
    const data = {
      customerName: full || undefined,
      orderNumber: String(order.id).slice(0, 8).toUpperCase(),
      restaurant: order.restaurant,
      orderType: isDelivery ? 'Livraison' : 'À emporter',
      timeLabel: isDelivery ? 'Horaire de livraison' : 'Horaire de retrait',
      time,
      items: formatItems(order.items, unitPrices),
      total: euros(Number(order.total_price ?? 0)),
    };

    const t = TEMPLATES[TEMPLATE_NAME];
    const html = await renderAsync(React.createElement(t.component, data));
    const text = await renderAsync(React.createElement(t.component, data), { plainText: true });
    const subject = typeof t.subject === 'function' ? t.subject(data) : t.subject;

    const messageId = crypto.randomUUID();
    await sb.from('email_send_log').insert({
      message_id: messageId, template_name: TEMPLATE_NAME, recipient_email: recipientEmail,
      status: 'pending', metadata: { order_id: orderId },
    });
    const { error } = await sb.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId, to: recipientEmail, from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN, subject, html, text, purpose: 'transactional', label: TEMPLATE_NAME,
        idempotency_key: `order-confirmed:${orderId}`, unsubscribe_token: token, queued_at: new Date().toISOString(),
      },
    });
    if (error) throw new Error(`enqueue failed: ${error.message}`);
    return json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('send-order-confirmation-email failed:', orderId, msg);
    try {
      await sb.from('email_send_log').insert({
        message_id: crypto.randomUUID(), template_name: TEMPLATE_NAME,
        recipient_email: recipientEmail || 'unknown', status: 'failed',
        error_message: msg.slice(0, 1000), metadata: { order_id: orderId },
      });
    } catch { /* ignore */ }
    return json({ error: msg }, 500);
  }
});
