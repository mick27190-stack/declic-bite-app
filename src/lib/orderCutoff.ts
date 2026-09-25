// Pure helpers for the end-of-service order cut-offs (Europe/Paris).
// Les bornes sont dérivées de la plage de service en cours (paramétrable par
// établissement). Pour la plage historique 18h-22h, on retrouve exactement :
//  - alerte à partir de 21h00, dernière commande à 21h15, coupure à 21h17.

import { parisMinutes } from './pickupSlots';
import { DEFAULT_WINDOW, ServiceWindow, minutesToHuman } from './openingHours';

// Offsets relatifs à l'heure de fermeture de la plage.
const CUTOFF_OFFSET = 43; // fermeture - 43 min => 21h17
const LAST_ORDER_OFFSET = 45; // fermeture - 45 min => 21h15
const WARNING_START_OFFSET = 60; // fermeture - 60 min => 21h00

export const DELIVERY_CUTOFF_MINUTES = 21 * 60 + 17; // 21:17 (plage par défaut)
export const TAKEAWAY_CUTOFF_MINUTES = 21 * 60 + 17;
export const CUTOFF_WARNING_START_MINUTES = 21 * 60;
export const CUTOFF_WARNING_END_MINUTES = 21 * 60 + 15;

export function cutoffMinutes(win: ServiceWindow = DEFAULT_WINDOW): number {
  return win.end - CUTOFF_OFFSET;
}
export function lastOrderMinutes(win: ServiceWindow = DEFAULT_WINDOW): number {
  return win.end - LAST_ORDER_OFFSET;
}
export function warningStartMinutes(win: ServiceWindow = DEFAULT_WINDOW): number {
  return win.end - WARNING_START_OFFSET;
}

export const CUTOFF_ALERT_MESSAGE =
  'Commandes fermées pour la livraison et pour les commandes à emporter à partir de 21h17. Revenez demain à 18h00.';

export function cutoffAlertMessage(win: ServiceWindow = DEFAULT_WINDOW): string {
  return `Commandes fermées pour la livraison et pour les commandes à emporter à partir de ${minutesToHuman(
    cutoffMinutes(win),
  )}.`;
}

export const BUTTON_LABEL_TAKEAWAY_CLOSED = 'Commandes fermées';
export const BUTTON_LABEL_TAKEAWAY_HINT =
  "commandes à emporter possibles jusqu'à 21h16";
export const BUTTON_LABEL_ORDER_NOW = 'Commander maintenant';
export const BUTTON_LABEL_CUTOFF_WARNING = 'Commandes possibles jusqu’à 21h15 max';

export type CutoffState = {
  isDeliveryCutoff: boolean;
  isTakeawayCutoff: boolean;
  isCutoffWarning: boolean;
};

/**
 * Returns whether the delivery/takeaway cut-offs apply at the given instant.
 * `isClosed` short-circuits: when the shop is already closed for another
 * reason (jour de fermeture, hors horaires, fermeture manuelle) the cut-offs
 * do not apply.
 */
export function getCutoffState(
  now: Date = new Date(),
  isClosed = false,
  win: ServiceWindow = DEFAULT_WINDOW,
): CutoffState {
  if (isClosed) {
    return { isDeliveryCutoff: false, isTakeawayCutoff: false, isCutoffWarning: false };
  }
  const m = parisMinutes(now);
  const cutoff = cutoffMinutes(win);
  return {
    isDeliveryCutoff: m >= cutoff,
    isTakeawayCutoff: m >= cutoff,
    isCutoffWarning: m >= warningStartMinutes(win) && m <= lastOrderMinutes(win),
  };
}

/**
 * Minutes remaining until the last-order deadline, when the current Paris time
 * sits in the warning window. Returns `null` outside it.
 */
export function getCutoffWarningMinutesRemaining(
  now: Date = new Date(),
  win: ServiceWindow = DEFAULT_WINDOW,
): number | null {
  const m = parisMinutes(now);
  if (m < warningStartMinutes(win) || m > lastOrderMinutes(win)) {
    return null;
  }
  return Math.max(0, lastOrderMinutes(win) - m);
}

/**
 * Label to show inside the "Commander" button given the cut-off state.
 */
export function getCutoffButtonLabel(
  state: CutoffState,
  opts: { orderType: 'emporter' | 'livraison'; canCheckout: boolean },
  win: ServiceWindow = DEFAULT_WINDOW,
): string | null {
  if (state.isTakeawayCutoff) return BUTTON_LABEL_TAKEAWAY_CLOSED;
  if (state.isDeliveryCutoff) {
    if (opts.orderType === 'emporter' && opts.canCheckout) {
      return BUTTON_LABEL_ORDER_NOW;
    }
    return `commandes à emporter possibles jusqu'à ${minutesToHuman(cutoffMinutes(win) - 1)}`;
  }
  if (state.isCutoffWarning) {
    return `Commandes possibles jusqu’à ${minutesToHuman(lastOrderMinutes(win))} max`;
  }
  return null;
}
