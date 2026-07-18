// Dev-only preview page used by the E2E test to verify the exact wording
// of the alert and the "Commander" button at the 21h16 / 21h30 boundaries
// without needing to seed a cart or authenticate.
//
// Route: /dev/cutoff-preview?t=HH:MM&type=emporter|livraison&canCheckout=1
//
// The page renders the SAME copy constants used by CartView, driven by a
// virtual "now" (Paris minutes) parsed from the querystring.

import { useSearchParams } from 'react-router-dom';
import { parisMinutes } from '@/lib/pickupSlots';
import {
  CUTOFF_ALERT_MESSAGE,
  BUTTON_LABEL_CUTOFF_WARNING,
  getCutoffState,
  getCutoffButtonLabel,
} from '@/lib/orderCutoff';

export default function CutoffPreviewPage() {
  const [params] = useSearchParams();
  const t = params.get('t') ?? '21:15';
  const [hh, mm] = t.split(':').map(Number);
  const minutes = hh * 60 + mm;
  const orderType = (params.get('type') ?? 'livraison') as 'emporter' | 'livraison';
  const canCheckout = params.get('canCheckout') === '1';

  // Build a fake Date whose Paris wall-clock is t. Since parisMinutes() converts
  // from UTC, we subtract the Paris offset (UTC+2 in summer, +1 in winter) to get
  // a UTC instant that corresponds to t in Paris.
  const parisOffset = new Date().getTimezoneOffset() === 0 ? 120 : 0;
  const fakeNow = new Date(Date.UTC(2026, 6, 15, hh, mm, 0) - parisOffset * 60 * 1000);
  const cutoff = getCutoffState(fakeNow);

  const buttonLabel =
    getCutoffButtonLabel(cutoff, { orderType, canCheckout }) ?? 'Commander maintenant';

  const buttonDisabled =
    cutoff.isTakeawayCutoff ||
    (cutoff.isDeliveryCutoff && !(orderType === 'emporter' && canCheckout));

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Cutoff preview</h1>
      <p data-testid="virtual-now">Virtual Paris time: {t}</p>
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
