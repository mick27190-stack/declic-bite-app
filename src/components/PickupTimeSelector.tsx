import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { computePickupSlotOptions, type PickupSlot } from '@/lib/pickupSlots';

interface PickupTimeSelectorProps {
  value: string | null;
  onChange: (time: string) => void;
  disabled?: boolean;
}

export function PickupTimeSelector({ value, onChange, disabled }: PickupTimeSelectorProps) {
  const [selectedTime, setSelectedTime] = useState<string | null>(value);

  const [slots, setSlots] = useState<PickupSlot[]>(() => computePickupSlotOptions(new Date()));

  useEffect(() => {
    const refresh = () => setSlots(computePickupSlotOptions(new Date()));
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleSelect = (time: string, slotDisabled: boolean) => {
    if (disabled || slotDisabled) return;
    setSelectedTime(time);
    onChange(time);
  };

  // First enabled slot drives the "Dès que possible" shortcut.
  const asapSlot = slots.find((s) => !s.disabled) ?? slots[0];
  const asapTime = asapSlot?.time;
  const asapDisabled = disabled || !asapSlot || asapSlot.disabled;
  const gridSlots = asapSlot ? slots.filter((s) => s.time !== asapSlot.time) : slots;

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 text-foreground">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold">Heure de retrait</h3>
      </div>

      {/* ASAP Option */}
      {asapTime && (
        <Button
          type="button"
          variant={selectedTime === asapTime ? 'default' : 'outline'}
          className="w-full justify-start gap-3"
          disabled={asapDisabled}
          onClick={() => handleSelect(asapTime, asapDisabled)}
        >
          <Clock className="w-4 h-4" />
          <span>Dès que possible</span>
          <span className="text-muted-foreground ml-auto">~{asapTime}</span>
        </Button>
      )}

      {/* Time grid */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Ou choisissez une heure :</p>
        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
          {gridSlots.map(({ time, disabled: slotDisabled }) => {
            const isDisabled = disabled || slotDisabled;
            const isSelected = selectedTime === time;
            return (
              <button
                key={time}
                type="button"
                disabled={isDisabled}
                aria-disabled={isDisabled}
                onClick={() => handleSelect(time, isDisabled)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  isDisabled
                    ? 'cursor-not-allowed opacity-40 bg-muted text-muted-foreground line-through'
                    : isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {time}
              </button>
            );
          })}
        </div>
      </div>

      {selectedTime && selectedTime !== asapTime && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm text-foreground">
            Retrait prévu à <strong className="text-primary">{selectedTime}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
