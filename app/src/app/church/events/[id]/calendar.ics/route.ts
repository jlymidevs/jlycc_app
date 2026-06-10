// app/src/app/church/events/[id]/calendar.ics/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { event } from "@/schema/events";
import { eq } from "drizzle-orm";
import { buildIcs } from "@/lib/calendar-links";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const eventId = Number(params.id);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [row] = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      status: event.status,
    })
    .from(event)
    .where(eq(event.eventId, eventId))
    .limit(1);

  if (!row || row.status === "CANCELLED") {
    return new NextResponse("Not found", { status: 404 });
  }

  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const ics = buildIcs(row, `${base}/church/events/${row.eventId}`);
  const slug =
    row.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "event";

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
    },
  });
}
