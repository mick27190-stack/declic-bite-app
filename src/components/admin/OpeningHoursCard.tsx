import { useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAdmin } from '@/contexts/AdminContext';
import {
  DAY_LABELS,
  DAY_ORDER,
  DayOpeningHours,
  SiteId,
  minutesToLabel,
} from '@/lib/openingHours';

type DayState = {
  is_closed: boolean;
  slot1: boolean;
  slot1_start: number;
  slot1_end: number;
  slot2: boolean;
  slot2_start: number;
  slot2_end: number;
};

const DEFAULT_DAY: DayState = {
  is_closed: false,
  slot1: true,
  slot1_start: 18 * 60,
  slot1_end: 22 * 60,
  slot2: false,
  slot2_start: 11 * 60 + 30,
  slot2_end: 14 * 60,
};

// Créneaux de 15 minutes, de 00:00 à 23:45.
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => i * 15);

function rowToState(row: DayOpeningHours | undefined): DayState {
  if (!row) return { ...DEFAULT_DAY };
  return {
    is_closed: row.is_closed,
    slot1: row.slot1_start != null && row.slot1_end != null,
    slot1_start: row.slot1_start ?? DEFAULT_DAY.slot1_start,
    slot1_end: row.slot1_end ?? DEFAULT_DAY.slot1_end,
    slot2: row.slot2_start != null && row.slot2_end != null,
    slot2_start: row.slot2_start ?? DEFAULT_DAY.slot2_start,
    slot2_end: row.slot2_end ?? DEFAULT_DAY.slot2_end,
  };
}

function TimeSelect({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
    >
      <SelectTrigger className="w-[100px] min-h-11" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {TIME_OPTIONS.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {minutesToLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function OpeningHoursCard() {
  const { isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont } = useAdmin();

  const availableSites = useMemo<SiteId[]>(() => {
    if (isSuperAdmin) return ['conches', 'beaumont'];
    const out: SiteId[] = [];
    if (isSiteAdminConches) out.push('conches');
    if (isSiteAdminBeaumont) out.push('beaumont');
    return out;
  }, [isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont]);

  const [site, setSite] = useState<SiteId>(availableSites[0] ?? 'conches');
  const [days, setDays] = useState<Record<number, DayState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (availableSites.length > 0 && !availableSites.includes(site)) {
      setSite(availableSites[0]);
    }
  }, [availableSites, site]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from('site_opening_hours')
      .select('site, day_of_week, is_closed, slot1_start, slot1_end, slot2_start, slot2_end')
      .eq('site', site)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as unknown as DayOpeningHours[];
        const next: Record<number, DayState> = {};
        for (const d of DAY_ORDER) {
          next[d] = rowToState(rows.find((r) => r.day_of_week === d));
        }
        setDays(next);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [site]);

  const update = (dow: number, patch: Partial<DayState>) =>
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], ...patch } }));

  const handleSave = async () => {
    // Contrôle de cohérence avant enregistrement.
    for (const d of DAY_ORDER) {
      const s = days[d];
      if (!s || s.is_closed) continue;
      if (s.slot1 && s.slot1_end <= s.slot1_start) {
        toast({
          title: 'Horaires incohérents',
          description: `${DAY_LABELS[d]} : l'heure de fermeture de la 1re plage doit être après l'ouverture.`,
          variant: 'destructive',
        });
        return;
      }
      if (s.slot2 && s.slot2_end <= s.slot2_start) {
        toast({
          title: 'Horaires incohérents',
          description: `${DAY_LABELS[d]} : l'heure de fermeture de la 2e plage doit être après l'ouverture.`,
          variant: 'destructive',
        });
        return;
      }
      if (s.slot1 && s.slot2 && s.slot2_start < s.slot1_end && s.slot1_start < s.slot2_end) {
        toast({
          title: 'Plages qui se chevauchent',
          description: `${DAY_LABELS[d]} : les deux plages se chevauchent.`,
          variant: 'destructive',
        });
        return;
      }
      if (!s.slot1 && !s.slot2) {
        toast({
          title: 'Aucune plage définie',
          description: `${DAY_LABELS[d]} : activez une plage ou marquez le jour comme fermé.`,
          variant: 'destructive',
        });
        return;
      }
      const shortest = Math.min(
        s.slot1 ? s.slot1_end - s.slot1_start : Infinity,
        s.slot2 ? s.slot2_end - s.slot2_start : Infinity,
      );
      if (shortest < 90) {
        toast({
          title: 'Plage trop courte',
          description: `${DAY_LABELS[d]} : une plage doit durer au moins 1h30 pour proposer des créneaux.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = DAY_ORDER.map((d) => {
        const s = days[d];
        return {
          site,
          day_of_week: d,
          is_closed: s.is_closed,
          slot1_start: !s.is_closed && s.slot1 ? s.slot1_start : null,
          slot1_end: !s.is_closed && s.slot1 ? s.slot1_end : null,
          slot2_start: !s.is_closed && s.slot2 ? s.slot2_start : null,
          slot2_end: !s.is_closed && s.slot2 ? s.slot2_end : null,
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from('site_opening_hours')
        .upsert(payload, { onConflict: 'site,day_of_week' });
      if (error) throw error;

      toast({
        title: 'Horaires enregistrés',
        description: `Les horaires de ${site === 'conches' ? 'Conches' : 'Beaumont'} sont à jour.`,
      });
    } catch (err) {
      toast({
        title: "Échec de l'enregistrement",
        description: err instanceof Error ? err.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (availableSites.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Horaires d'ouverture
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Jusqu'à deux services par jour. Le premier créneau de retrait ou de livraison est
          proposé 45 minutes après l'ouverture, et les commandes se ferment 45 minutes avant la
          fermeture.
        </p>

        {availableSites.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {availableSites.map((s) => (
              <Button
                key={s}
                type="button"
                variant={site === s ? 'default' : 'outline'}
                size="sm"
                className="min-h-11"
                aria-pressed={site === s}
                onClick={() => setSite(s)}
              >
                {s === 'conches' ? 'Conches' : 'Beaumont'}
              </Button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="space-y-3">
            {DAY_ORDER.map((d) => {
              const s = days[d];
              if (!s) return null;
              return (
                <div key={d} className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-foreground">{DAY_LABELS[d]}</span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`closed-${d}`} className="text-sm text-muted-foreground">
                        Fermé
                      </Label>
                      <Switch
                        id={`closed-${d}`}
                        checked={s.is_closed}
                        onCheckedChange={(v) => update(d, { is_closed: v })}
                      />
                    </div>
                  </div>

                  {!s.is_closed && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Switch
                          id={`slot1-${d}`}
                          checked={s.slot1}
                          onCheckedChange={(v) => update(d, { slot1: v })}
                          aria-label={`Activer la première plage du ${DAY_LABELS[d]}`}
                        />
                        <Label htmlFor={`slot1-${d}`} className="text-sm w-20">
                          Plage 1
                        </Label>
                        <TimeSelect
                          value={s.slot1_start}
                          onChange={(v) => update(d, { slot1_start: v })}
                          label={`Ouverture plage 1 ${DAY_LABELS[d]}`}
                          disabled={!s.slot1}
                        />
                        <span className="text-muted-foreground">→</span>
                        <TimeSelect
                          value={s.slot1_end}
                          onChange={(v) => update(d, { slot1_end: v })}
                          label={`Fermeture plage 1 ${DAY_LABELS[d]}`}
                          disabled={!s.slot1}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Switch
                          id={`slot2-${d}`}
                          checked={s.slot2}
                          onCheckedChange={(v) => update(d, { slot2: v })}
                          aria-label={`Activer la deuxième plage du ${DAY_LABELS[d]}`}
                        />
                        <Label htmlFor={`slot2-${d}`} className="text-sm w-20">
                          Plage 2
                        </Label>
                        <TimeSelect
                          value={s.slot2_start}
                          onChange={(v) => update(d, { slot2_start: v })}
                          label={`Ouverture plage 2 ${DAY_LABELS[d]}`}
                          disabled={!s.slot2}
                        />
                        <span className="text-muted-foreground">→</span>
                        <TimeSelect
                          value={s.slot2_end}
                          onChange={(v) => update(d, { slot2_end: v })}
                          label={`Fermeture plage 2 ${DAY_LABELS[d]}`}
                          disabled={!s.slot2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving || loading} className="min-h-11">
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Enregistrer les horaires
        </Button>
      </CardContent>
    </Card>
  );
}
