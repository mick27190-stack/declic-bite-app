/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { TEMPLATES } from './transactional-email-templates/registry.ts';

const SITE_NAME = 'Declic-Pizza-app';
const SENDER_DOMAIN = 'notify.declicpizza.fr';
const FROM_DOMAIN = 'notify.declicpizza.fr';
const TEMPLATE_NAME = 'order-cancelled';

export type CancellationReason =
  | 'customer_payment_cancelled'
  | 'bank_declined'
  | 'delivery_time_refused'
  | 'admin_cancelled';

const REASON_MESSAGES: Record<CancellationReason, string> = {
  customer_payment_cancelled:
    'Motif : vous avez annulé le paiement de votre commande depuis la page de paiement sécurisée. Aucun règlement n’a été encaissé.',
  bank_declined:
    'Motif : la pré-autorisation de paiement a été refusée par votre banque. Votre commande n’a donc pas pu être validée et aucun règlement n’a été encaissé. Vous pouvez repasser commande avec une autre carte bancaire.',
  delivery_time_refused:
    'Motif : vous avez refusé le nouvel horaire de livraison proposé par la pizzeria. Votre commande a donc été annulée et aucun règlement n’a été encaissé.',
  admin_cancelled:
    'Motif : la pizzeria a dû annuler votre commande. Nous en sommes sincèrement désolés et restons joignables par téléphone pour vous apporter plus de précisions.',
};

function euros(n: number): string {
  return `${n.toFixed(2).replace('.', ',')}€`;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// deno-lint-ignore no-explicit-any
function formatItems(items: any): { label?: string; details?: string; quantity?: number; price?: string }[] {
  if (!Array.isArray(items)) return [];
  // deno-lint-ignore no-explicit-any
  return items.map((it: any) => {
    const name = it?.pizza?.name ?? it?.name ?? 'Article';
    const quantity = Number(it?.quantity ?? 1);
    const parts: string[] = [];
    if (it?.size?.name) parts.push(String(it.size.name));
    if (it?.base) parts.push(`Base ${it.base}`);
    // deno-lint-ignore no-explicit-any
    const sups = Array.isArray(it?.supplements) ? it.supplements.map((s: any) => s?.name).filter(Boolean) : [];
    if (sups.length) parts.push(`Suppléments : ${sups.join(', ')}`);
    if (it?.selectedItems && Array.isArray(it.selectedItems)) {
      // deno-lint-ignore no-explicit-any
      const sel = it.selectedItems.map((s: any) => s?.name ?? s).filter(Boolean);
      if (sel.length) parts.push(sel.join(', '));
    }
    const unit =
      Number(it?.size?.price ?? it?.price ?? 0) +
      // deno-lint-ignore no-explicit-any
      sups.reduce((_sum: number, _n: string) => _sum, 0) +
      // deno-lint-ignore no-explicit-any
      (Array.isArray(it?.supplements) ? it.supplements.reduce((s: number, x: any) => s + Number(x?.price ?? 0), 0) : 0);
    return {
      label: String(name),
      details: parts.join(' · ') || undefined,
      quantity,
      price: unit > 0 ? euros(unit * quantity) : undefined,
    };
  });
}

/**
 * Envoie au client l'e-mail d'annulation de commande (récapitulatif + motif +
 * mention « aucun débit »). Idempotent par commande : un seul envoi, quel que
 * soit le nombre de chemins d'annulation déclenchés (webhook + fonction).
 * Ne jette jamais : une erreur d'e-mail ne doit pas bloquer l'annulation.
 */
export async function sendOrderCancelledEmail(
  // deno-lint-ignore no-explicit-any
  sb: any,
  orderId: string,
  reason: CancellationReason,
): Promise<void> {
  try {
    const { data: order } = await sb
      .from('orders')
      .select('id, user_id, restaurant, order_type, items, total_price, created_at, loyalty_discount')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) return;

    // Anti-doublon : une seule notification d'annulation par commande.
    const { data: already } = await sb
      .from('email_send_log')
      .select('id')
      .eq('template_name', TEMPLATE_NAME)
      .contains('metadata', { order_id: orderId })
      .limit(1);
    if (already && already.length > 0) return;

    let recipientEmail: string | null = null;
    let customerName: string | undefined;
    if (order.user_id) {
      const { data: profile } = await sb
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('user_id', order.user_id)
        .maybeSingle();
      recipientEmail = (profile?.email as string | null)?.trim() || null;
      const full = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
      if (full) customerName = full;
      if (!recipientEmail) {
        const { data: authUser } = await sb.auth.admin.getUserById(order.user_id);
        recipientEmail = authUser?.user?.email ?? null;
      }
    }
    if (!recipientEmail) return;

    const normalizedEmail = recipientEmail.toLowerCase();
    const { data: suppressed } = await sb
      .from('suppressed_emails')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (suppressed) return;

    let unsubscribeToken: string;
    const { data: existingToken } = await sb
      .from('email_unsubscribe_tokens')
      .select('token, used_at')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (existingToken && !existingToken.used_at) {
      unsubscribeToken = existingToken.token as string;
    } else {
      unsubscribeToken = generateToken();
      await sb
        .from('email_unsubscribe_tokens')
        .upsert({ token: unsubscribeToken, email: normalizedEmail }, { onConflict: 'email', ignoreDuplicates: true });
      const { data: stored } = await sb
        .from('email_unsubscribe_tokens')
        .select('token')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (stored?.token) unsubscribeToken = stored.token as string;
    }

    const orderDate = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(order.created_at as string));

    const templateData = {
      customerName,
      orderNumber: String(order.id).slice(0, 8).toUpperCase(),
      orderDate,
      restaurant: order.restaurant as string,
      orderType: order.order_type === 'livraison' ? 'Livraison' : 'À emporter',
      reasonMessage: REASON_MESSAGES[reason],
      items: formatItems(order.items),
      total: euros(Number(order.total_price ?? 0)),
    };

    const template = TEMPLATES[TEMPLATE_NAME];
    if (!template) return;

    const html = await renderAsync(React.createElement(template.component, templateData));
    const plainText = await renderAsync(React.createElement(template.component, templateData), {
      plainText: true,
    });
    const subject =
      typeof template.subject === 'function' ? template.subject(templateData) : template.subject;

    const messageId = crypto.randomUUID();
    await sb.from('email_send_log').insert({
      message_id: messageId,
      template_name: TEMPLATE_NAME,
      recipient_email: recipientEmail,
      status: 'pending',
      metadata: { order_id: orderId, reason },
    });

    const { error: enqueueError } = await sb.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: recipientEmail,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text: plainText,
        purpose: 'transactional',
        label: TEMPLATE_NAME,
        idempotency_key: `order-cancelled:${orderId}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });
    if (enqueueError) {
      await sb.from('email_send_log').insert({
        message_id: messageId,
        template_name: TEMPLATE_NAME,
        recipient_email: recipientEmail,
        status: 'failed',
        error_message: enqueueError.message ?? 'Failed to enqueue email',
        metadata: { order_id: orderId, reason },
      });
    }
  } catch (e) {
    console.error('sendOrderCancelledEmail failed:', (e as Error).message);
  }
}
