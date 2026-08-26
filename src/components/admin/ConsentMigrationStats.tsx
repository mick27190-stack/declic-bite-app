import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { LEGAL_DOCS_VERSION } from '@/lib/consent';

interface Stats {
  total_clients: number;
  confirmed: number;
  pending: number;
}

/** Suivi de la régularisation RGPD des comptes existants. */
export default function ConsentMigrationStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('consent_migration_stats', {
        _version: LEGAL_DOCS_VERSION,
      });
      const row = Array.isArray(data) ? (data[0] as Stats | undefined) : null;
      if (!cancelled && row) setStats(row);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) return null;

  const rate =
    stats.total_clients > 0
      ? Math.round((stats.confirmed / stats.total_clients) * 100)
      : 0;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Régularisation RGPD
        </CardTitle>
        <CardDescription>
          Acceptation des conditions en version {LEGAL_DOCS_VERSION}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.total_clients}</p>
            <p className="text-xs text-muted-foreground">Comptes clients</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{stats.confirmed}</p>
            <p className="text-xs text-muted-foreground">Confirmés</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-destructive">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">En attente</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Taux de complétion : {rate}%
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
