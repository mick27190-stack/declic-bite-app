import { parisCivilDate } from './parisTime';

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function frenchHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const plus = (days: number) => {
    const d = new Date(easter);
    d.setDate(d.getDate() + days);
    return d;
  };
  return new Set([
    `${year}-01-01`,
    iso(plus(1)),
    `${year}-05-01`,
    `${year}-05-08`,
    iso(plus(39)),
    iso(plus(50)),
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ]);
}

/**
 * Créneau d'envoi des SMS promotionnels : 8h–20h heure de Paris,
 * hors dimanche et jours fériés français. Renvoie le motif du refus,
 * ou `null` si l'envoi est possible.
 */
export function smsSendWindowError(now: Date = new Date()): string | null {
  const paris = parisCivilDate(now);
  if (paris.getDay() === 0) {
    return 'Envoi interdit le dimanche.';
  }
  if (frenchHolidays(paris.getFullYear()).has(iso(paris))) {
    return 'Envoi interdit un jour férié.';
  }
  const hour = paris.getHours();
  if (hour < 8 || hour >= 20) {
    return 'Envoi possible uniquement entre 8h et 20h (heure de Paris).';
  }
  return null;
}
