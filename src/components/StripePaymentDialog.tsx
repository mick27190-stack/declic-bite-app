import { useEffect, useMemo, useState } from 'react';
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { getStripe, resolveStripeSite, type StripeSite } from '@/lib/stripeClient';
import { useToast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  orderId: string | null;
  site: StripeSite | string | null;
  orderType: 'emporter' | 'livraison';
  amount: number;
  onSuccess: () => void;
  onCancelled: () => void;
};

function PaymentForm({
  orderType,
  amount,
  onSuccess,
  onAbort,
  aborting,
}: {
  orderType: 'emporter' | 'livraison';
  amount: number;
  onSuccess: () => void;
  onAbort: () => void;
  aborting: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [walletAvailable, setWalletAvailable] = useState(false);

  const finalizeConfirmation = async () => {
    if (!stripe || !elements) return;
    setErrorMessage(null);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    if (error) {
      setErrorMessage(error.message ?? "Le paiement n'a pas pu être autorisé.");
      return;
    }
    if (paymentIntent && ['requires_capture', 'succeeded'].includes(paymentIntent.status)) {
      onSuccess();
      return;
    }
    setErrorMessage("L'autorisation bancaire n'a pas abouti. Merci de réessayer.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      // capture_method = manual : le statut attendu est requires_capture.
      await finalizeConfirmation();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de paiement';
      setErrorMessage(message);
      toast({ title: 'Paiement refusé', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
        <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          {orderType === 'livraison' ? (
            <>
              Nous <strong className="text-foreground">pré-autorisons</strong> {amount.toFixed(2)}€ sur votre
              carte. Le montant n'est débité qu'une fois votre créneau de livraison confirmé par la pizzeria.
              En cas d'annulation ou de refus d'un nouvel horaire, l'autorisation est libérée.
            </>
          ) : (
            <>
              Nous <strong className="text-foreground">pré-autorisons</strong> {amount.toFixed(2)}€ sur votre
              carte. Le débit intervient uniquement quand la pizzeria confirme votre commande à emporter.
            </>
          )}
        </div>
      </div>

      {/* Le conteneur reste monté (jamais display:none) : Stripe a besoin d'un
          conteneur mesurable pour détecter et afficher Apple Pay / Google Pay. */}
      <div className={walletAvailable ? 'space-y-3' : 'h-0 overflow-hidden opacity-0 pointer-events-none'}>
        <ExpressCheckoutElement
          options={{
            buttonHeight: 48,
            paymentMethods: { applePay: 'auto', googlePay: 'auto', link: 'never' },
          }}
          onReady={({ availablePaymentMethods }) => {
            setWalletAvailable(
              Boolean(availablePaymentMethods) &&
              Object.values(availablePaymentMethods as Record<string, boolean>).some(Boolean),
            );
          }}
          onLoadError={(e) => {
            console.warn('ExpressCheckout indisponible', e);
            setWalletAvailable(false);
          }}
          onConfirm={async () => {
            setSubmitting(true);
            try {
              await finalizeConfirmation();
            } finally {
              setSubmitting(false);
            }
          }}
          onCancel={() => setSubmitting(false)}
        />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou payer par carte
          <span className="h-px flex-1 bg-border" />
        </div>
      </div>


      <PaymentElement
        options={{
          layout: 'tabs',
          wallets: { applePay: 'auto', googlePay: 'auto' },
        }}
      />

      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      <div className="space-y-2">
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={!stripe || submitting}>
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Autorisation en cours...
            </>
          ) : (
            `Autoriser ${amount.toFixed(2)}€`
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={onAbort}
          disabled={submitting || aborting}
        >
          {aborting ? 'Annulation...' : 'Annuler la commande'}
        </Button>
      </div>
    </form>
  );
}

export function StripePaymentDialog({
  open,
  orderId,
  site,
  orderType,
  amount,
  onSuccess,
  onCancelled,
}: Props) {
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aborting, setAborting] = useState(false);

  const stripeSite = useMemo(() => resolveStripeSite(typeof site === 'string' ? site : null), [site]);

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;

    (async () => {
      setLoadError(null);
      setClientSecret(null);
      try {
        setStripePromise(getStripe(stripeSite));
        const { data, error } = await supabase.functions.invoke('create-payment-intent', {
          body: { order_id: orderId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!cancelled) setClientSecret(data.client_secret as string);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Paiement indisponible';
        if (!cancelled) setLoadError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, orderId, stripeSite]);

  const abortOrder = async () => {
    if (!orderId) return;
    setAborting(true);
    try {
      const { error } = await supabase.functions.invoke('cancel-order', {
        body: { order_id: orderId },
      });
      if (error) throw error;
      toast({ title: 'Commande annulée', description: "Aucun montant n'a été débité." });
    } catch (err) {
      console.error('cancel-order failed', err);
    } finally {
      setAborting(false);
      onCancelled();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) void abortOrder(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Paiement sécurisé</DialogTitle>
          <DialogDescription>
            Commande {orderType === 'livraison' ? 'en livraison' : 'à emporter'} • {amount.toFixed(2)}€
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{loadError}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={abortOrder} disabled={aborting}>
              Annuler la commande
            </Button>
          </div>
        ) : clientSecret && stripePromise ? (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, locale: 'fr', appearance: { theme: 'night' } }}
          >
            <PaymentForm
              orderType={orderType}
              amount={amount}
              onSuccess={onSuccess}
              onAbort={abortOrder}
              aborting={aborting}
            />
          </Elements>
        ) : (
          <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Préparation du paiement sécurisé...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
