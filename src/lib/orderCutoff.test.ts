import { describe, it, expect } from 'vitest';
import {
  DELIVERY_CUTOFF_MINUTES,
  TAKEAWAY_CUTOFF_MINUTES,
  CUTOFF_WARNING_START_MINUTES,
  CUTOFF_WARNING_END_MINUTES,
  CUTOFF_ALERT_MESSAGE,
  BUTTON_LABEL_TAKEAWAY_CLOSED,
  BUTTON_LABEL_TAKEAWAY_HINT,
  BUTTON_LABEL_ORDER_NOW,
  BUTTON_LABEL_CUTOFF_WARNING,
  getCutoffState,
  getCutoffButtonLabel,
} from './orderCutoff';

// Build a Date whose Europe/Paris wall-clock is (h:m) today. DST-safe.
function parisDate(h: number, m: number): Date {
  const target = h * 60 + m;
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
  it('takeaway cut-off is exactly 21h17 Paris (last order accepted at 21h16 → 21h30 slot)', () => {
    expect(TAKEAWAY_CUTOFF_MINUTES).toBe(21 * 60 + 17);
  });
  it('warning window is 21h00 to 21h15 Paris', () => {
    expect(CUTOFF_WARNING_START_MINUTES).toBe(21 * 60);
    expect(CUTOFF_WARNING_END_MINUTES).toBe(21 * 60 + 15);
  });
  it('warning button label is the approved wording', () => {
    expect(BUTTON_LABEL_CUTOFF_WARNING).toBe('Commandes possibles jusqu’à 21h15 max');
  });
  it('alert message copy is the approved wording', () => {
    expect(CUTOFF_ALERT_MESSAGE).toBe(
      'Commandes fermées pour la livraison à partir de 21h16 et pour les commandes à emporter à partir de 21h17. Revenez demain à 18h00.',
    );
  });
});

describe('getCutoffState — boundary behavior', () => {
  it('20h59 Paris: no cut-off, no warning', () => {
    const s = getCutoffState(parisDate(20, 59));
    expect(s.isDeliveryCutoff).toBe(false);
    expect(s.isTakeawayCutoff).toBe(false);
    expect(s.isCutoffWarning).toBe(false);
  });

  it('21h00 Paris: warning starts', () => {
    const s = getCutoffState(parisDate(21, 0));
    expect(s.isDeliveryCutoff).toBe(false);
    expect(s.isTakeawayCutoff).toBe(false);
    expect(s.isCutoffWarning).toBe(true);
  });

  it('21h15 Paris: warning active, no cut-off yet', () => {
    const s = getCutoffState(parisDate(21, 15));
    expect(s.isDeliveryCutoff).toBe(false);
    expect(s.isTakeawayCutoff).toBe(false);
    expect(s.isCutoffWarning).toBe(true);
  });

  it('21h16 Paris: delivery cut-off triggers, warning ends', () => {
    const s = getCutoffState(parisDate(21, 16));
    expect(s.isDeliveryCutoff).toBe(true);
    expect(s.isTakeawayCutoff).toBe(false);
    expect(s.isCutoffWarning).toBe(false);
  });

  it('21h17 Paris: both cut-offs apply', () => {
    const s = getCutoffState(parisDate(21, 17));
    expect(s.isDeliveryCutoff).toBe(true);
    expect(s.isTakeawayCutoff).toBe(true);
    expect(s.isCutoffWarning).toBe(false);
  });

  it('21h30 Paris: both closed', () => {
    const s = getCutoffState(parisDate(21, 30));
    expect(s.isDeliveryCutoff).toBe(true);
    expect(s.isTakeawayCutoff).toBe(true);
    expect(s.isCutoffWarning).toBe(false);
  });

  it('is short-circuited by isClosed = true', () => {
    const s = getCutoffState(parisDate(21, 45), true);
    expect(s.isDeliveryCutoff).toBe(false);
    expect(s.isTakeawayCutoff).toBe(false);
    expect(s.isCutoffWarning).toBe(false);
  });
});

describe('getCutoffButtonLabel — exact wording', () => {
  it('before 21h16: no forced label', () => {
    const s = getCutoffState(parisDate(21, 15));
    expect(getCutoffButtonLabel(s, { orderType: 'livraison', canCheckout: true })).toBeNull();
    expect(getCutoffButtonLabel(s, { orderType: 'emporter', canCheckout: true })).toBeNull();
  });

  it('at 21h16 with orderType=livraison: shows takeaway hint', () => {
    const s = getCutoffState(parisDate(21, 16));
    expect(
      getCutoffButtonLabel(s, { orderType: 'livraison', canCheckout: false }),
    ).toBe(BUTTON_LABEL_TAKEAWAY_HINT);
    expect(BUTTON_LABEL_TAKEAWAY_HINT).toBe(
      "commandes à emporter possibles jusqu'à 21h16",
    );
  });

  it('at 21h16 with orderType=emporter and canCheckout: keeps "Commander maintenant"', () => {
    const s = getCutoffState(parisDate(21, 16));
    expect(
      getCutoffButtonLabel(s, { orderType: 'emporter', canCheckout: true }),
    ).toBe(BUTTON_LABEL_ORDER_NOW);
  });

  it('at 21h17: all order types show "Commandes fermées"', () => {
    const s = getCutoffState(parisDate(21, 17));
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
