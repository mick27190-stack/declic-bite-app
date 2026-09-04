/**
 * Carte de fidélité virtuelle.
 *
 * Le serveur (fonctions SQL `compute_loyalty_discount` / `preview_loyalty_discount`)
 * fait autorité : le front n'affiche que ce que le backend a calculé.
 */

export type LoyaltyCategory = 'senior' | 'mega' | 'super_mega';
export type LoyaltyRewardType = 'free_pizza' | 'discount_amount';

export interface LoyaltyProgram {
  id: string;
  site: string;
  category: LoyaltyCategory;
  enabled: boolean;
  start_date: string | null;
  end_date: string | null;
  required_count: number;
  reward_type: LoyaltyRewardType;
  discount_amount: number | null;
}

export interface LoyaltyProgress {
  id: string;
  customer_id: string;
  program_id: string;
  current_count: number;
}

export interface LoyaltyReward {
  id: string;
  customer_id: string;
  program_id: string;
  status: 'pending' | 'applied' | 'cancelled';
  created_at: string;
  applied_order_id: string | null;
}

/** Détail d'une remise fidélité stockée sur la commande (`orders.loyalty_discount`). */
export interface LoyaltyDiscountItem {
  program_id: string;
  category: LoyaltyCategory;
  reward_type: LoyaltyRewardType;
  amount: number;
  item_name?: string | null;
  size_id?: string | null;
}

export interface LoyaltyDiscount {
  total_discount: number;
  items: LoyaltyDiscountItem[];
  committed?: boolean;
}

export const LOYALTY_CATEGORIES: LoyaltyCategory[] = ['senior', 'mega', 'super_mega'];

export const CATEGORY_LABELS: Record<LoyaltyCategory, string> = {
  senior: 'Senior',
  mega: 'Méga',
  super_mega: 'Super Méga',
};

export const SITE_LABELS: Record<string, string> = {
  conches: 'Conches',
  beaumont: 'Beaumont',
};

export const LOYALTY_SITES = ['conches', 'beaumont'];

/** Taille panier (`senior` / `mega` / `super-mega`) → catégorie de programme. */
export function sizeToCategory(sizeId?: string | null): LoyaltyCategory | null {
  if (sizeId === 'senior') return 'senior';
  if (sizeId === 'mega') return 'mega';
  if (sizeId === 'super-mega') return 'super_mega';
  return null;
}

/** Date du jour (heure de Paris) au format ISO `YYYY-MM-DD`. */
export function parisToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts;
}

/**
 * Un programme est actif s'il est activé ET que la date du jour (Paris) est
 * comprise entre start_date et end_date, bornes incluses. Une borne vide vaut
 * « sans limite » de ce côté-là.
 */
export function isProgramActive(program: LoyaltyProgram, now: Date = new Date()): boolean {
  if (!program?.enabled) return false;
  const today = parisToday(now);
  if (program.start_date && today < program.start_date) return false;
  if (program.end_date && today > program.end_date) return false;
  return true;
}

export function rewardLabel(program: Pick<LoyaltyProgram, 'reward_type' | 'discount_amount' | 'category'>): string {
  if (program.reward_type === 'discount_amount') {
    return `${Number(program.discount_amount ?? 0).toFixed(2)}€ de remise sur une pizza ${CATEGORY_LABELS[program.category]}`;
  }
  return `1 pizza ${CATEGORY_LABELS[program.category]} offerte`;
}

/** Libellé court d'une remise appliquée à une commande. */
export function discountLineLabel(discount: LoyaltyDiscount | null | undefined): string | null {
  if (!discount || !discount.items?.length) return null;
  const freeCount = discount.items.filter((i) => i.reward_type === 'free_pizza').length;
  const others = discount.items.length - freeCount;
  const parts: string[] = [];
  if (freeCount > 0) parts.push(`${freeCount} pizza${freeCount > 1 ? 's' : ''} offerte${freeCount > 1 ? 's' : ''}`);
  if (others > 0) parts.push(`${others} remise${others > 1 ? 's' : ''} fidélité`);
  return parts.join(' + ') || 'Remise fidélité';
}

/** Normalise la colonne JSONB `orders.loyalty_discount`. */
export function parseLoyaltyDiscount(raw: unknown): LoyaltyDiscount | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as any;
  const total = Number(value.total_discount ?? 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    total_discount: total,
    items: Array.isArray(value.items) ? value.items : [],
    committed: value.committed === true,
  };
}

// ---------------------------------------------------------------------------
// Exports (vue d'ensemble admin)
// ---------------------------------------------------------------------------

export interface LoyaltyOverviewRow {
  customerName: string;
  phone: string;
  email: string;
  site: string;
  category: LoyaltyCategory;
  currentCount: number;
  requiredCount: number;
  pendingRewards: number;
}

const csvCell = (value: unknown) => {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
};

export function buildLoyaltyCsv(rows: LoyaltyOverviewRow[]): Blob {
  const header = ['Client', 'Téléphone', 'Email', 'Site', 'Catégorie', 'Progression', 'Récompenses en attente'];
  const lines = rows.map((r) =>
    [
      r.customerName,
      r.phone,
      r.email,
      SITE_LABELS[r.site] ?? r.site,
      CATEGORY_LABELS[r.category],
      `${r.currentCount}/${r.requiredCount}`,
      r.pendingRewards,
    ]
      .map(csvCell)
      .join(';'),
  );
  const csv = '\uFEFF' + [header.map(csvCell).join(';'), ...lines].join('\r\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
