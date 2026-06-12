// app/tests/unit/authz.test.ts
import { describe, it, expect } from "vitest";
import { hasRole, ROLES, type Role } from "@/lib/authz";

describe("hasRole", () => {
  it("exposes the roles in rank order", () => {
    expect(ROLES).toEqual([
      "MEMBER",
      "MINISTRY_HEAD",
      "NETWORK_HEAD",
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  it("same role passes", () => {
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("higher role passes lower requirement", () => {
    expect(hasRole("SUPER_ADMIN", "MEMBER")).toBe(true);
    expect(hasRole("ADMIN", "MINISTRY_HEAD")).toBe(true);
    expect(hasRole("NETWORK_HEAD", "MINISTRY_HEAD")).toBe(true);
  });

  it("lower role fails higher requirement", () => {
    expect(hasRole("MEMBER", "MINISTRY_HEAD")).toBe(false);
    expect(hasRole("MINISTRY_HEAD", "NETWORK_HEAD")).toBe(false);
    expect(hasRole("ADMIN", "SUPER_ADMIN")).toBe(false);
  });

  it("unknown role fails everything", () => {
    expect(hasRole("staff" as Role, "MEMBER")).toBe(false);
    expect(hasRole(undefined as unknown as Role, "MEMBER")).toBe(false);
  });
});
