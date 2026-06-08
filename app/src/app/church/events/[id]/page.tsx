// app/src/app/church/events/[id]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { event, eventType } from "@/schema/events";
import { registerForEvent } from "@/actions/registrations";
import { eq } from "drizzle-orm";

export default async function PublicEventDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { registered?: string; error?: string };
}) {
  const eventId = Number(params.id);
  if (!eventId) notFound();

  const [eventRow] = await db
    .select({
      eventId: event.eventId,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      expectedAttendance: event.expectedAttendance,
      status: event.status,
      eventTypeName: eventType.name,
    })
    .from(event)
    .innerJoin(eventType, eq(event.eventTypeId, eventType.eventTypeId))
    .where(eq(event.eventId, eventId))
    .limit(1);

  if (!eventRow) notFound();

  const isClosed =
    eventRow.status === "CANCELLED" || eventRow.status === "COMPLETED";

  async function handleRegister(formData: FormData) {
    "use server";
    const result = await registerForEvent(eventId, formData);
    const base = `/church/events/${eventId}`;
    if (result.success) {
      redirect(`${base}?registered=1`);
    } else {
      redirect(`${base}?error=${encodeURIComponent(result.error ?? "unknown")}`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <Link
        href="/church/events"
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← All events
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">{eventRow.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{eventRow.eventTypeName}</p>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-medium text-gray-500">Date &amp; time</dt>
          <dd className="mt-1">
            {new Date(eventRow.startsAt).toLocaleString("en-PH", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </dd>
        </div>
        {eventRow.venue && (
          <div>
            <dt className="font-medium text-gray-500">Venue</dt>
            <dd className="mt-1">{eventRow.venue}</dd>
          </div>
        )}
      </dl>

      {searchParams.registered === "1" ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-5">
          <h2 className="text-lg font-semibold text-green-800">
            You&apos;re registered!
          </h2>
          <p className="mt-1 text-sm text-green-700">
            We look forward to seeing you at {eventRow.name}.
          </p>
        </div>
      ) : isClosed ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-5">
          <p className="text-sm text-gray-600">
            Registration for this event is closed.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Register for this event
          </h2>

          {searchParams.error === "already_registered" && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
              You&apos;re already registered for this event.
            </div>
          )}

          {searchParams.error && searchParams.error !== "already_registered" && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              Something went wrong. Please try again.
            </div>
          )}

          <form action={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address <span className="text-red-500">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Register
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
