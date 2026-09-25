import { useCart } from '@/contexts/CartContext';
import { useActiveClosures } from '@/hooks/useRestaurantClosures';
import { useOrderTestMode } from '@/hooks/useOrderTestMode';
import { useCurrentServiceWindow } from '@/hooks/useOpeningHours';
import { getCutoffState } from '@/lib/orderCutoff';
import { DAY_LABELS, minutesToHuman, nextWindowToday } from '@/lib/openingHours';

/**
 * Single source of truth for the customer-facing "commandes fermées" state.
 * Les horaires sont ceux configurés pour l'établissement sélectionné
 * (jusqu'à deux plages de service par jour).
 */
export function useOrderingStatus() {
  const { selectedRestaurant } = useCart();
  const { getClosureForSite } = useActiveClosures();
  const { isTestModeActive } = useOrderTestMode();
  const { now, nowMinutes, dow, site, windows, reference, active, getWindows } =
    useCurrentServiceWindow();

  // Jour de fermeture hebdomadaire du site (aucune plage configurée).
  const isDayClosed = windows.length === 0 && !isTestModeActive;
  const isMonday = isDayClosed;
  const isSunday = dow === 0;

  const isOutsideHours = !active && !isTestModeActive;

  const manualClosure = selectedRestaurant ? getClosureForSite(selectedRestaurant.name) : null;
  const isClosed = isDayClosed || isOutsideHours || !!manualClosure;
  // En mode test, les cut-offs de fin de service sont neutralisés : seule une
  // fermeture / un blocage manuel du site continue de s'appliquer.
  const cutoff = getCutoffState(now, isClosed || isTestModeActive, active ?? reference);

  const isOrderingClosed = isClosed || cutoff.isTakeawayCutoff || cutoff.isDeliveryCutoff;

  // Prochaine ouverture : plage suivante du jour, sinon premier jour ouvert.
  const upcomingToday = nextWindowToday(windows, nowMinutes);
  let reopenLabel: string;
  if (upcomingToday) {
    reopenLabel = `aujourd'hui à partir de ${minutesToHuman(upcomingToday.start)}`;
  } else {
    let found: string | null = null;
    for (let i = 1; i <= 7 && !found; i++) {
      const d = (dow + i) % 7;
      const w = getWindows(site, d);
      if (w.length > 0) {
        found = `${i === 1 ? 'demain' : DAY_LABELS[d].toLowerCase()} à partir de ${minutesToHuman(
          w[0].start,
        )}`;
      }
    }
    reopenLabel = found ?? 'prochainement';
  }

  const closedMessage = `Les commandes à emporter et en livraison sont fermées. Revenez ${reopenLabel}.`;

  return {
    now,
    isMonday,
    isSunday,
    isOutsideHours,
    manualClosure,
    isClosed,
    cutoff,
    isOrderingClosed,
    closedMessage,
    isTestModeActive,
    serviceWindow: active ?? reference,
    windows,
    reopenLabel,
  };
}
