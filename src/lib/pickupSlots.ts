// Pure helpers for computing take-away pickup slots.
// Extracted so the edge-case logic can be unit-tested.

export const FIRST_SLOT_MINUTES = 18 * 60 + 45; // 18:45
export const LAST_SLOT_MINUTES = 21 * 60 + 30; // 21:30
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
// Late-evening take-away window: from 21h16 (inclusive) up to the 21h31
// cut-off, only the last 21h30 slot remains selectable.
// From 21h15 (inclusive) up to the 21h17 take-away cut-off, only the last
// 21h30 slot remains selectable (proposed as "Dès que possible").
const LATE_TAKEAWAY_WINDOW_START = 21 * 60 + 15; // 21:15
const LATE_TAKEAWAY_CUTOFF = 21 * 60 + 17; // 21:17

export function computePickupSlotsFromMinutes(nowMinutes: number): string[] {
  // Between 21h16 and 21h30 included, only propose the 21h30 slot.
  if (
    nowMinutes >= LATE_TAKEAWAY_WINDOW_START &&
    nowMinutes < LATE_TAKEAWAY_CUTOFF
  ) {
    return [minutesToLabel(LAST_SLOT_MINUTES)];
  }

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

export function computePickupSlots(now: Date = new Date()): string[] {
  return computePickupSlotsFromMinutes(parisMinutes(now));
}

export interface PickupSlot {
  time: string;
  disabled: boolean;
}

/**
 * Return every take-away slot for the current service, marking those the
 * customer cannot pick (past the earliest-lead time, or — from 21h16 —
 * every slot except the final 21h30 one).
 */
export function computePickupSlotOptionsFromMinutes(nowMinutes: number): PickupSlot[] {
  const inLateWindow =
    nowMinutes >= LATE_TAKEAWAY_WINDOW_START && nowMinutes < LATE_TAKEAWAY_CUTOFF;
  const earliestAllowed = earliestAllowedMinutes(nowMinutes);

  const slots: PickupSlot[] = [];
  for (let m = FIRST_SLOT_MINUTES; m <= LAST_SLOT_MINUTES; m += SLOT_INTERVAL) {
    const disabled = inLateWindow
      ? m !== LAST_SLOT_MINUTES
      : earliestAllowed > FIRST_SLOT_MINUTES && m < earliestAllowed;
    slots.push({ time: minutesToLabel(m), disabled });
  }
  return slots;
}

export function computePickupSlotOptions(now: Date = new Date()): PickupSlot[] {
  return computePickupSlotOptionsFromMinutes(parisMinutes(now));
}

// ---------------- Delivery slots ----------------
// Delivery uses a 30-minute lead time and a 18:45 → 21:45 window.
export const DELIVERY_FIRST_SLOT_MINUTES = 18 * 60 + 45; // 18:45
export const DELIVERY_LAST_SLOT_MINUTES = 21 * 60 + 45; // 21:45
export const DELIVERY_LEAD_MINUTES = 30;

function toLabel(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

/**
 * Earliest deliverable time (rounded up to the next 15 min slot),
 * respecting the 30-minute lead.
 * Ex: 18:00 -> 18:30, 19:23 -> 20:00, 20:32 -> 21:15.
 */
export function earliestDeliveryMinutes(nowMinutes: number): number {
  return Math.ceil((nowMinutes + DELIVERY_LEAD_MINUTES) / SLOT_INTERVAL) * SLOT_INTERVAL;
}

export interface DeliverySlots {
  asap: string;      // "Dès que possible" target time (may be 18:30 before service)
  slots: string[];   // fixed grid slots strictly after ASAP, capped at 21:45
}

export function computeDeliverySlotsFromMinutes(nowMinutes: number): DeliverySlots {
  const openingMinutes = 18 * 60; // 18:00
  const rawEarliest = nowMinutes < openingMinutes
    ? openingMinutes + DELIVERY_LEAD_MINUTES
    : earliestDeliveryMinutes(nowMinutes);

  // Never propose a delivery before the first slot (18:45), and never after the last one.
  const asapMinutes = Math.min(
    Math.max(rawEarliest, DELIVERY_FIRST_SLOT_MINUTES),
    DELIVERY_LAST_SLOT_MINUTES,
  );


  const slots: string[] = [];
  for (let m = DELIVERY_FIRST_SLOT_MINUTES; m <= DELIVERY_LAST_SLOT_MINUTES; m += SLOT_INTERVAL) {
    if (m <= asapMinutes) continue;
    slots.push(toLabel(m));
  }
  return { asap: toLabel(asapMinutes), slots };
}

export function computeDeliverySlots(now: Date = new Date()): DeliverySlots {
  return computeDeliverySlotsFromMinutes(parisMinutes(now));
}

// ---------------- Delivery slot validation (mirrors the backend) ----------------
// Same rules as public.check_order_creation_cutoff for 'livraison':
//  - a slot is required and must be formatted HH:MM,
//  - it must sit on the 15-min grid between 18:45 and 21:45,
//  - it must be >= max(now + 30 min rounded up, 18:45) — the 18h45 floor is the
//    same clamp the backend applies, so 18:30 is never valid, even at 18h00.
export const DELIVERY_SLOT_REQUIRED_MESSAGE = 'Merci de choisir un créneau de livraison.';
export const DELIVERY_SLOT_RANGE_MESSAGE =
  'Créneau de livraison invalide. Choisissez un créneau entre 18h45 et 21h45.';
export const DELIVERY_SLOT_TOO_EARLY_MESSAGE =
  "Ce créneau de livraison n'est plus disponible. Merci d'en choisir un autre.";

export type DeliverySlotValidation = { valid: boolean; error?: string };

/**
 * Earliest delivery time actually bookable, clamped so it never falls below
 * the 18h45 first slot (identical to the backend's GREATEST(..., 18h45)).
 */
export function earliestBookableDeliveryMinutes(nowMinutes: number): number {
  return Math.max(earliestDeliveryMinutes(nowMinutes), DELIVERY_FIRST_SLOT_MINUTES);
}

export function validateDeliverySlotFromMinutes(
  slot: string | null | undefined,
  nowMinutes: number,
): DeliverySlotValidation {
  if (!slot || !/^\d{2}:\d{2}$/.test(slot)) {
    return { valid: false, error: DELIVERY_SLOT_REQUIRED_MESSAGE };
  }
  const [h, m] = slot.split(':').map(Number);
  const slotMinutes = h * 60 + m;

  if (
    slotMinutes < DELIVERY_FIRST_SLOT_MINUTES ||
    slotMinutes > DELIVERY_LAST_SLOT_MINUTES ||
    slotMinutes % SLOT_INTERVAL !== 0
  ) {
    return { valid: false, error: DELIVERY_SLOT_RANGE_MESSAGE };
  }

  if (slotMinutes < earliestBookableDeliveryMinutes(nowMinutes)) {
    return { valid: false, error: DELIVERY_SLOT_TOO_EARLY_MESSAGE };
  }

  return { valid: true };
}

export function validateDeliverySlot(
  slot: string | null | undefined,
  now: Date = new Date(),
): DeliverySlotValidation {
  return validateDeliverySlotFromMinutes(slot, parisMinutes(now));
}

