import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { cancelPaymentIntent, captureIfNeeded, resolveSite } from '../_shared/stripe.ts';
import { requireUser, serviceClient } from '../_shared/orderAccess.ts';
import { assignInvoiceNumber } from '../_shared/invoiceNumber.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const userId = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id ?? '');
    const response = String(body.response ?? ''); // 'accepted' | 'refused'
    if (!orderId) throw new Error('order_id requis');
    if (response !== 'accepted' && response !== 'refused') throw new Error('response doit être accepted ou refused');

    const sb = serviceClient();
    const { data: order, error } = await sb
      .from('orders')
      .select('id, user_id, restaurant, site, stripe_payment_intent_id, capture_status, delivery_time_proposed, invoice_number')
      .eq('id', orderId)
      .single();
    if (error || !order) throw new Error('Commande introuvable');

    const site = resolveSite(order.site ?? order.restaurant);

    if (order.user_id !== userId) {
      // L'appelant n'est pas le client : il doit être admin du site de la commande
      const { data: roles } = await sb
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      const allowed = new Set([
        'super_admin',
        'secondary_super_admin',
        `site_admin_${site}`,
        `secondary_admin_${site}`,
      ]);
      if (!(roles ?? []).some((r) => allowed.has(r.role as string))) {
        throw new Error('Cette commande ne vous appartient pas');
      }
    }

    if (response === 'accepted') {
      if (order.stripe_payment_intent_id && order.capture_status !== 'captured') {
        await captureIfNeeded(site, order.stripe_payment_intent_id);
      }
      const invoiceNumber = await assignInvoiceNumber(sb, site, order.invoice_number);
      const { error: updErr } = await sb.from('orders').update({
        ...(invoiceNumber ? { invoice_number: invoiceNumber } : {}),
        delivery_response: 'accepted',
        delivery_time_confirmed: order.delivery_time_proposed ?? new Date().toISOString(),
        order_status: 'confirmed',
        capture_status: 'captured',
        status: 'confirmed',
      }).eq('id', order.id);
      if (updErr) throw new Error(`Mise à jour de la commande impossible : ${updErr.message}`);
    } else {
      if (order.stripe_payment_intent_id && order.capture_status !== 'captured') {
        try {
          await cancelPaymentIntent(site, order.stripe_payment_intent_id);
        } catch (e) {
          console.error('Stripe cancel failed (continuing):', (e as Error).message);
        }
      }
      await sb.from('orders').update({
        delivery_response: 'refused',
        order_status: 'cancelled',
        capture_status: 'cancelled',
        status: 'cancelled',
      }).eq('id', order.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
