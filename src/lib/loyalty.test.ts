import { describe, expect, it } from 'vitest';
import {
  CATEGORY_LABELS,
  discountLineLabel,
  isProgramActive,
  parseLoyaltyDiscount,
  sizeToCategory,
  type LoyaltyDiscount,
  type LoyaltyProgram,
} from './loyalty';

/**
 * Règles couvertes :
 *  - cas « dernier jour » : le programme reste actif le jour de sa date de fin,
 *    et une récompense déjà acquise reste affichée / utilisable ensuite ;
 *  - cumul simultané des remises par taille dans une même commande.
 */

const program = (overrides: Partial<LoyaltyProgram> = {}): LoyaltyProgram => ({
  id: 'prog-senior',
  site: 'conches',
  category: 'senior',
  enabled: true,
  start_date: null,
  end_date: null,
  required_count: 10,
  reward_type: 'free_pizza',
  discount_amount: null,
  ...overrides,
});

/**
 * Miroir de la règle d'affichage client (`useLoyaltyCard`) : une carte reste
 * visible si le programme est actif OU s'il reste une récompense en attente.
 */
const isCardVisible = (p: LoyaltyProgram, pendingRewards: number, now: Date) =>
  isProgramActive(p, now) || pendingRewards > 0;

describe('fidélité — cas « dernier jour »', () => {
  const lastDay = new Date('2026-09-30T20:00:00+02:00'); // 30/09 à Paris
  const dayAfter = new Date('2026-10-01T08:00:00+02:00');

  it('le programme est encore actif le jour de sa date de fin', () => {
    const p = program({ end_date: '2026-09-30' });
    expect(isProgramActive(p, lastDay)).toBe(true);
  });

  it('juste avant minuit heure de Paris (soit après minuit UTC+2 → UTC) reste le dernier jour', () => {
    const p = program({ end_date: '2026-09-30' });
    // 30/09 23h30 Paris = 21h30 UTC : la date de Paris fait foi.
    expect(isProgramActive(p, new Date('2026-09-30T21:30:00Z'))).toBe(true);
  });

  it('le programme devient inactif le lendemain de la date de fin', () => {
    const p = program({ end_date: '2026-09-30' });
    expect(isProgramActive(p, dayAfter)).toBe(false);
  });

  it('une récompense acquise le dernier jour reste visible après la fin du programme', () => {
    const p = program({ end_date: '2026-09-30' });
    expect(isCardVisible(p, 1, dayAfter)).toBe(true);
    // Programme désactivé manuellement, sans dates : idem tant qu'il reste une récompense.
    expect(isCardVisible(program({ enabled: false }), 1, dayAfter)).toBe(true);
  });

  it('sans récompense en attente, la carte disparaît une fois le programme terminé', () => {
    expect(isCardVisible(program({ end_date: '2026-09-30' }), 0, dayAfter)).toBe(false);
    expect(isCardVisible(program({ enabled: false }), 0, dayAfter)).toBe(false);
  });

  it("le programme n'est pas actif avant sa date de début", () => {
    const p = program({ start_date: '2026-10-05', end_date: '2026-10-31' });
    expect(isProgramActive(p, dayAfter)).toBe(false);
    expect(isProgramActive(p, new Date('2026-10-05T18:00:00+02:00'))).toBe(true);
  });
});

describe('fidélité — cumul des remises par taille dans une même commande', () => {
  it('associe chaque taille de pizza à sa catégorie de programme', () => {
    expect(sizeToCategory('senior')).toBe('senior');
    expect(sizeToCategory('mega')).toBe('mega');
    expect(sizeToCategory('super-mega')).toBe('super_mega');
    expect(sizeToCategory('junior')).toBeNull();
  });

  it('additionne les trois remises (Senior + Méga + Super Méga) d’une même commande', () => {
    const raw = {
      total_discount: 47.5,
      committed: true,
      items: [
        { program_id: 'p1', category: 'senior', reward_type: 'free_pizza', amount: 13.5, size_id: 'senior' },
        { program_id: 'p2', category: 'mega', reward_type: 'free_pizza', amount: 20, size_id: 'mega' },
        { program_id: 'p3', category: 'super_mega', reward_type: 'discount_amount', amount: 14, size_id: 'super-mega' },
      ],
    };

    const discount = parseLoyaltyDiscount(raw) as LoyaltyDiscount;
    expect(discount).not.toBeNull();
    expect(discount.items).toHaveLength(3);
    expect(discount.committed).toBe(true);

    // Total = somme des lignes, et une seule remise par taille.
    const sum = discount.items.reduce((acc, i) => acc + i.amount, 0);
    expect(Number(sum.toFixed(2))).toBe(discount.total_discount);
    const categories = discount.items.map((i) => i.category).sort();
    expect(categories).toEqual(['mega', 'senior', 'super_mega']);
    expect(new Set(categories).size).toBe(3);
  });

  it('libelle le cumul « 2 pizzas offertes + 1 remise fidélité »', () => {
    const discount = parseLoyaltyDiscount({
      total_discount: 47.5,
      items: [
        { program_id: 'p1', category: 'senior', reward_type: 'free_pizza', amount: 13.5 },
        { program_id: 'p2', category: 'mega', reward_type: 'free_pizza', amount: 20 },
        { program_id: 'p3', category: 'super_mega', reward_type: 'discount_amount', amount: 14 },
      ],
    });
    expect(discountLineLabel(discount)).toBe('2 pizzas offertes + 1 remise fidélité');
  });

  it('ignore une remise nulle et libelle correctement une remise unique', () => {
    expect(parseLoyaltyDiscount({ total_discount: 0, items: [] })).toBeNull();
    expect(parseLoyaltyDiscount(null)).toBeNull();
    expect(
      discountLineLabel({
        total_discount: 13.5,
        items: [{ program_id: 'p1', category: 'senior', reward_type: 'free_pizza', amount: 13.5 }],
      }),
    ).toBe('1 pizza offerte');
  });

  it('les libellés de catégorie couvrent les trois tailles cumulables', () => {
    expect(CATEGORY_LABELS.senior).toBe('Senior');
    expect(CATEGORY_LABELS.mega).toBe('Méga');
    expect(CATEGORY_LABELS.super_mega).toBe('Super Méga');
  });
});
