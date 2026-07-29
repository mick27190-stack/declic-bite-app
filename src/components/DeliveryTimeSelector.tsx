import { useEffect, useState } from 'react';
import { Clock, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { computeDeliverySlots, DeliverySlots, validateDeliverySlot } from '@/lib/pickupSlots';

interface DeliveryTimeSelectorProps {
  value: string | null;
  onChange: (time: string) => void;
  disabled?: boolean;
}

export function DeliveryTimeSelector({ value, onChange, disabled }: DeliveryTimeSelectorProps) {
  const [slots, setSlots] = useState<DeliverySlots>(() => computeDeliverySlots(new Date()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setSlots(computeDeliverySlots(new Date()));
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleSelect = (time: string) => {
    if (disabled) return;
    // Same rule as the backend: never accept a slot before 18h45 nor before
    // the 30-min lead time.
    const check = validateDeliverySlot(time, new Date());
    if (!check.valid) {
      setError(check.error ?? null);

      // Fall back to the earliest bookable slot so the customer is never stuck.
      setSlots(computeDeliverySlots(new Date()));
      return;
    }
    setError(null);
    onChange(time);
  };

  const asap = slots.asap;
  const isAsapSelected = value === asap;


  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 text-foreground">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold">Heure de livraison</h3>
      </div>

      <div className="p-3 rounded-lg bg-muted/50 border border-border flex items-start gap-2">
        <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Votre restaurant est en droit de vous proposer un horaire de livraison différent de l'heure que vous souhaitez en fonction de leurs disponibilités. Vous devrez Accepter ou Refuser l'heure proposée par votre restaurant. En cas de Refus, votre commande sera annulée.
        </p>
      </div>

      <Button
        type="button"
        variant={isAsapSelected ? 'default' : 'outline'}
        className="w-full justify-start gap-3"
        disabled={disabled}
        onClick={() => handleSelect(asap)}
      >
        <Clock className="w-4 h-4" />
        <span>Dès que possible</span>
        <span className="text-muted-foreground ml-auto">~{asap}</span>
      </Button>

      {slots.slots.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Ou choisissez une heure :</p>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {slots.slots.map((time) => (
              <button
                key={time}
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(time)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  disabled ? 'cursor-not-allowed ' : ''
                }${
                  value === time
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
      )}

      {value && !isAsapSelected && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm text-foreground">
            Livraison prévue à <strong className="text-primary">{value}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
