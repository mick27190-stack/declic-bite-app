// Pure helpers for evening order cut-offs (Europe/Paris).
// - Delivery is refused from 21h16 (last accepted at 21h15).
// - Take-away is refused from 21h31 (last accepted slot at 21h30).
// Extracted so the exact button labels and alert copy can be unit-tested
// at the 21h16 and 21h30 boundaries.

import { parisMinutes } from './pickupSlots';

export const DELIVERY_CUTOFF_MINUTES = 21 * 60 + 16; // 21:16
export const TAKEAWAY_CUTOFF_MINUTES = 21 * 60 + 31; // 21:31

export const CUTOFF_ALERT_MESSAGE =
  'Commandes fermés pour la livraison à partir de 21h15 et 21h30 pour les commandes à emporter. Revenez demain à 18h00.';

export const BUTTON_LABEL_TAKEAWAY_CLOSED = 'Commandes fermés';
export const BUTTON_LABEL_TAKEAWAY_HINT =
  "commandes à emporter possibles jusqu'à 21h30";
export const BUTTON_LABEL_ORDER_NOW = 'Commander maintenant';

export type CutoffState = {
  isDeliveryCutoff: boolean;
  isTakeawayCutoff: boolean;
};

/**
 * Returns whether the delivery/takeaway cut-offs apply at the given instant.
 * `isClosed` short-circuits: when the shop is already closed for another
 * reason (Monday, outside 18-22h, manual closure) the cut-offs do not apply.
 */
export function getCutoffState(
  now: Date = new Date(),
  isClosed = false,
): CutoffState {
  if (isClosed) {
    return { isDeliveryCutoff: false, isTakeawayCutoff: false };
  }
  const m = parisMinutes(now);
  return {
    isDeliveryCutoff: m >= DELIVERY_CUTOFF_MINUTES,
    isTakeawayCutoff: m >= TAKEAWAY_CUTOFF_MINUTES,
  };
}

/**
 * Label to show inside the "Commander" button given the cut-off state.
 * Returns `null` when the cut-offs do not force a specific label — the
 * caller can then fall back to its normal label logic.
 */
export function getCutoffButtonLabel(
  state: CutoffState,
  opts: { orderType: 'emporter' | 'livraison'; canCheckout: boolean },
): string | null {
  if (state.isTakeawayCutoff) return BUTTON_LABEL_TAKEAWAY_CLOSED;
  if (state.isDeliveryCutoff) {
    if (opts.orderType === 'emporter' && opts.canCheckout) {
      return BUTTON_LABEL_ORDER_NOW;
    }
    return BUTTON_LABEL_TAKEAWAY_HINT;
  }
  return null;
}
