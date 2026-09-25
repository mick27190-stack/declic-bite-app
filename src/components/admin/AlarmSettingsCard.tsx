import { useMemo, useState, type ChangeEvent } from 'react';
import { Volume2, Play, Upload, RefreshCw, Trash2, Music2 } from 'lucide-react';
import { toast } from 'sonner';
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
  CustomSoundMeta,
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

  const MAX_AUDIO_SIZE = 2 * 1024 * 1024; // 2 Mo — stocké sur l'appareil

  const formatAudioLabel = (type: string) => {
    const t = (type || 'audio').toLowerCase();
    if (t.includes('mpeg') || t.includes('mp3')) return 'MP3';
    if (t.includes('wav')) return 'WAV';
    if (t.includes('ogg')) return 'OGG';
    if (t.includes('mp4') || t.includes('aac') || t.includes('m4a')) return 'M4A';
    if (t.includes('flac')) return 'FLAC';
    const sub = t.split('/')[1];
    return sub ? sub.toUpperCase() : 'Audio';
  };

  const audioSizeLabel = (bytes: number) =>
    bytes >= 1024 * 1024
      ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} Mo`
      : `${Math.max(1, Math.round(bytes / 1024))} Ko`;

  const pickAudioFile = (onChange: (v: string, meta: CustomSoundMeta) => void) => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('Veuillez sélectionner un fichier audio (MP3, WAV, OGG…)');
      return;
    }
    if (file.size > MAX_AUDIO_SIZE) {
      toast.error('Fichier trop lourd : 2 Mo maximum');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange(String(reader.result), { name: file.name, type: file.type, size: file.size });
      toast.success('Son personnalisé enregistré sur cet appareil');
    };
    reader.onerror = () => toast.error("Impossible de lire le fichier audio");
    reader.readAsDataURL(file);
  };

  const customUrlInput = (
    id: string,
    value: string,
    onChange: (v: string | null, meta: CustomSoundMeta | null) => void,
    meta: CustomSoundMeta | null,
    site?: 'conches' | 'beaumont',
  ) => {
    const isFile = value.startsWith('data:');
    const importFile = () => document.getElementById(`${id}-file`)?.click();
    const clear = () => onChange(null, null);
    const infoLabel = isFile
      ? [meta?.name || 'Fichier audio', formatAudioLabel(meta?.type ?? ''), meta?.size ? audioSizeLabel(meta.size) : null].filter(Boolean).join(' · ')
      : (() => { try { return `Lien externe · ${new URL(value).hostname}`; } catch { return 'Lien externe'; } })();
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
          Son personnalisé (fichier audio ou lien, optionnel)
        </Label>
        {!isFile && (
          <div className="flex gap-2">
            <Input
              id={id}
              type="url"
              inputMode="url"
              placeholder="https://…/mon-son.mp3"
              value={value}
              onChange={(e) => onChange(e.target.value.trim(), null)}
              className="min-h-11 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11 shrink-0"
              aria-label={site ? `Importer un fichier audio pour ${site}` : 'Importer un fichier audio'}
              onClick={importFile}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
            </Button>
            <input
              id={`${id}-file`}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={pickAudioFile(onChange)}
            />
          </div>
        )}
        {value && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
            <Music2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground" title={infoLabel}>{infoLabel}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 shrink-0"
              aria-label={site ? `Remplacer le fichier audio de ${site}` : 'Remplacer le fichier audio'}
              onClick={importFile}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Remplacer
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 shrink-0 text-destructive hover:text-destructive"
              aria-label={site ? `Supprimer le fichier audio de ${site}` : 'Supprimer le fichier audio'}
              onClick={clear}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Supprimer
            </Button>
          </div>
        )}
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
        <p className="text-xs text-muted-foreground">
          Si le fichier est supprimé, inaccessible ou illisible sur cet appareil, la sirène générée prend automatiquement le relais.
        </p>
      </div>
    );
  };

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
                  (v, meta) => update({
                    siteCustomSoundUrls: { ...s.siteCustomSoundUrls, [site]: v || undefined },
                    siteCustomSoundMeta: { ...s.siteCustomSoundMeta, [site]: meta ?? undefined },
                  }),
                  s.siteCustomSoundMeta?.[site] ?? null,
                  site,
                )}
              </div>
            );
          })
        ) : (
          <div className="space-y-2">
            <Label htmlFor="alarm-sound">Son de l'alerte</Label>
            {soundSelect('alarm-sound', s.sound, (v) => update({ sound: v }))}
            {customUrlInput(
              'alarm-custom',
              s.customSoundUrl ?? '',
              (v, meta) => update({ customSoundUrl: v || undefined, customSoundMeta: meta ?? undefined }),
              s.customSoundMeta ?? null,
            )}
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
