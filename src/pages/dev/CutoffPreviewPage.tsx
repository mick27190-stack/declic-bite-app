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
  CUTOFF_ALERT_MESSAGE,
  BUTTON_LABEL_TAKEAWAY_CLOSED,
  BUTTON_LABEL_TAKEAWAY_HINT,
  BUTTON_LABEL_ORDER_NOW,
  DELIVERY_CUTOFF_MINUTES,
  TAKEAWAY_CUTOFF_MINUTES,
} from '@/lib/orderCutoff';

export default function CutoffPreviewPage() {
  const [params] = useSearchParams();
  const t = params.get('t') ?? '21:15';
  const [hh, mm] = t.split(':').map(Number);
  const minutes = hh * 60 + mm;
  const orderType = (params.get('type') ?? 'livraison') as 'emporter' | 'livraison';
  const canCheckout = params.get('canCheckout') === '1';

  const isDeliveryCutoff = minutes >= DELIVERY_CUTOFF_MINUTES;
  const isTakeawayCutoff = minutes >= TAKEAWAY_CUTOFF_MINUTES;

  let buttonLabel = 'Commander maintenant';
  if (isTakeawayCutoff) buttonLabel = BUTTON_LABEL_TAKEAWAY_CLOSED;
  else if (isDeliveryCutoff)
    buttonLabel =
      orderType === 'emporter' && canCheckout
        ? BUTTON_LABEL_ORDER_NOW
        : BUTTON_LABEL_TAKEAWAY_HINT;

  const buttonDisabled =
    isTakeawayCutoff || (isDeliveryCutoff && !(orderType === 'emporter' && canCheckout));

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Cutoff preview</h1>
      <p data-testid="virtual-now">Virtual Paris time: {t}</p>
      {isDeliveryCutoff && !isTakeawayCutoff && (
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
