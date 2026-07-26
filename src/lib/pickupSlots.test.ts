import { describe, it, expect } from "vitest";
import {
  computePickupSlotsFromMinutes,
  computePickupSlotOptionsFromMinutes,
  earliestAllowedMinutes,
  parisMinutes,
  FIRST_SLOT_MINUTES,
  LAST_SLOT_MINUTES,
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

describe("computePickupSlotsFromMinutes edge cases", () => {
  it("exactly 15 min before a slot keeps that slot available", () => {
    // 19h00 + 15 = 19h15 exactly -> 19h15 must still be offered.
    const slots = computePickupSlotsFromMinutes(at(19, 0));
    expect(slots[0]).toBe("19:15");
    expect(slots).not.toContain("19:00");
  });

  it("1 minute before the 15-min threshold pushes to the next slot", () => {
    // 19h01 + 15 = 19h16 -> rounded up to 19h30, so 19h15 is blocked.
    const slots = computePickupSlotsFromMinutes(at(19, 1));
    expect(slots).not.toContain("19:15");
    expect(slots[0]).toBe("19:30");
  });

  it("2 minutes before the threshold also blocks the nearest slot", () => {
    // 19h13 + 15 = 19h28 -> rounded up to 19h30, 19h15 blocked.
    const slots = computePickupSlotsFromMinutes(at(19, 13));
    expect(slots).not.toContain("19:15");
    expect(slots[0]).toBe("19:30");
  });

  it("blocks all earlier slots and only keeps reachable ones", () => {
    const slots = computePickupSlotsFromMinutes(at(20, 0)); // earliest 20:15
    expect(slots).toEqual(["20:15", "20:30", "20:45", "21:00", "21:15", "21:30"]);
  });

  it("right at the last slot's lead window still offers it", () => {
    // 21h15 + 15 = 21h30 exactly -> last slot 21h30 remains.
    const slots = computePickupSlotsFromMinutes(at(21, 15));
    expect(slots).toEqual(["21:30"]);
  });

  it("midnight (00h00) returns the full next-service slot list", () => {
    const slots = computePickupSlotsFromMinutes(at(0, 0));
    expect(slots[0]).toBe("18:45");
    expect(slots[slots.length - 1]).toBe("21:30");
  });

  it("late night past closing (23h50) falls back to full next-service list", () => {
    // 23h50 + 15 rounds beyond the last slot -> no reachable slot -> full list.
    const slots = computePickupSlotsFromMinutes(at(23, 50));
    expect(slots[0]).toBe("18:45");
    expect(slots[slots.length - 1]).toBe("21:30");
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
});
