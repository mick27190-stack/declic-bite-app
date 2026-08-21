// Dev-only preview page used by the E2E test to verify the exact wording
// of the alert and the "Commander" button at the 21h16 / 21h30 boundaries
// without needing to seed a cart or authenticate.
//
// Route: /dev/cutoff-preview?t=HH:MM&type=emporter|livraison&canCheckout=1
//
// The page renders the SAME copy constants used by CartView, driven by a
// virtual "now" (Paris minutes) parsed from the querystring.

import { useSearchParams } from 'react-router-dom';
import {
  parisMinutes,
  computeDeliverySlots,
  validateDeliverySlot,
} from '@/lib/pickupSlots';
import {
  CUTOFF_ALERT_MESSAGE,
  BUTTON_LABEL_CUTOFF_WARNING,
  getCutoffState,
  getCutoffButtonLabel,
  getCutoffWarningMinutesRemaining,
} from '@/lib/orderCutoff';

export default function CutoffPreviewPage() {
  const [params] = useSearchParams();
  const t = params.get('t') ?? '21:15';
  const [hh, mm] = t.split(':').map(Number);
  const minutes = hh * 60 + mm;
  const orderType = (params.get('type') ?? 'livraison') as 'emporter' | 'livraison';
  const canCheckout = params.get('canCheckout') === '1';

  // Build a fake Date whose Paris wall-clock is t. The helper uses parisMinutes()
  // to reverse-calculate the correct UTC timestamp for the requested Paris time.
  const targetMinutes = hh * 60 + mm;
  const baseUtc = new Date(Date.UTC(2026, 6, 15, hh, mm, 0, 0));
  const offsetMinutes = parisMinutes(baseUtc) - targetMinutes;
  const fakeNow = new Date(baseUtc.getTime() - offsetMinutes * 60 * 1000);
  const cutoff = getCutoffState(fakeNow);
  const warningMinutes = getCutoffWarningMinutesRemaining(fakeNow);

  const buttonLabel =
    cutoff.isCutoffWarning && warningMinutes !== null
      ? `Commandes jusqu'à 21h15 — encore ${warningMinutes} min`
      : getCutoffButtonLabel(cutoff, { orderType, canCheckout }) ?? 'Commander maintenant';

  const buttonDisabled =
    cutoff.isTakeawayCutoff ||
    (cutoff.isDeliveryCutoff && !(orderType === 'emporter' && canCheckout));

  // Delivery slot preview (45 min lead, 8 min grace, 18h45 → 22h00 grid).
  const delivery = computeDeliverySlots(fakeNow);
  const lastSlotValidation = validateDeliverySlot('22:00', fakeNow);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Cutoff preview</h1>
      <p data-testid="virtual-now">Virtual Paris time: {t}</p>
      <p data-testid="paris-minutes">{parisMinutes(fakeNow)}</p>
      <p data-testid="delivery-asap">{delivery.asap}</p>
      <p data-testid="delivery-slots">{delivery.slots.join(',')}</p>
      <p data-testid="delivery-last-slot-valid">
        {lastSlotValidation.valid ? 'valid' : 'invalid'}
      </p>
      <p data-testid="delivery-cutoff">{cutoff.isDeliveryCutoff ? 'closed' : 'open'}</p>
      {cutoff.isCutoffWarning && (
        <div data-testid="cutoff-warning" role="status">
          {BUTTON_LABEL_CUTOFF_WARNING}
        </div>
      )}
      {cutoff.isDeliveryCutoff && !cutoff.isTakeawayCutoff && (
        <div data-testid="cutoff-alert" role="alert">
          {CUTOFF_ALERT_MESSAGE}
        </div>
      )}
      <button data-testid="order-button" disabled={buttonDisabled}>
        {buttonLabel}
      </button>
    </div>
  );
}
