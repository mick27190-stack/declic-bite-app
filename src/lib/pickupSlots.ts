// Pure helpers for computing take-away and delivery slots.
// Les bornes sont dérivées de la plage de service en cours (paramétrable par
// établissement dans l'administration) : par défaut 18h00 – 22h00.

import { DEFAULT_WINDOW, ServiceWindow, minutesToHuman } from './openingHours';

export const SLOT_INTERVAL = 15; // minutes
export const MIN_LEAD_MINUTES = 15; // minimum delay before the first available slot
/** Marge entre l'ouverture et le premier créneau proposé. */
export const OPENING_LEAD_MINUTES = 45;
/** Marge entre le dernier retrait et la fermeture. */
export const TAKEAWAY_CLOSING_MARGIN = 30;

// Bornes historiques (plage 18h-22h), conservées pour compatibilité.
export const FIRST_SLOT_MINUTES = 18 * 60 + 45; // 18:45
export const LAST_SLOT_MINUTES = 21 * 60 + 30; // 21:30

export function pickupFirstSlot(win: ServiceWindow = DEFAULT_WINDOW): number {
  return win.start + OPENING_LEAD_MINUTES;
}

export function pickupLastSlot(win: ServiceWindow = DEFAULT_WINDOW): number {
  return win.end - TAKEAWAY_CLOSING_MARGIN;
}

function minutesToLabel(m: number): string {
  const hour = Math.floor(m / 60);
  const minutes = m % 60;
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Earliest slot (in minutes since midnight) that respects the minimum lead time,
 * rounded up to the next 15-minute slot.
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

// Fenêtre de fin de service à emporter : sur les 15 dernières minutes avant la
// coupure, seul le dernier créneau reste sélectionnable.
function lateTakeawayStart(win: ServiceWindow): number {
  return pickupLastSlot(win) - 15;
}
function lateTakeawayCutoff(win: ServiceWindow): number {
  return pickupLastSlot(win) - 13;
}

export function computePickupSlotsFromMinutes(
  nowMinutes: number,
  win: ServiceWindow = DEFAULT_WINDOW,
): string[] {
  const first = pickupFirstSlot(win);
  const last = pickupLastSlot(win);

  if (nowMinutes >= lateTakeawayStart(win) && nowMinutes < lateTakeawayCutoff(win)) {
    return [minutesToLabel(last)];
  }

  const earliestAllowed = earliestAllowedMinutes(nowMinutes);

  const times: string[] = [];
  for (let m = first; m <= last; m += SLOT_INTERVAL) {
    if (earliestAllowed > first && m < earliestAllowed) continue;
    times.push(minutesToLabel(m));
  }

  // Outside service hours, fall back to the full slot list for the next service.
  if (times.length === 0) {
    for (let m = first; m <= last; m += SLOT_INTERVAL) {
      times.push(minutesToLabel(m));
    }
  }

  return times;
}

export function computePickupSlots(
  now: Date = new Date(),
  win: ServiceWindow = DEFAULT_WINDOW,
): string[] {
  return computePickupSlotsFromMinutes(parisMinutes(now), win);
}

export interface PickupSlot {
  time: string;
  disabled: boolean;
}

export function computePickupSlotOptionsFromMinutes(
  nowMinutes: number,
  win: ServiceWindow = DEFAULT_WINDOW,
): PickupSlot[] {
  const first = pickupFirstSlot(win);
  const last = pickupLastSlot(win);
  const inLateWindow =
    nowMinutes >= lateTakeawayStart(win) && nowMinutes < lateTakeawayCutoff(win);
  const earliestAllowed = earliestAllowedMinutes(nowMinutes);

  const slots: PickupSlot[] = [];
  for (let m = first; m <= last; m += SLOT_INTERVAL) {
    const disabled = inLateWindow
      ? m !== last
      : earliestAllowed > first && m < earliestAllowed;
    slots.push({ time: minutesToLabel(m), disabled });
  }
  return slots;
}

export function computePickupSlotOptions(
  now: Date = new Date(),
  win: ServiceWindow = DEFAULT_WINDOW,
): PickupSlot[] {
  return computePickupSlotOptionsFromMinutes(parisMinutes(now), win);
}

// ---------------- Delivery slots ----------------
// La livraison utilise un délai de 45 minutes et la plage [ouverture+45 ; fermeture].
export const DELIVERY_FIRST_SLOT_MINUTES = 18 * 60 + 45; // 18:45
export const DELIVERY_LAST_SLOT_MINUTES = 22 * 60; // 22:00
export const DELIVERY_LEAD_MINUTES = 45;
// A slot stays bookable during the first 8 minutes of each quarter-hour.
export const DELIVERY_SLOT_GRACE_MINUTES = 8;

export function deliveryFirstSlot(win: ServiceWindow = DEFAULT_WINDOW): number {
  return win.start + OPENING_LEAD_MINUTES;
}
export function deliveryLastSlot(win: ServiceWindow = DEFAULT_WINDOW): number {
  return win.end;
}

function toLabel(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

/**
 * Earliest deliverable time, respecting the 45-minute lead with an 8-minute
 * grace on the current quarter-hour.
 */
export function earliestDeliveryMinutes(nowMinutes: number): number {
  const quarter = Math.floor(nowMinutes / SLOT_INTERVAL) * SLOT_INTERVAL;
  const base =
    nowMinutes - quarter <= DELIVERY_SLOT_GRACE_MINUTES ? quarter : quarter + SLOT_INTERVAL;
  return base + DELIVERY_LEAD_MINUTES;
}

export interface DeliverySlots {
  asap: string;
  slots: string[];
}

export function computeDeliverySlotsFromMinutes(
  nowMinutes: number,
  win: ServiceWindow = DEFAULT_WINDOW,
): DeliverySlots {
  const first = deliveryFirstSlot(win);
  const last = deliveryLastSlot(win);
  const rawEarliest =
    nowMinutes < win.start ? win.start + DELIVERY_LEAD_MINUTES : earliestDeliveryMinutes(nowMinutes);

  const asapMinutes = Math.min(Math.max(rawEarliest, first), last);

  const slots: string[] = [];
  for (let m = first; m <= last; m += SLOT_INTERVAL) {
    if (m <= asapMinutes) continue;
    slots.push(toLabel(m));
  }
  return { asap: toLabel(asapMinutes), slots };
}

export function computeDeliverySlots(
  now: Date = new Date(),
  win: ServiceWindow = DEFAULT_WINDOW,
): DeliverySlots {
  return computeDeliverySlotsFromMinutes(parisMinutes(now), win);
}

// ---------------- Delivery slot validation (mirrors the backend) ----------------
export const DELIVERY_SLOT_REQUIRED_MESSAGE = 'Merci de choisir un créneau de livraison.';
export const DELIVERY_SLOT_RANGE_MESSAGE =
  'Créneau de livraison invalide. Choisissez un créneau entre 18h45 et 22h00.';

function rangeMessage(win: ServiceWindow): string {
  return `Créneau de livraison invalide. Choisissez un créneau entre ${minutesToHuman(
    deliveryFirstSlot(win),
  )} et ${minutesToHuman(deliveryLastSlot(win))}.`;
}
export const DELIVERY_SLOT_TOO_EARLY_MESSAGE =
  "Ce créneau de livraison n'est plus disponible. Merci d'en choisir un autre.";

export type DeliverySlotValidation = { valid: boolean; error?: string };

export function earliestBookableDeliveryMinutes(
  nowMinutes: number,
  win: ServiceWindow = DEFAULT_WINDOW,
): number {
  return Math.min(
    Math.max(earliestDeliveryMinutes(nowMinutes), deliveryFirstSlot(win)),
    deliveryLastSlot(win),
  );
}

export function validateDeliverySlotFromMinutes(
  slot: string | null | undefined,
  nowMinutes: number,
  win: ServiceWindow = DEFAULT_WINDOW,
): DeliverySlotValidation {
  if (!slot || !/^\d{2}:\d{2}$/.test(slot)) {
    return { valid: false, error: DELIVERY_SLOT_REQUIRED_MESSAGE };
  }
  const [h, m] = slot.split(':').map(Number);
  const slotMinutes = h * 60 + m;

  if (
    slotMinutes < deliveryFirstSlot(win) ||
    slotMinutes > deliveryLastSlot(win) ||
    slotMinutes % SLOT_INTERVAL !== 0
  ) {
    return { valid: false, error: rangeMessage(win) };
  }

  if (slotMinutes < earliestBookableDeliveryMinutes(nowMinutes, win)) {
    return { valid: false, error: DELIVERY_SLOT_TOO_EARLY_MESSAGE };
  }

  return { valid: true };
}

export function validateDeliverySlot(
  slot: string | null | undefined,
  now: Date = new Date(),
  win: ServiceWindow = DEFAULT_WINDOW,
): DeliverySlotValidation {
  return validateDeliverySlotFromMinutes(slot, parisMinutes(now), win);
}
