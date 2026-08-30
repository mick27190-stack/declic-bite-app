import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { captureIfNeeded, resolveSite } from '../_shared/stripe.ts';
import { requireAdminForSite, serviceClient } from '../_shared/orderAccess.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id ?? '');
    if (!orderId) throw new Error('order_id requis');

    const sb = serviceClient();
    const { data: order, error } = await sb
      .from('orders')
      .select(
        'id, restaurant, site, order_type, stripe_payment_intent_id, capture_status, order_status, delivery_response, delivery_time_proposed, delivery_time_confirmed',
      )
      .eq('id', orderId)
      .single();
    if (error || !order) throw new Error('Commande introuvable');

    const site = resolveSite(order.site ?? order.restaurant);
    await requireAdminForSite(req, site);

    if (!order.stripe_payment_intent_id) throw new Error('Aucun paiement associé à cette commande');
    if (order.capture_status === 'captured') {
      return new Response(JSON.stringify({ ok: true, already_captured: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      await captureIfNeeded(site, order.stripe_payment_intent_id);
    } catch (e) {
      const msg = (e as Error).message;
      // La pré-autorisation n'existe plus côté Stripe : on resynchronise la
      // commande en « annulée » pour ne jamais laisser une commande affichée
      // comme confirmée alors qu'aucun paiement n'est encaissable.
      if (/annulée/i.test(msg)) {
        await sb
          .from('orders')
          .update({ capture_status: 'cancelled', order_status: 'cancelled', status: 'cancelled' })
          .eq('id', order.id);
      }
      throw e;
    }


    // Commande en livraison : confirmer l'horaire proposé (le cas échéant)
    // pour que le client et le back-office restent cohérents.
    const update: Record<string, unknown> = {
      order_status: 'confirmed',
      capture_status: 'captured',
      status: 'confirmed',
    };
    if (order.order_type === 'livraison') {
      if (!order.delivery_response && order.delivery_time_proposed) update.delivery_response = 'accepted';
      if (!order.delivery_time_confirmed) {
        update.delivery_time_confirmed = order.delivery_time_proposed ?? new Date().toISOString();
      }
    }

    const { error: updErr } = await sb.from('orders').update(update).eq('id', order.id);
    if (updErr) throw new Error(`Paiement encaissé mais mise à jour impossible : ${updErr.message}`);

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
