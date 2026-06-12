import { describe, expect, it } from "vitest";
import { PH_PROVINCES } from "@/lib/ph-provinces";

describe("PH_PROVINCES", () => {
  it("has the NCR entry and 80+ provinces, no duplicates", () => {
    expect(PH_PROVINCES).toContain("Metro Manila (NCR)");
    expect(PH_PROVINCES.length).toBeGreaterThanOrEqual(82);
    expect(new Set(PH_PROVINCES).size).toBe(PH_PROVINCES.length);
  });
  it("is alphabetically sorted after the NCR entry", () => {
    const rest = PH_PROVINCES.slice(1);
    expect([...rest].sort((a, b) => a.localeCompare(b))).toEqual(rest);
  });
});
