export interface CalendarEventLike {
  eventId: number;
  name: string;
  startsAt: Date;
  endsAt: Date | null;
  venue: string | null;
}

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

// 2026-06-14T01:00:00.000Z → 20260614T010000Z
function fmtUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function endOrDefault(e: CalendarEventLike): Date {
  return e.endsAt ?? new Date(e.startsAt.getTime() + DEFAULT_DURATION_MS);
}

export function googleCalendarUrl(
  e: CalendarEventLike,
  detailUrl: string
): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.name,
    dates: `${fmtUtc(e.startsAt)}/${fmtUtc(endOrDefault(e))}`,
    details: detailUrl,
  });
  if (e.venue) params.set("location", e.venue);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// RFC 5545 text escaping
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(e: CalendarEventLike, detailUrl: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JLYCC//Church Calendar//EN",
    "BEGIN:VEVENT",
    `UID:event-${e.eventId}@jlycc`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtUtc(e.startsAt)}`,
    `DTEND:${fmtUtc(endOrDefault(e))}`,
    `SUMMARY:${escapeIcsText(e.name)}`,
    ...(e.venue ? [`LOCATION:${escapeIcsText(e.venue)}`] : []),
    `URL:${detailUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
