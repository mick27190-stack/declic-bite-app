import { usePricing } from '@/contexts/PricingContext';
import { promoMatchesDate, getRawSizePrice, type DayPromo } from '@/lib/pricing';
import { isPromoDay, PROMO_LABEL } from '@/lib/promo';

const SIZE_LABELS: Record<string, string> = {
  senior: 'Senior',
  mega: 'Méga',
  'super-mega': 'Super Méga',
};

function formatPrice(value: number): string {
  return `${value.toFixed(2).replace('.', ',').replace(/,00$/, '')}€`;
}

export function buildPromoMessage(promo: DayPromo): string {
  if (promo.label) return promo.label;
  const size = SIZE_LABELS[promo.size_id] ?? promo.size_id;
  if (promo.promo_type === 'second_half') return `${size} : la 2ᵉ à -50% !`;
  if (promo.promo_type === 'bogo') return `${size} : 1 achetée = 1 offerte !`;
  const price = promo.price ?? getRawSizePrice(promo.size_id);
  return `${size} à ${formatPrice(price)} !`;
}

interface Props {
  className?: string;
}

/**
 * Bannière verte affichant les promotions actives du jour (promos par jour de
 * la semaine configurées en admin + promo historique du mardi).
 */
export function ActivePromoBanner({ className = '' }: Props) {
  const { dayPromos } = usePricing();
  const now = new Date();

  const active = dayPromos.filter((p) => promoMatchesDate(p, now));
  const messages = active.map(buildPromoMessage);

  const hasSeniorPromo = active.some((p) => p.size_id === 'senior');
  if (!hasSeniorPromo && isPromoDay(now)) {
    messages.unshift(PROMO_LABEL);
  }

  if (messages.length === 0) return null;

  return (
    <div className={`p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-center space-y-1 ${className}`}>
      {messages.map((m, i) => (
        <p key={i} className="text-xs sm:text-sm font-bold text-green-600 text-balance leading-tight">
          🎉 {m}
        </p>
      ))}
    </div>
  );
}

export default ActivePromoBanner;
