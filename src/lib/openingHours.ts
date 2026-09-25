// Horaires d'ouverture paramétrables par établissement.
// Chaque jour peut comporter 0, 1 ou 2 plages de service (ex. midi + soir).
// Toutes les valeurs sont exprimées en minutes depuis minuit (heure de Paris).

export type SiteId = 'conches' | 'beaumont';

export interface ServiceWindow {
  start: number;
  end: number;
}

export interface DayOpeningHours {
  site: SiteId;
  /** 0 = dimanche … 6 = samedi (identique à EXTRACT(DOW) côté serveur). */
  day_of_week: number;
  is_closed: boolean;
  slot1_start: number | null;
  slot1_end: number | null;
  slot2_start: number | null;
  slot2_end: number | null;
}

/** Plage historique par défaut : 18h00 – 22h00, fermé le lundi. */
export const DEFAULT_WINDOW: ServiceWindow = { start: 18 * 60, end: 22 * 60 };

export const DAY_LABELS = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

/** Ordre d'affichage : du lundi au dimanche. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

/** "18:00" -> "18h", "18:30" -> "18h30" */
export function minutesToHuman(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h${mm.toString().padStart(2, '0')}`;
}

export function labelToMinutes(label: string): number {
  const [h, m] = label.split(':').map(Number);
  return h * 60 + m;
}

/** Jour de la semaine (0-6) à Paris. */
export function parisDayOfWeek(now: Date = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
  }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short);
}

/** Plages valides d'un jour, triées par heure de début. */
export function windowsForDay(row: DayOpeningHours | undefined | null): ServiceWindow[] {
  if (!row) return [];
  if (row.is_closed) return [];
  const out: ServiceWindow[] = [];
  if (row.slot1_start != null && row.slot1_end != null && row.slot1_end > row.slot1_start) {
    out.push({ start: row.slot1_start, end: row.slot1_end });
  }
  if (row.slot2_start != null && row.slot2_end != null && row.slot2_end > row.slot2_start) {
    out.push({ start: row.slot2_start, end: row.slot2_end });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Plage en cours à l'instant donné, sinon null. */
export function activeWindow(windows: ServiceWindow[], nowMinutes: number): ServiceWindow | null {
  return windows.find((w) => nowMinutes >= w.start && nowMinutes < w.end) ?? null;
}

/** Prochaine plage du jour (non encore commencée), sinon null. */
export function nextWindowToday(
  windows: ServiceWindow[],
  nowMinutes: number,
): ServiceWindow | null {
  return windows.find((w) => nowMinutes < w.start) ?? null;
}

/**
 * Plage de référence pour le calcul des créneaux : la plage en cours, sinon la
 * prochaine plage du jour, sinon la première plage du jour (service suivant).
 */
export function referenceWindow(
  windows: ServiceWindow[],
  nowMinutes: number,
): ServiceWindow | null {
  return activeWindow(windows, nowMinutes) ?? nextWindowToday(windows, nowMinutes) ?? windows[0] ?? null;
}

/** Ex. "11h30-14h & 18h-22h" ou "Fermé". */
export function formatWindows(windows: ServiceWindow[]): string {
  if (windows.length === 0) return 'Fermé';
  return windows
    .map((w) => `${minutesToHuman(w.start)}-${minutesToHuman(w.end)}`)
    .join(' & ');
}
