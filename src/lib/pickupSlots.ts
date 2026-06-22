// Pure helpers for computing take-away pickup slots.
// Extracted so the edge-case logic can be unit-tested.

export const FIRST_SLOT_MINUTES = 18 * 60 + 30; // 18:30
export const LAST_SLOT_MINUTES = 21 * 60 + 45; // 21:45
export const SLOT_INTERVAL = 15; // minutes
export const MIN_LEAD_MINUTES = 15; // minimum delay before the first available slot

function minutesToLabel(m: number): string {
  const hour = Math.floor(m / 60);
  const minutes = m % 60;
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Earliest slot (in minutes since midnight) that respects the minimum lead time,
 * rounded up to the next 15-minute slot.
 * Ex: 21h13 -> 21h13 + 15 = 21h28 -> arrondi -> 21h30.
 */
export function earliestAllowedMinutes(nowMinutes: number): number {
  return Math.ceil((nowMinutes + MIN_LEAD_MINUTES) / SLOT_INTERVAL) * SLOT_INTERVAL;
}

/**
 * Minutes since midnight for the given instant, expressed in the
 * restaurant's timezone (Europe/Paris) regardless of the device timezone.
 */
export function parisMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/**
 * Compute the list of selectable pickup time labels for a given moment.
 * - During service, all slots strictly before the earliest allowed time are blocked.
 * - Outside service (or after the last slot is no longer reachable), the full
 *   slot list for the next service is returned.
 *
 * The current time is always interpreted in the restaurant's timezone
 * (Europe/Paris) so the proposed slots stay coherent on any device.
 */
export function computePickupSlots(now: Date = new Date()): string[] {
  const nowMinutes = parisMinutes(now);
  const earliestAllowed = earliestAllowedMinutes(nowMinutes);

  const times: string[] = [];
  for (let m = FIRST_SLOT_MINUTES; m <= LAST_SLOT_MINUTES; m += SLOT_INTERVAL) {
    // Block slots earlier than the earliest reachable one for the current evening.
    if (earliestAllowed > FIRST_SLOT_MINUTES && m < earliestAllowed) continue;
    times.push(minutesToLabel(m));
  }

  // Outside service hours, fall back to the full slot list for the next service.
  if (times.length === 0) {
    for (let m = FIRST_SLOT_MINUTES; m <= LAST_SLOT_MINUTES; m += SLOT_INTERVAL) {
      times.push(minutesToLabel(m));
    }
  }

  return times;
}
