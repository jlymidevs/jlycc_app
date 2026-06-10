// app/src/lib/series-generator.ts
import { db } from "@/lib/db";
import { event, eventSeries } from "@/schema/events";
import { eq } from "drizzle-orm";
import { expandSeriesDates } from "@/lib/series-expansion";
import type { RecurrenceConfig } from "@/lib/validations/series";

const HORIZON_DAYS = 92; // ~3 months ahead

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Materialize event rows for one series, from today up to HORIZON_DAYS ahead.
 * Idempotent: skips occurrences whose (seriesId, startsAt) already exists.
 * Returns count of rows inserted.
 */
export async function generateOccurrences(seriesId: number): Promise<number> {
  const [series] = await db
    .select()
    .from(eventSeries)
    .where(eq(eventSeries.seriesId, seriesId))
    .limit(1);
  if (!series || series.status !== "ACTIVE") return 0;

  const config = series.recurrenceConfig as RecurrenceConfig;
  const from = isoDate(new Date());
  const to = isoDate(new Date(Date.now() + HORIZON_DAYS * 86400000));

  const dates = expandSeriesDates(
    {
      recurrencePattern: series.recurrencePattern,
      startsOn: series.startsOn,
      endsOn: series.endsOn,
      dayOfWeek: config.dayOfWeek,
      dayOfMonth: config.dayOfMonth,
      time: config.time,
    },
    from,
    to
  );
  if (dates.length === 0) return 0;

  const existing = await db
    .select({ startsAt: event.startsAt })
    .from(event)
    .where(eq(event.seriesId, seriesId));
  const existingTimes = new Set(existing.map((r) => r.startsAt.getTime()));
  const missing = dates.filter((d) => !existingTimes.has(d.getTime()));
  if (missing.length === 0) return 0;

  await db.insert(event).values(
    missing.map((startsAt) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventTypeId: series.eventTypeId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seriesId: series.seriesId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      branchId: series.branchId as any,
      name: series.name,
      startsAt,
      endsAt: new Date(startsAt.getTime() + config.durationMinutes * 60000),
      venue: config.venue ?? null,
    }))
  );
  return missing.length;
}

/**
 * Top up all ACTIVE series. Safe to call fire-and-forget on page load —
 * never throws.
 */
export async function topUpAllSeries(): Promise<void> {
  try {
    const active = await db
      .select({ seriesId: eventSeries.seriesId })
      .from(eventSeries)
      .where(eq(eventSeries.status, "ACTIVE"));
    for (const s of active) {
      await generateOccurrences(s.seriesId);
    }
  } catch (err) {
    console.error("series top-up failed", err);
  }
}
