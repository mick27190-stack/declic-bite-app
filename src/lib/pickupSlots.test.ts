import { describe, it, expect } from "vitest";
import {
  computePickupSlotsFromMinutes,
  computePickupSlotOptionsFromMinutes,
  computeDeliverySlotsFromMinutes,
  computeDeliverySlots,
  validateDeliverySlot,
  validateDeliverySlotFromMinutes,
  earliestAllowedMinutes,
  parisMinutes,
  FIRST_SLOT_MINUTES,
  LAST_SLOT_MINUTES,
  DELIVERY_FIRST_SLOT_MINUTES,
  DELIVERY_LAST_SLOT_MINUTES,
} from "./pickupSlots";


describe("takeaway: no 18:30 slot, ASAP starts at 18:45 from 18:00", () => {
  const atMin = (h: number, m: number) => h * 60 + m;

  it("at 18:00 Paris, first proposed slot is 18:45", () => {
    const slots = computePickupSlotsFromMinutes(atMin(18, 0));
    expect(slots[0]).toBe("18:45");
    expect(slots).not.toContain("18:30");
  });

  it("no 18:30 slot at any time of day", () => {
    for (let m = 0; m < 24 * 60; m += 5) {
      expect(computePickupSlotsFromMinutes(m)).not.toContain("18:30");
    }
  });

  it("first enabled ASAP option at 18:00 is 18:45", () => {
    const opts = computePickupSlotOptionsFromMinutes(atMin(18, 0));
    const firstEnabled = opts.find((o) => !o.disabled);
    expect(firstEnabled?.time).toBe("18:45");
    expect(opts.some((o) => o.time === "18:30")).toBe(false);
  });

  it("parisMinutes converts UTC to Paris wall clock (device-TZ independent)", () => {
    // 16:00 UTC == 18:00 Paris in July (CEST).
    const utc = new Date("2026-07-15T16:00:00Z");
    expect(parisMinutes(utc)).toBe(atMin(18, 0));
    expect(computePickupSlotsFromMinutes(parisMinutes(utc))[0]).toBe("18:45");
  });
});

// Helper: build "minutes since midnight" for a given hour/minute.
const at = (h: number, m: number) => h * 60 + m;

describe("earliestAllowedMinutes", () => {
  it("rounds 21h13 (+15 -> 21h28) up to the 21h30 slot", () => {
    expect(earliestAllowedMinutes(21 * 60 + 13)).toBe(21 * 60 + 30);
  });

  it("keeps exactly-on-a-slot result when lead lands exactly on a slot", () => {
    // 21h15 + 15 = 21h30 exactly -> stays 21h30 (no extra rounding up)
    expect(earliestAllowedMinutes(21 * 60 + 15)).toBe(21 * 60 + 30);
  });
});

describe("computePickupSlotsFromMinutes edge cases (retrait toutes les 20 min)", () => {
  it("full list is 18:45 → 21:25 every 20 minutes", () => {
    expect(computePickupSlotsFromMinutes(at(15, 0))).toEqual([
      "18:45", "19:05", "19:25", "19:45", "20:05", "20:25", "20:45", "21:05", "21:25",
    ]);
  });

  it("exactly 15 min before a slot keeps that slot available", () => {
    const slots = computePickupSlotsFromMinutes(at(18, 50)); // 19:05
    expect(slots[0]).toBe("19:05");
  });

  it("1 minute past the 15-min threshold pushes to the next slot", () => {
    const slots = computePickupSlotsFromMinutes(at(18, 51));
    expect(slots).not.toContain("19:05");
    expect(slots[0]).toBe("19:25");
  });

  it("blocks all earlier slots and only keeps reachable ones", () => {
    expect(computePickupSlotsFromMinutes(at(20, 0))).toEqual(["20:25", "20:45", "21:05", "21:25"]);
  });

  it("right at the last slot's lead window still offers it", () => {
    expect(computePickupSlotsFromMinutes(at(21, 10))).toEqual(["21:25"]);
  });

  it("midnight (00h00) returns the full next-service slot list", () => {
    const slots = computePickupSlotsFromMinutes(at(0, 0));
    expect(slots[0]).toBe("18:45");
    expect(slots[slots.length - 1]).toBe("21:25");
  });

  it("late night past closing (23h50) falls back to full next-service list", () => {
    const slots = computePickupSlotsFromMinutes(at(23, 50));
    expect(slots[0]).toBe("18:45");
    expect(slots[slots.length - 1]).toBe("21:25");
  });

  it("before service (early afternoon) offers the full list starting at 18:45", () => {
    const slots = computePickupSlotsFromMinutes(at(15, 0));
    expect(slots[0]).toBe("18:45");
  });

  it("never returns a slot earlier than the first or later than the last", () => {
    const slots = computePickupSlotsFromMinutes(at(19, 7));
    const toMin = (s: string) => {
      const [h, m] = s.split(":").map(Number);
      return h * 60 + m;
    };
    for (const s of slots) {
      expect(toMin(s)).toBeGreaterThanOrEqual(FIRST_SLOT_MINUTES);
      expect(toMin(s)).toBeLessThanOrEqual(LAST_SLOT_MINUTES);
    }
});

describe("delivery: ASAP never before 18:45", () => {
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };

  it("at 18:00 Paris, ASAP is 18:45 (not 18:30)", () => {
    const { asap } = computeDeliverySlotsFromMinutes(at(18, 0));
    expect(asap).toBe("18:45");
  });

  it("before opening (e.g. 15:00), ASAP is 18:45", () => {
    expect(computeDeliverySlotsFromMinutes(at(15, 0)).asap).toBe("18:45");
    expect(computeDeliverySlotsFromMinutes(at(0, 0)).asap).toBe("18:45");
  });

  it("between 18:00 and 18:08, ASAP stays 18:45 (8 min de grâce)", () => {
    for (let m = at(18, 0); m <= at(18, 8); m += 1) {
      expect(computeDeliverySlotsFromMinutes(m).asap).toBe("18:45");
    }
  });

  it("ASAP is never before 18:45 nor after 22:00, at any minute of the day", () => {
    for (let m = 0; m < 24 * 60; m += 1) {
      const { asap } = computeDeliverySlotsFromMinutes(m);
      expect(toMin(asap)).toBeGreaterThanOrEqual(DELIVERY_FIRST_SLOT_MINUTES);
      expect(toMin(asap)).toBeLessThanOrEqual(DELIVERY_LAST_SLOT_MINUTES);
    }
  });

  it("grid slots are always strictly after ASAP and within the window", () => {
    for (let m = 0; m < 24 * 60; m += 5) {
      const { asap, slots } = computeDeliverySlotsFromMinutes(m);
      for (const s of slots) {
        expect(toMin(s)).toBeGreaterThan(toMin(asap));
        expect(toMin(s)).toBeLessThanOrEqual(DELIVERY_LAST_SLOT_MINUTES);
      }
    }
  });

  it("at 18:00 Paris, the grid starts at 19:00 (right after ASAP)", () => {
    const { slots } = computeDeliverySlotsFromMinutes(at(18, 0));
    expect(slots[0]).toBe("19:00");
    expect(slots).not.toContain("18:30");
    expect(slots).not.toContain("18:45");
  });

  it("le délai de 45 min avec 8 min de grâce s'applique", () => {
    expect(computeDeliverySlotsFromMinutes(at(20, 8)).asap).toBe("20:45");
    expect(computeDeliverySlotsFromMinutes(at(20, 9)).asap).toBe("21:00");
    expect(computeDeliverySlotsFromMinutes(at(19, 23)).asap).toBe("20:00");
  });

  it("ASAP is clamped to the last slot late in the service", () => {
    expect(computeDeliverySlotsFromMinutes(at(21, 40)).asap).toBe("22:00");
  });

  it("uses Paris wall clock regardless of device timezone", () => {
    // 16:00 UTC == 18:00 Paris in July (CEST).
    const utc = new Date("2026-07-15T16:00:00Z");
    expect(parisMinutes(utc)).toBe(at(18, 0));
    expect(computeDeliverySlots(utc).asap).toBe("18:45");
  });
});

});

describe("validateDeliverySlotFromMinutes (mirrors the backend rule)", () => {
  it("rejects a missing or malformed slot", () => {
    expect(validateDeliverySlotFromMinutes(null, at(19, 0)).valid).toBe(false);
    expect(validateDeliverySlotFromMinutes("", at(19, 0)).valid).toBe(false);
    expect(validateDeliverySlotFromMinutes("19h00", at(19, 0)).valid).toBe(false);
  });

  it("rejects 18:30 at 18:00 Paris (never below the 18h45 floor)", () => {
    const r = validateDeliverySlotFromMinutes("18:30", at(18, 0));
    expect(r.valid).toBe(false);
    expect(r.error).toContain("18h45");
  });

  it("accepts 18:45 at 18:00 Paris", () => {
    expect(validateDeliverySlotFromMinutes("18:45", at(18, 0)).valid).toBe(true);
  });

  it("rejects any slot before 18:45 at any time of day", () => {
    for (const slot of ["17:45", "18:00", "18:15", "18:30"]) {
      for (let m = 0; m < 24 * 60; m += 30) {
        expect(validateDeliverySlotFromMinutes(slot, m).valid).toBe(false);
      }
    }
  });

  it("rejects off-grid and out-of-window slots", () => {
    expect(validateDeliverySlotFromMinutes("19:07", at(18, 0)).valid).toBe(false);
    expect(validateDeliverySlotFromMinutes("22:15", at(18, 0)).valid).toBe(false);
  });

  it("enforces the 45-min lead after 18:00", () => {
    expect(validateDeliverySlotFromMinutes("18:45", at(18, 20)).valid).toBe(false);
    expect(validateDeliverySlotFromMinutes("19:15", at(18, 20)).valid).toBe(true);
    expect(validateDeliverySlotFromMinutes("20:45", at(20, 8)).valid).toBe(true);
    expect(validateDeliverySlotFromMinutes("20:45", at(20, 9)).valid).toBe(false);
  });

  it("always accepts the ASAP slot proposed by the selector", () => {
    for (let m = 0; m < 24 * 60; m += 1) {
      const { asap } = computeDeliverySlotsFromMinutes(m);
      // Past the delivery cut-off the clamped ASAP can be unreachable; the
      // cut-off blocks checkout there, so only assert during bookable hours.
      if (m > 21 * 60 + 15) continue;
      expect(validateDeliverySlotFromMinutes(asap, m).valid).toBe(true);
    }
  });

  it("validateDeliverySlot uses the Paris clock", () => {
    const utc = new Date("2026-07-15T16:00:00Z"); // 18:00 Paris
    expect(validateDeliverySlot("18:30", utc).valid).toBe(false);
    expect(validateDeliverySlot("18:45", utc).valid).toBe(true);
  });
});

describe("dimanche (fermeture 21h30)", () => {
  const sundayWindow = { start: 18 * 60, end: 21 * 60 + 30 };

  it("garde 21h05 sélectionnable de 20h50 à 21h04 le dimanche", () => {
    for (let minute = at(20, 50); minute < at(21, 5); minute++) {
      expect(computePickupSlotsFromMinutes(minute, sundayWindow, 0)).toEqual(["21:05"]);
      expect(computePickupSlotOptionsFromMinutes(minute, sundayWindow, 0).filter(s => !s.disabled))
        .toEqual([{ time: "21:05", disabled: false }]);
    }
  });

  it("désactive 21h05 dès le début du créneau le dimanche", () => {
    expect(computePickupSlotOptionsFromMinutes(at(21, 5), sundayWindow, 0)
      .find(s => s.time === "21:05")?.disabled).toBe(true);
  });

  it("ne prolonge pas le retrait des autres jours", () => {
    expect(computePickupSlotOptionsFromMinutes(at(21, 4), sundayWindow, 2)
      .find(s => s.time === "21:05")?.disabled).toBe(true);
  });

  it("propose 21h05 comme dernier créneau à emporter", () => {
    const slots = computePickupSlotsFromMinutes(18 * 60, { start: 18 * 60, end: 21 * 60 + 30 });
    expect(slots[slots.length - 1]).toBe("21:05");
  });
});
