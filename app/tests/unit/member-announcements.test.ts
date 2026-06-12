import { describe, expect, it } from "vitest";
import { previewText, formatAnnouncementDate } from "@/lib/member-announcements";

describe("previewText", () => {
  it("returns short text unchanged", () => {
    expect(previewText("Hello church", 160)).toBe("Hello church");
  });
  it("truncates long text at a word boundary with ellipsis", () => {
    const long = "word ".repeat(100).trim();
    const out = previewText(long, 50);
    expect(out.length).toBeLessThanOrEqual(51); // 50 + ellipsis char
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("  ");
  });
  it("collapses newlines to spaces", () => {
    expect(previewText("line one\nline two", 160)).toBe("line one line two");
  });
});

describe("formatAnnouncementDate", () => {
  it("formats a date as e.g. 'Jun 11, 2026'", () => {
    expect(formatAnnouncementDate(new Date("2026-06-11T12:00:00Z"))).toBe(
      "Jun 11, 2026"
    );
  });
  it("returns em dash for null", () => {
    expect(formatAnnouncementDate(null)).toBe("—");
  });
});
