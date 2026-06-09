import { createHmac, timingSafeEqual } from "crypto";

const secret = () => {
  const s = process.env.PORTAL_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("PORTAL_SECRET is not set");
  return s ?? "dev-portal-secret-fallback";
};

export function encodePortalToken(memberId: number): string {
  const payload = String(memberId);
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function decodePortalToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const dotIndex = decoded.lastIndexOf(".");
    if (dotIndex === -1) return null;
    const payload = decoded.slice(0, dotIndex);
    const sig = decoded.slice(dotIndex + 1);
    const expected = createHmac("sha256", secret()).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const id = Number(payload);
    if (!Number.isInteger(id) || id <= 0) return null;
    return id;
  } catch {
    return null;
  }
}
