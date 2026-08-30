import { Check, ChefHat, Package, ShoppingBag, Truck, XCircle, Receipt } from 'lucide-react';
import { Order, OrderStatus } from '@/types/order';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TimelineStep {
  key: OrderStatus;
  label: string;
  icon: typeof Check;
}

/**
 * Timeline verticale de l'évolution d'une commande payée.
 * Étapes affichées : commande passée → acceptée → en préparation → prête → livrée/livraison.
 * Les dates proviennent de l'historique réel des changements de statut.
 */
export function OrderTimeline({ order }: { order: Order }) {
  const history = order.status_history || [];
  const reachedMap = new Map<OrderStatus, string>();
  history.forEach((h) => reachedMap.set(h.status, h.changed_at));

  const isDelivery = order.order_type === 'livraison';
  const cancelled = reachedMap.has('cancelled');

  const steps: TimelineStep[] = [
    { key: 'pending', label: 'Commande passée', icon: Receipt },
    { key: 'confirmed', label: 'Acceptée', icon: Check },
    { key: 'preparing', label: 'En préparation', icon: ChefHat },
    { key: 'ready', label: isDelivery ? 'Prête' : 'Prête à emporter', icon: ShoppingBag },
    { key: 'delivered', label: isDelivery ? 'En livraison / Livrée' : 'Remise au client', icon: isDelivery ? Truck : Package },
  ];

  const formatDate = (iso: string) =>
    format(new Date(iso), "dd/MM 'à' HH'h'mm", { locale: fr });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-xs font-semibold mb-2 text-muted-foreground">Suivi de la commande</p>
      <ol className="relative ml-3 space-y-3 border-l border-border">
        {steps.map((step, idx) => {
          const date = reachedMap.get(step.key);
          // La première étape (pending) retombe sur created_at si l'historique est incomplet.
          const effectiveDate = date ?? (idx === 0 ? order.created_at : undefined);
          const reached = !!effectiveDate;
          const isLast = idx === steps.length - 1;
          const isCurrent =
            reached && !cancelled && order.status === step.key;

          const Icon = step.icon;
          return (
            <li key={step.key} className="relative pl-5">
              <span
                className={`absolute -left-[9px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                  reached
                    ? isCurrent
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-green-500 border-green-500 text-white'
                    : 'bg-muted border-border text-muted-foreground'
                }`}
              >
                <Icon className="h-2.5 w-2.5" />
              </span>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs ${
                    reached ? 'font-medium text-foreground' : 'text-muted-foreground'
                  } ${isCurrent ? 'text-primary font-semibold' : ''}`}
                >
                  {step.label}
                </span>
                {effectiveDate && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDate(effectiveDate)}
                  </span>
                )}
              </div>
              {isLast && cancelled && null}
            </li>
          );
        })}
        {cancelled && (
          <li className="relative pl-5">
            <span className="absolute -left-[9px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 border border-red-500 text-white">
              <XCircle className="h-2.5 w-2.5" />
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-destructive">Annulée</span>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {formatDate(reachedMap.get('cancelled')!)}
              </span>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
