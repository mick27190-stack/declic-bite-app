import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { resolveSite } from '../_shared/stripe.ts';
import { requireAdminForSite, serviceClient } from '../_shared/orderAccess.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id ?? '');
    const proposedTime = String(body.delivery_time ?? ''); // "HH:MM" ou ISO
    if (!orderId) throw new Error('order_id requis');
    if (!proposedTime) throw new Error('delivery_time requis');

    const sb = serviceClient();
    const { data: order, error } = await sb
      .from('orders')
      .select('id, restaurant, site, order_type, user_id')
      .eq('id', orderId)
      .single();
    if (error || !order) throw new Error('Commande introuvable');
    if (order.order_type !== 'livraison') throw new Error('Réservé aux commandes en livraison');

    const site = resolveSite(order.site ?? order.restaurant);
    await requireAdminForSite(req, site);

    // delivery_estimate alimente le flux existant (tokens, email, notifications push)
    const isISODate = proposedTime.includes('T') || proposedTime.includes('-');
    const updatePayload: Record<string, unknown> = {
      delivery_time_proposed: isISODate ? proposedTime : null,
      order_status: 'awaiting_customer_response',
      delivery_response: null,
    };
    if (!isISODate) updatePayload.delivery_estimate = proposedTime;

    await sb.from('orders').update(updatePayload).eq('id', order.id);

    // Notification push au client (send_push_on_notification la relaie en FCM)
    await sb.from('notifications').insert({
      user_id: order.user_id,
      title: 'Nouvel horaire de livraison proposé',
      body: `Le restaurant vous propose une livraison à ${proposedTime}. Touchez pour accepter ou refuser.`,
      type: 'new_order',
      reference_id: order.id,
      site,
      dedupe_key: `delivery_proposal:${order.id}:${proposedTime}`,
    });

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
