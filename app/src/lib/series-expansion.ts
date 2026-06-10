// All recurrence math is Asia/Manila local. Manila is UTC+8 year-round (no DST),
// so a fixed offset is safe.
const MANILA_OFFSET = "+08:00";

export interface SeriesRule {
  recurrencePattern: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  startsOn: string; // YYYY-MM-DD (Manila local date)
  endsOn: string | null;
  dayOfWeek?: number; // 0=Sunday … 6=Saturday
  dayOfMonth?: number; // 1–31
  time: string; // HH:mm Manila local
}

export function manilaDateTimeToUtc(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time}:00${MANILA_OFFSET}`);
}

/**
 * Expand a series rule into concrete occurrence start times (UTC Dates)
 * between `from` and `to` (inclusive, YYYY-MM-DD Manila local dates).
 * Only WEEKLY and MONTHLY are supported in Phase 1; other patterns yield [].
 */
export function expandSeriesDates(
  rule: SeriesRule,
  from: string,
  to: string
): Date[] {
  const start = rule.startsOn > from ? rule.startsOn : from;
  const end = rule.endsOn && rule.endsOn < to ? rule.endsOn : to;
  if (start > end) return [];

  const out: Date[] = [];
  // Iterate calendar days using UTC-midnight Dates (date-only strings parse as UTC).
  const cursor = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);

  while (cursor <= endDate) {
    const matches =
      rule.recurrencePattern === "WEEKLY"
        ? cursor.getUTCDay() === rule.dayOfWeek
        : rule.recurrencePattern === "MONTHLY"
          ? cursor.getUTCDate() === rule.dayOfMonth
          : false;
    if (matches) {
      out.push(manilaDateTimeToUtc(cursor.toISOString().slice(0, 10), rule.time));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
