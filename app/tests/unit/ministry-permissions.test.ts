import { describe, expect, it } from "vitest";
import { canDeleteMinistries } from "@/lib/ministry-permissions";

describe("ministry permissions", () => {
  it("allows only SUPER_ADMIN to delete ministries", () => {
    expect(canDeleteMinistries("SUPER_ADMIN")).toBe(true);
    expect(canDeleteMinistries("ADMIN")).toBe(false);
    expect(canDeleteMinistries("NETWORK_HEAD")).toBe(false);
    expect(canDeleteMinistries("MINISTRY_HEAD")).toBe(false);
    expect(canDeleteMinistries("MEMBER")).toBe(false);
  });
});
