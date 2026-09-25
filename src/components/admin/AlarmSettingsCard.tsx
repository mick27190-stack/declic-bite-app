import { useMemo, useState } from 'react';
import { Volume2, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAdmin } from '@/contexts/AdminContext';
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
  customSoundForSite,
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

  const groups = useMemo(() => {
    const map = new Map<string, typeof ALARM_SOUNDS>();
    ALARM_SOUNDS.forEach((o) => {
      const list = map.get(o.group) ?? [];
      list.push(o);
      map.set(o.group, list);
    });
    return Array.from(map.entries());
  }, []);

  const { isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont, isSecondaryAdminConches, isSecondaryAdminBeaumont } = useAdmin();
  const dualSite = isSuperAdmin || ((isSiteAdminConches || isSecondaryAdminConches) && (isSiteAdminBeaumont || isSecondaryAdminBeaumont));

  const customUrlInput = (id: string, value: string, onChange: (v: string) => void, site?: 'conches' | 'beaumont') => (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
        Son personnalisé (lien du fichier audio, optionnel)
      </Label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        placeholder="https://…/mon-son.mp3"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        className="min-h-11"
      />
      <p className="text-xs text-muted-foreground">
        Si le fichier est supprimé, inaccessible ou illisible sur cet appareil, la sirène générée prend automatiquement le relais.
      </p>
      {value && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          aria-label={site ? `Écouter le son personnalisé de ${site}` : 'Écouter le son personnalisé'}
          onClick={() => { initNotificationSounds(); playAlarmSound(s, value); }}
        >
          <Play className="h-4 w-4 mr-2" aria-hidden="true" /> Écouter le fichier
        </Button>
      )}
    </div>
  );

  const soundSelect = (id: string, value: AlarmSoundId, onChange: (v: AlarmSoundId) => void) => (
    <Select value={value} onValueChange={(v) => onChange(v as AlarmSoundId)}>
      <SelectTrigger id={id} className="min-h-11"><SelectValue /></SelectTrigger>
      <SelectContent>
        {groups.map(([group, items]) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {items.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-primary" aria-hidden="true" />
          Alarme des nouvelles commandes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {dualSite && (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="alarm-per-site" className="leading-snug">Un son différent par site</Label>
            <Switch id="alarm-per-site" checked={!!s.perSite} onCheckedChange={(v) => update({ perSite: v })} />
          </div>
        )}

        {dualSite && s.perSite ? (
          (['conches', 'beaumont'] as const).map((site) => {
            const value = s.siteSounds?.[site] ?? s.sound;
            return (
              <div key={site} className="space-y-2">
                <Label htmlFor={`alarm-sound-${site}`}>Son de l'alerte — {site === 'conches' ? 'Conches' : 'Beaumont'}</Label>
                <div className="flex gap-2">
                  <div className="flex-1">{soundSelect(`alarm-sound-${site}`, value, (v) => update({ siteSounds: { ...s.siteSounds, [site]: v } }))}</div>
                  <Button type="button" variant="outline" className="min-h-11" aria-label={`Écouter le son de ${site}`} onClick={() => { initNotificationSounds(); playAlarmSound({ ...s, sound: value }, s.siteCustomSoundUrls?.[site] || null); }}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                {customUrlInput(
                  `alarm-custom-${site}`,
                  s.siteCustomSoundUrls?.[site] ?? '',
                  (v) => update({ siteCustomSoundUrls: { ...s.siteCustomSoundUrls, [site]: v || undefined } }),
                  site,
                )}
              </div>
            );
          })
        ) : (
          <div className="space-y-2">
            <Label htmlFor="alarm-sound">Son de l'alerte</Label>
            {soundSelect('alarm-sound', s.sound, (v) => update({ sound: v }))}
            {customUrlInput('alarm-custom', s.customSoundUrl ?? '', (v) => update({ customSoundUrl: v || undefined }))}
          </div>
        )}

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

        <Button type="button" variant="outline" className="min-h-11" onClick={() => { initNotificationSounds(); playAlarmSound(s, customSoundForSite(s, null)); }}>
          <Play className="h-4 w-4 mr-2" aria-hidden="true" /> Écouter
        </Button>
        <p className="text-xs text-muted-foreground">
          Réglages propres à cet appareil : chaque poste peut avoir son propre son. La bannière reste affichée jusqu'à « J'ai vu ✓ », même après la dernière répétition.
        </p>
      </CardContent>
    </Card>
  );
}
