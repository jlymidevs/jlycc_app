import { describe, expect, it } from "vitest";
import { greetingForHour, manilaHour } from "@/lib/greeting";

describe("greetingForHour", () => {
  it("morning before noon", () => {
    expect(greetingForHour(0)).toBe("Good morning");
    expect(greetingForHour(11)).toBe("Good morning");
  });
  it("afternoon from 12 to 17", () => {
    expect(greetingForHour(12)).toBe("Good afternoon");
    expect(greetingForHour(17)).toBe("Good afternoon");
  });
  it("evening from 18", () => {
    expect(greetingForHour(18)).toBe("Good evening");
    expect(greetingForHour(23)).toBe("Good evening");
  });
});

describe("manilaHour", () => {
  it("converts UTC to Asia/Manila (+8)", () => {
    // 2026-06-11T00:30:00Z == 08:30 Manila
    expect(manilaHour(new Date("2026-06-11T00:30:00Z"))).toBe(8);
    // 2026-06-11T17:00:00Z == 01:00 next day Manila
    expect(manilaHour(new Date("2026-06-11T17:00:00Z"))).toBe(1);
  });
  it("midnight Manila is 0, not 24", () => {
    expect(manilaHour(new Date("2026-06-10T16:00:00Z"))).toBe(0);
  });
});
