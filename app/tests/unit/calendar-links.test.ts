import { describe, it, expect } from "vitest";
import { googleCalendarUrl, buildIcs } from "@/lib/calendar-links";

const sample = {
  eventId: 42,
  name: "Sunday Service",
  startsAt: new Date("2026-06-14T01:00:00.000Z"),
  endsAt: new Date("2026-06-14T03:00:00.000Z"),
  venue: "Main Hall",
};
const detailUrl = "https://example.org/church/events/42";

describe("googleCalendarUrl", () => {
  it("builds template URL with UTC dates", () => {
    const url = new URL(googleCalendarUrl(sample, detailUrl));
    expect(url.origin + url.pathname).toBe(
      "https://calendar.google.com/calendar/render"
    );
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Sunday Service");
    expect(url.searchParams.get("dates")).toBe(
      "20260614T010000Z/20260614T030000Z"
    );
    expect(url.searchParams.get("location")).toBe("Main Hall");
    expect(url.searchParams.get("details")).toBe(detailUrl);
  });

  it("defaults end to start + 2 hours when endsAt is null", () => {
    const url = new URL(
      googleCalendarUrl({ ...sample, endsAt: null }, detailUrl)
    );
    expect(url.searchParams.get("dates")).toBe(
      "20260614T010000Z/20260614T030000Z"
    );
  });

  it("omits location when venue is null", () => {
    const url = new URL(googleCalendarUrl({ ...sample, venue: null }, detailUrl));
    expect(url.searchParams.has("location")).toBe(false);
  });
});

describe("buildIcs", () => {
  it("produces valid VCALENDAR with CRLF line endings", () => {
    const ics = buildIcs(sample, detailUrl);
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("UID:event-42@jlycc");
    expect(lines).toContain("DTSTART:20260614T010000Z");
    expect(lines).toContain("DTEND:20260614T030000Z");
    expect(lines).toContain("SUMMARY:Sunday Service");
    expect(lines).toContain("LOCATION:Main Hall");
    expect(lines).toContain(`URL:${detailUrl}`);
    expect(lines).toContain("END:VEVENT");
    expect(lines).toContain("END:VCALENDAR");
    expect(ics.endsWith("\r\n")).toBe(true);
    // No bare \n anywhere
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("escapes commas, semicolons, and newlines in text fields", () => {
    const ics = buildIcs(
      { ...sample, name: "Praise; Worship, Night", venue: "Hall A, Annex" },
      detailUrl
    );
    expect(ics).toContain("SUMMARY:Praise\\; Worship\\, Night");
    expect(ics).toContain("LOCATION:Hall A\\, Annex");
  });

  it("omits LOCATION when venue is null", () => {
    const ics = buildIcs({ ...sample, venue: null }, detailUrl);
    expect(ics).not.toContain("LOCATION:");
  });
});
