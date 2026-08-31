import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, ChevronDown, ChevronUp, Copy, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Order } from '@/types/order';

const captureLabels: Record<string, { label: string; className: string }> = {
  pending: { label: '⏳ Autorisation en attente', className: 'bg-yellow-500 text-white' },
  authorized: { label: '🔒 Paiement autorisé', className: 'bg-blue-600 text-white' },
  captured: { label: '✅ Paiement encaissé', className: 'bg-green-600 text-white' },
  cancelled: { label: '❌ Autorisation annulée', className: 'bg-red-600 text-white' },
  canceled: { label: '❌ Autorisation annulée', className: 'bg-red-600 text-white' },
  refunded: { label: '↩️ Remboursé', className: 'bg-gray-500 text-white' },
};

const orderStatusLabels: Record<string, string> = {
  pending_confirmation: 'En attente de confirmation',
  awaiting_customer_response: 'En attente de réponse client',
  time_proposed: 'Nouvel horaire proposé',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  canceled: 'Annulée',
};

function fmt(value?: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
}

/** Historique Stripe dérivé des champs de la commande (pas d'événement perdu :
 *  chaque étape n'apparaît que si la donnée correspondante existe). */
function buildTimeline(order: Order): { label: string; at: string | null; done: boolean }[] {
  const capture = order.capture_status ?? null;
  const cancelled = capture === 'cancelled' || capture === 'canceled';
  return [
    { label: 'Commande créée', at: fmt(order.created_at), done: true },
    {
      label: 'PaymentIntent créé (Stripe)',
      at: order.stripe_payment_intent_id ? fmt(order.created_at) : null,
      done: !!order.stripe_payment_intent_id,
    },
    {
      label: 'Autorisation bancaire confirmée',
      at: capture && capture !== 'pending' && !cancelled ? fmt(order.updated_at) : null,
      done: !!capture && capture !== 'pending' && !cancelled,
    },
    {
      label: 'Horaire proposé au client',
      at: fmt(order.delivery_time_proposed),
      done: !!order.delivery_time_proposed,
    },
    {
      label: 'Horaire confirmé par le client',
      at: fmt(order.delivery_time_confirmed),
      done: !!order.delivery_time_confirmed,
    },
    {
      label: 'Paiement encaissé (capture)',
      at: capture === 'captured' ? fmt(order.updated_at) : null,
      done: capture === 'captured',
    },
    {
      label: 'Autorisation annulée',
      at: cancelled ? fmt(order.updated_at) : null,
      done: cancelled,
    },
  ].filter((step) => step.done || step.label === 'Autorisation bancaire confirmée');
}

export default function StripeStatusPanel({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();



  const capture = order.capture_status ?? null;
  const badge = capture ? captureLabels[capture] : null;
  const pi = order.stripe_payment_intent_id ?? null;

  const copyPi = async () => {
    if (!pi) return;
    try {
      await navigator.clipboard.writeText(pi);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copie impossible', description: pi, variant: 'destructive' });
    }
  };

  return (
    <div className="mt-4 border-t pt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium flex items-center gap-1">
          <CreditCard className="h-4 w-4" /> Paiement Stripe
        </p>
        <Badge className={badge?.className ?? 'bg-muted text-muted-foreground'}>
          {badge?.label ?? (capture ? capture : 'Aucun paiement enregistré')}
        </Badge>
        {order.order_status && (
          <Badge variant="outline">
            {orderStatusLabels[order.order_status] ?? order.order_status}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
          Historique
        </Button>
      </div>

      {capture === 'authorized' && (
        <div className="rounded-md border border-blue-500/50 bg-blue-500/10 p-3 space-y-2">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Le paiement est <strong>pré-autorisé mais pas encore encaissé</strong> chez Stripe
            (« non capturé »). Encaissez-le pour finaliser la commande.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={busy} onClick={onCapture}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
              Encaisser le paiement
            </Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={onCancelAuth}>
              Annuler la pré-autorisation
            </Button>
          </div>
        </div>
      )}



      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">PaymentIntent :</span>
        {pi ? (
          <>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono break-all">{pi}</code>
            <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={copyPi} title="Copier l'identifiant">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </>
        ) : (
          <span className="italic">non créé</span>
        )}
      </div>

      {open && (
        <ol className="mt-2 space-y-1.5 border-l pl-4">
          {buildTimeline(order).map((step, i) => (
            <li key={i} className="relative text-xs">
              <span
                className={`absolute -left-[21px] top-1 h-2 w-2 rounded-full ${
                  step.done ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
              <span className={step.done ? 'font-medium' : 'text-muted-foreground'}>{step.label}</span>
              <span className="text-muted-foreground"> · {step.at ?? 'en attente'}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
