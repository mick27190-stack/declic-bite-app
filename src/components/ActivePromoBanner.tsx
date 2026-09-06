import { promoMatchesDate, getRawSizePrice, type DayPromo } from '@/lib/pricing';
import { isPromoDay, PROMO_LABEL } from '@/lib/promo';
import { usePricing } from '@/contexts/PricingContext';
import { RetractableBanner } from '@/components/RetractableBanner';

const SIZE_LABELS: Record<string, string> = {
  senior: 'Senior',
  mega: 'Méga',
  'super-mega': 'Super Méga',
};

function formatPrice(value: number): string {
  return `${value.toFixed(2).replace('.', ',').replace(/,00$/, '')}€`;
}

/** Message par défaut d'une promo lorsque l'admin n'a pas saisi de message. */
export function defaultPromoMessage(promo: Pick<DayPromo, 'size_id' | 'promo_type' | 'price'>): string {
  const size = SIZE_LABELS[promo.size_id] ?? promo.size_id;
  if (promo.promo_type === 'second_half') return `${size} : la 2ᵉ à -50% !`;
  if (promo.promo_type === 'bogo') return `${size} : 1 achetée = 1 offerte !`;
  const price = promo.price ?? getRawSizePrice(promo.size_id);
  return `${size} à ${formatPrice(price)} !`;
}

export function buildPromoMessage(promo: DayPromo): string {
  return promo.label?.trim() || defaultPromoMessage(promo);
}

/** Bannière verte réutilisable (client + aperçu admin). */
export function PromoBanner({ messages, className = '' }: { messages: string[]; className?: string }) {
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

/**
 * Bannière verte affichant les promotions actives du jour (promos par jour de
 * la semaine configurées en admin + promo historique du mardi).
 */
export function ActivePromoBanner({ className = '' }: { className?: string }) {
  const { dayPromos } = usePricing();
  const now = new Date();

  const active = dayPromos.filter((p) => promoMatchesDate(p, now));
  const messages = active.map(buildPromoMessage);

  const hasSeniorPromo = active.some((p) => p.size_id === 'senior');
  if (!hasSeniorPromo && isPromoDay(now)) {
    messages.unshift(PROMO_LABEL);
  }

  return (
    <RetractableBanner
      visible={messages.length > 0}
      tone="green"
      className={className}
      summary={<span className="truncate">🎉 Promotions du jour</span>}
    >
      <PromoBanner messages={messages} />
    </RetractableBanner>
  );
}

export default ActivePromoBanner;
