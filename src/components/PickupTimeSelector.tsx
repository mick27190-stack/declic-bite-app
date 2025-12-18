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
    const times: string[] = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    // Restaurant hours: 18h-22h
    const openHour = 18;
    const closeHour = 22;

    // Start from current time rounded up to next 15 minutes, or opening time
    let startHour = Math.max(currentHour, openHour);
    let startMinutes = 0;

    if (currentHour >= openHour && currentHour < closeHour) {
      // Round up to next 15-minute slot + 20 min prep time
      const totalMinutes = currentMinutes + 20;
      startMinutes = Math.ceil(totalMinutes / 15) * 15;
      if (startMinutes >= 60) {
        startHour += Math.floor(startMinutes / 60);
        startMinutes = startMinutes % 60;
      }
    }

    // Generate time slots until closing
    for (let hour = startHour; hour < closeHour; hour++) {
      for (let minutes = hour === startHour ? startMinutes : 0; minutes < 60; minutes += 15) {
        if (hour === closeHour - 1 && minutes > 45) break;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        times.push(timeStr);
      }
    }

    // If restaurant is closed, show times for next open day
    if (times.length === 0 || currentHour >= closeHour || currentHour < openHour) {
      for (let hour = openHour; hour < closeHour; hour++) {
        for (let minutes = 0; minutes < 60; minutes += 15) {
          if (hour === closeHour - 1 && minutes > 45) break;
          const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          times.push(timeStr);
        }
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
