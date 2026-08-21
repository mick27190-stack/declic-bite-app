/**
 * Helpers de fuseau horaire : toute la logique métier (promos, créneaux,
 * jours de fermeture) doit raisonner en heure de Paris, quel que soit le
 * fuseau de l'appareil du client.
 */

const PARIS_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Renvoie une Date dont les champs locaux (getFullYear/getMonth/getDate/
 * getDay/getHours...) correspondent à l'heure murale de Paris.
 * À n'utiliser que pour lire des composantes calendaires, pas pour stocker.
 */
export function parisCivilDate(date: Date = new Date()): Date {
  const parts = PARIS_PARTS.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hour = get('hour') % 24; // "24" possible sur certains moteurs
  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
    0,
  );
}

/** Date ISO (YYYY-MM-DD) du jour à Paris. */
export function parisIsoDate(date: Date = new Date()): string {
  const d = parisCivilDate(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Jour de la semaine à Paris (0 = dimanche). */
export function parisDayOfWeek(date: Date = new Date()): number {
  return parisCivilDate(date).getDay();
}
