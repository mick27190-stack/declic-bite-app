import { describe, it, expect } from 'vitest';
import {
  DELIVERY_CUTOFF_MINUTES,
  TAKEAWAY_CUTOFF_MINUTES,
  CUTOFF_ALERT_MESSAGE,
  BUTTON_LABEL_TAKEAWAY_CLOSED,
  BUTTON_LABEL_TAKEAWAY_HINT,
  BUTTON_LABEL_ORDER_NOW,
  getCutoffState,
  getCutoffButtonLabel,
} from './orderCutoff';

// Build a Date whose Europe/Paris wall-clock is (h:m) today.
// Paris is UTC+1 (CET) or UTC+2 (CEST). We build the target instant by
// asking Intl what Paris minutes correspond to a candidate UTC and
// shifting until they match — robust across DST.
function parisDate(h: number, m: number): Date {
  const target = h * 60 + m;
  // Start from today at UTC h:m and adjust.
  const base = new Date();
  const guess = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m, 0),
  );
  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(guess.getTime() - offset * 3600_000);
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const hh = Number(parts.find((p) => p.type === 'hour')?.value);
    const mm = Number(parts.find((p) => p.type === 'minute')?.value);
    if (hh * 60 + mm === target) return d;
  }
  throw new Error(`Cannot build Paris ${h}:${m}`);
}

describe('order cut-off constants', () => {
  it('delivery cut-off is exactly 21h16 Paris', () => {
    expect(DELIVERY_CUTOFF_MINUTES).toBe(21 * 60 + 16);
  });
  it('takeaway cut-off is exactly 21h31 Paris (last valid slot 21h30)', () => {
    expect(TAKEAWAY_CUTOFF_MINUTES).toBe(21 * 60 + 31);
  });
  it('alert message copy is the approved wording', () => {
    expect(CUTOFF_ALERT_MESSAGE).toBe(
      'Commandes fermées pour la livraison à partir de 21h15 et 21h30 pour les commandes à emporter. Revenez demain à 18h00.',
    );
  });
});

describe('getCutoffState — boundary behavior', () => {
  it('21h15 Paris: neither cut-off applies (delivery still open)', () => {
    const s = getCutoffState(parisDate(21, 15));
    expect(s.isDeliveryCutoff).toBe(false);
    expect(s.isTakeawayCutoff).toBe(false);
  });

  it('21h16 Paris: delivery cut-off triggers, takeaway still open', () => {
    const s = getCutoffState(parisDate(21, 16));
    expect(s.isDeliveryCutoff).toBe(true);
    expect(s.isTakeawayCutoff).toBe(false);
  });

  it('21h29 Paris: delivery closed, takeaway still open', () => {
    const s = getCutoffState(parisDate(21, 29));
    expect(s.isDeliveryCutoff).toBe(true);
    expect(s.isTakeawayCutoff).toBe(false);
  });

  it('21h30 Paris: takeaway last-slot window still open (isTakeawayCutoff false)', () => {
    const s = getCutoffState(parisDate(21, 30));
    expect(s.isDeliveryCutoff).toBe(true);
    expect(s.isTakeawayCutoff).toBe(false);
  });

  it('21h31 Paris: both cut-offs apply', () => {
    const s = getCutoffState(parisDate(21, 31));
    expect(s.isDeliveryCutoff).toBe(true);
    expect(s.isTakeawayCutoff).toBe(true);
  });

  it('is short-circuited by isClosed = true', () => {
    const s = getCutoffState(parisDate(21, 45), true);
    expect(s.isDeliveryCutoff).toBe(false);
    expect(s.isTakeawayCutoff).toBe(false);
  });
});

describe('getCutoffButtonLabel — exact wording', () => {
  it('before 21h16: no forced label (falls back to normal logic)', () => {
    const s = getCutoffState(parisDate(21, 15));
    expect(
      getCutoffButtonLabel(s, { orderType: 'livraison', canCheckout: true }),
    ).toBeNull();
    expect(
      getCutoffButtonLabel(s, { orderType: 'emporter', canCheckout: true }),
    ).toBeNull();
  });

  it('at 21h16 with orderType=livraison: shows takeaway hint', () => {
    const s = getCutoffState(parisDate(21, 16));
    expect(
      getCutoffButtonLabel(s, { orderType: 'livraison', canCheckout: false }),
    ).toBe(BUTTON_LABEL_TAKEAWAY_HINT);
    expect(BUTTON_LABEL_TAKEAWAY_HINT).toBe(
      "commandes à emporter possibles jusqu'à 21h30",
    );
  });

  it('at 21h16 with orderType=emporter and canCheckout: keeps "Commander maintenant"', () => {
    const s = getCutoffState(parisDate(21, 20));
    expect(
      getCutoffButtonLabel(s, { orderType: 'emporter', canCheckout: true }),
    ).toBe(BUTTON_LABEL_ORDER_NOW);
    expect(BUTTON_LABEL_ORDER_NOW).toBe('Commander maintenant');
  });

  it('at 21h16 with orderType=emporter but not ready: shows hint', () => {
    const s = getCutoffState(parisDate(21, 20));
    expect(
      getCutoffButtonLabel(s, { orderType: 'emporter', canCheckout: false }),
    ).toBe(BUTTON_LABEL_TAKEAWAY_HINT);
  });

  it('at 21h31: both order types show "Commandes fermées"', () => {
    const s = getCutoffState(parisDate(21, 31));
    for (const orderType of ['emporter', 'livraison'] as const) {
      for (const canCheckout of [true, false]) {
        expect(getCutoffButtonLabel(s, { orderType, canCheckout })).toBe(
          BUTTON_LABEL_TAKEAWAY_CLOSED,
        );
      }
    }
    expect(BUTTON_LABEL_TAKEAWAY_CLOSED).toBe('Commandes fermées');
  });
});
