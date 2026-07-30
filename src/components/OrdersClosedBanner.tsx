import { AlertTriangle } from 'lucide-react';
import { useOrderingStatus } from '@/hooks/useOrderingStatus';

interface OrdersClosedBannerProps {
  className?: string;
}

/**
 * Shared "commandes fermées" banner used on the menu, cart and checkout so the
 * message is identical everywhere and appears live at the exact cut-off minute.
 * A manual closure (admin) takes precedence and shows its own reason.
 */
export function OrdersClosedBanner({ className = '' }: OrdersClosedBannerProps) {
  const { manualClosure, isOrderingClosed, closedMessage } = useOrderingStatus();

  if (manualClosure) {
    return (
      <div
        className={`rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3 ${className}`}
      >
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-destructive text-sm">Commandes bloquées</p>
          <p className="text-sm text-foreground mt-1">{manualClosure.reason}</p>
        </div>
      </div>
    );
  }

  if (!isOrderingClosed) return null;

  return (
    <div
      className={`rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3 ${className}`}
    >
      <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-yellow-700 text-sm">Commandes fermées</p>
        <p className="text-sm text-muted-foreground mt-1">{closedMessage}</p>
      </div>
    </div>
  );
}
