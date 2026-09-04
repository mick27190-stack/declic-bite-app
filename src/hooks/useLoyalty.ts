import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  isProgramActive,
  type LoyaltyProgram,
  type LoyaltyProgress,
  type LoyaltyReward,
} from '@/lib/loyalty';

export interface LoyaltyCardEntry {
  program: LoyaltyProgram;
  currentCount: number;
  pendingRewards: number;
}

/**
 * Carte de fidélité du client connecté pour un site donné.
 * Ne renvoie que les programmes réellement actifs (activés + dans la période).
 */
export function useLoyaltyCard(site?: string | null) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LoyaltyCardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!site) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: programs } = await supabase
        .from('loyalty_programs')
        .select('*')
        .eq('site', site);

      const all = (programs ?? []) as unknown as LoyaltyProgram[];
      const active = all.filter((p) => isProgramActive(p));

      if (all.length === 0 || !user) {
        setEntries(active.map((program) => ({ program, currentCount: 0, pendingRewards: 0 })));
        return;
      }

      const ids = all.map((p) => p.id);
      const [{ data: progress }, { data: rewards }] = await Promise.all([
        supabase
          .from('customer_loyalty_progress')
          .select('*')
          .eq('customer_id', user.id)
          .in('program_id', ids),
        supabase
          .from('loyalty_rewards_pending')
          .select('*')
          .eq('customer_id', user.id)
          .eq('status', 'pending')
          .in('program_id', ids),
      ]);

      const progressList = (progress ?? []) as unknown as LoyaltyProgress[];
      const rewardList = (rewards ?? []) as unknown as LoyaltyReward[];

      setEntries(
        all
          .map((program) => ({
            program,
            currentCount:
              progressList.find((p) => p.program_id === program.id)?.current_count ?? 0,
            pendingRewards: rewardList.filter((r) => r.program_id === program.id).length,
          }))
          // Programmes actifs, ou terminés/désactivés mais avec une récompense
          // déjà acquise (utilisable sur la prochaine commande).
          .filter(({ program, pendingRewards }) => isProgramActive(program) || pendingRewards > 0),
      );
    } finally {
      setLoading(false);
    }
  }, [site, user]);

  useEffect(() => {
    load();
  }, [load]);

  return { entries, loading, refresh: load, hasActiveProgram: entries.length > 0 };
}

export interface LoyaltyHistoryEntry {
  reward: LoyaltyReward;
  program: LoyaltyProgram | null;
}

/**
 * Historique des récompenses du client connecté (appliquées et annulées),
 * toutes tailles confondues, filtré par site si fourni.
 */
export function useLoyaltyHistory(site?: string | null) {
  const { user } = useAuth();
  const [history, setHistory] = useState<LoyaltyHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data: rewards } = await supabase
        .from('loyalty_rewards_pending')
        .select('*')
        .eq('customer_id', user.id)
        .in('status', ['applied', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (cancelled) return;
      const rewardList = (rewards ?? []) as unknown as LoyaltyReward[];
      const programIds = [...new Set(rewardList.map((r) => r.program_id))];

      let programs: LoyaltyProgram[] = [];
      if (programIds.length > 0) {
        const { data } = await supabase
          .from('loyalty_programs')
          .select('*')
          .in('id', programIds);
        programs = (data ?? []) as unknown as LoyaltyProgram[];
      }
      if (cancelled) return;

      setHistory(
        rewardList
          .map((reward) => ({
            reward,
            program: programs.find((p) => p.id === reward.program_id) ?? null,
          }))
          .filter((entry) => !site || entry.program?.site === site),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, site]);

  return { history, loading };
}

/** Aperçu (non engageant) de la remise fidélité applicable au panier courant. */
export function useLoyaltyPreview(site?: string | null, items?: unknown[]) {
  const { user } = useAuth();
  const [discount, setDiscount] = useState<{ total: number; count: number }>({ total: 0, count: 0 });

  useEffect(() => {
    let cancelled = false;
    if (!user || !site || !items || items.length === 0) {
      setDiscount({ total: 0, count: 0 });
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc('preview_loyalty_discount' as any, {
        _site: site,
        _items: items as any,
      });
      if (cancelled || error || !data) return;
      const payload = data as any;
      setDiscount({
        total: Number(payload.total_discount ?? 0),
        count: Array.isArray(payload.items) ? payload.items.length : 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, site, JSON.stringify(items ?? [])]);

  return discount;
}
