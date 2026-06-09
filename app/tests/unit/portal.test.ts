import { describe, it, expect } from "vitest";
import { encodePortalToken, decodePortalToken } from "@/lib/portal-token";
import { portalTokenSchema } from "@/lib/validations/portal";

describe("portal token", () => {
  it("encodePortalToken(1) returns a non-empty string", () => {
    expect(encodePortalToken(1)).toBeTruthy();
  });

  it("decodePortalToken(encodePortalToken(1)) returns 1", () => {
    expect(decodePortalToken(encodePortalToken(1))).toBe(1);
  });

  it("decodePortalToken(encodePortalToken(999)) returns 999", () => {
    expect(decodePortalToken(encodePortalToken(999))).toBe(999);
  });

  it("decodePortalToken('garbage') returns null", () => {
    expect(decodePortalToken("garbage")).toBeNull();
  });

  it("decodePortalToken('') returns null", () => {
    expect(decodePortalToken("")).toBeNull();
  });

  it("decodePortalToken with tampered token returns null", () => {
    const token = encodePortalToken(42);
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(decodePortalToken(tampered)).toBeNull();
  });

  it("portalTokenSchema rejects empty string", () => {
    expect(portalTokenSchema.safeParse("").success).toBe(false);
  });

  it("portalTokenSchema accepts 10-char string", () => {
    expect(portalTokenSchema.safeParse("abcdefghij").success).toBe(true);
  });
});
