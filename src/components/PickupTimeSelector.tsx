import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { computePickupSlots } from '@/lib/pickupSlots';

interface PickupTimeSelectorProps {
  value: string | null;
  onChange: (time: string) => void;
  disabled?: boolean;
}

export function PickupTimeSelector({ value, onChange, disabled }: PickupTimeSelectorProps) {
  const [selectedTime, setSelectedTime] = useState<string | null>(value);

  // Recompute slots from the real current time (in the restaurant timezone)
  // and refresh every minute so the proposed times stay coherent.
  const [availableTimes, setAvailableTimes] = useState<string[]>(() => computePickupSlots(new Date()));

  useEffect(() => {
    const refresh = () => setAvailableTimes(computePickupSlots(new Date()));
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, []);


  const handleSelect = (time: string) => {
    setSelectedTime(time);
    onChange(time);
  };

  // Show "Dès que possible" option
  const asapTime = availableTimes[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-foreground">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold">Heure de retrait</h3>
      </div>

      {/* ASAP Option */}
      <Button
        type="button"
        variant={selectedTime === asapTime ? "default" : "outline"}
        className="w-full justify-start gap-3"
        onClick={() => handleSelect(asapTime)}
      >
        <Clock className="w-4 h-4" />
        <span>Dès que possible</span>
        <span className="text-muted-foreground ml-auto">~{asapTime}</span>
      </Button>

      {/* Time grid */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Ou choisissez une heure :</p>
        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
          {availableTimes.slice(1).map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => handleSelect(time)}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                selectedTime === time
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              {time}
            </button>
          ))}
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
