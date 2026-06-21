import { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PickupTimeSelectorProps {
  value: string | null;
  onChange: (time: string) => void;
}

export function PickupTimeSelector({ value, onChange }: PickupTimeSelectorProps) {
  const [selectedTime, setSelectedTime] = useState<string | null>(value);

  const availableTimes = useMemo(() => {
    // Pickup slots: first at 18:30, last at 21:45, every 15 minutes.
    const FIRST_SLOT_MINUTES = 18 * 60 + 30; // 18:30
    const LAST_SLOT_MINUTES = 21 * 60 + 45; // 21:45

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    // Earliest slot must be at least 15 min from now, rounded up to the next
    // 15-minute slot. Ex: à 21h13 -> 21h28 -> arrondi au créneau 21h30.
    const earliestAllowed = Math.ceil((nowMinutes + 15) / 15) * 15;

    const times: string[] = [];
    for (let m = FIRST_SLOT_MINUTES; m <= LAST_SLOT_MINUTES; m += 15) {
      // Skip slots already in the past (plus prep time) for the current evening.
      if (earliestAllowed > FIRST_SLOT_MINUTES && m < earliestAllowed) continue;
      const hour = Math.floor(m / 60);
      const minutes = m % 60;
      times.push(
        `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
      );
    }

    // Outside service hours, fall back to the full slot list for the next service.
    if (times.length === 0) {
      for (let m = FIRST_SLOT_MINUTES; m <= LAST_SLOT_MINUTES; m += 15) {
        const hour = Math.floor(m / 60);
        const minutes = m % 60;
        times.push(
          `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        );
      }
    }

    return times;
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
