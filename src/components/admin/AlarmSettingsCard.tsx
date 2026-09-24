import { useMemo, useState } from 'react';
import { Volume2, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ALARM_SOUNDS,
  AlarmSettings,
  AlarmSoundId,
  getAlarmSettings,
  initNotificationSounds,
  playAlarmSound,
  saveAlarmSettings,
} from '@/lib/notificationSounds';

const REPETITION_OPTIONS = [
  { value: '0', label: "Jusqu'à « J'ai vu ✓ »" },
  ...[1, 3, 5, 10, 20].map((n) => ({ value: String(n), label: `${n} fois` })),
];

export default function AlarmSettingsCard() {
  const [s, setS] = useState<AlarmSettings>(getAlarmSettings);
  const update = (patch: Partial<AlarmSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveAlarmSettings(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-primary" aria-hidden="true" />
          Alarme des nouvelles commandes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="alarm-sound">Son de l'alerte</Label>
          <Select value={s.sound} onValueChange={(v) => update({ sound: v as AlarmSoundId })}>
            <SelectTrigger id="alarm-sound" className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALARM_SOUNDS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label id="alarm-volume-label">Volume : {s.volume} %</Label>
          <Slider aria-labelledby="alarm-volume-label" min={10} max={100} step={5} value={[s.volume]} onValueChange={([v]) => update({ volume: v })} />
        </div>

        <div className="space-y-2">
          <Label id="alarm-duration-label">Durée de chaque sonnerie : {s.duration} s</Label>
          <Slider aria-labelledby="alarm-duration-label" min={1} max={5} step={1} value={[s.duration]} onValueChange={([v]) => update({ duration: v })} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="alarm-reps">Nombre de répétitions</Label>
          <Select value={String(s.repetitions)} onValueChange={(v) => update({ repetitions: Number(v) })}>
            <SelectTrigger id="alarm-reps" className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REPETITION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" variant="outline" className="min-h-11" onClick={() => { initNotificationSounds(); playAlarmSound(s); }}>
          <Play className="h-4 w-4 mr-2" aria-hidden="true" /> Écouter
        </Button>
        <p className="text-xs text-muted-foreground">
          Réglages propres à cet appareil : chaque poste peut avoir son propre son. La bannière reste affichée jusqu'à « J'ai vu ✓ », même après la dernière répétition.
        </p>
      </CardContent>
    </Card>
  );
}
