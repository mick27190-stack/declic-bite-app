import { useCart } from '@/contexts/CartContext';
import { useActiveClosures } from '@/hooks/useRestaurantClosures';
import { useLiveParisTime } from '@/hooks/useLiveParisTime';
import { useOrderTestMode } from '@/hooks/useOrderTestMode';
import { getCutoffState } from '@/lib/orderCutoff';


/**
 * Single source of truth for the customer-facing "commandes fermées" state.
 * Shared by the menu, the cart and the checkout so every screen shows the same
 * message at the same instant, updating live at each minute boundary.
 */
export function useOrderingStatus() {
  const now = useLiveParisTime();
  const { selectedRestaurant } = useCart();
  const { getClosureForSite } = useActiveClosures();

  const parisWeekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
  }).format(now);
  const isMonday = parisWeekday === 'Mon';
  const isSunday = parisWeekday === 'Sun';

  const currentHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      hour12: false,
    }).format(now),
  );
  const isOutsideHours = currentHour < 18 || currentHour >= 22;

  const manualClosure = selectedRestaurant ? getClosureForSite(selectedRestaurant.name) : null;
  const isClosed = isMonday || isOutsideHours || !!manualClosure;
  const cutoff = getCutoffState(now, isClosed);

  // "Commandes fermées" banner: shown once the evening cut-off has passed, or
  // when the shop is closed for the day (Monday / outside 18h-22h).
  const isOrderingClosed = isClosed || cutoff.isTakeawayCutoff || cutoff.isDeliveryCutoff;

  // Reopening wording: Monday and Sunday evening both point to Tuesday 18h,
  // an early-morning/afternoon visit points to the same day.
  const reopenLabel = isMonday || (isSunday && !isOutsideHours) || (isSunday && currentHour >= 18)
    ? 'mardi'
    : isOutsideHours && currentHour < 18
      ? "aujourd'hui"
      : 'demain';

  const closedMessage = `Les commandes à emporter et en livraison sont fermées. Revenez ${reopenLabel} à partir de 18h00.`;

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
  };
}
