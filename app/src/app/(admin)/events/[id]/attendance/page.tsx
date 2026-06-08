// app/src/app/(admin)/events/[id]/attendance/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { event } from "@/schema/events";
import { checkIn } from "@/schema/attendance";
import { person, contactInfo } from "@/schema/core";
import { eq, and, desc, count, isNotNull, countDistinct } from "drizzle-orm";
import { checkInPerson, captureVisitor, searchPersons } from "@/actions/attendance";
import QrScanner from "@/components/QrScanner";

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const eventId = Number(params.id);
  if (!eventId) notFound();

  const [eventRow] = await db
    .select({ eventId: event.eventId, name: event.name })
    .from(event)
    .where(eq(event.eventId, eventId))
    .limit(1);

  if (!eventRow) notFound();

  // Stats
  const [totalRow] = await db
    .select({ total: count() })
    .from(checkIn)
    .where(eq(checkIn.eventId, eventId));

  const [uniqueRow] = await db
    .select({ unique: countDistinct(checkIn.personId) })
    .from(checkIn)
    .where(eq(checkIn.eventId, eventId));

  const [ftvRow] = await db
    .select({ ftv: count() })
    .from(checkIn)
    .where(and(eq(checkIn.eventId, eventId), isNotNull(checkIn.ftvCaptureId)));

  const totalCheckIns = totalRow?.total ?? 0;
  const uniquePersons = uniqueRow?.unique ?? 0;
  const ftvCount = ftvRow?.ftv ?? 0;

  // Check-in list
  const checkIns = await db
    .select({
      checkInId: checkIn.checkInId,
      checkedInAt: checkIn.checkedInAt,
      firstName: person.firstName,
      lastName: person.lastName,
      ftvCaptureId: checkIn.ftvCaptureId,
    })
    .from(checkIn)
    .innerJoin(person, eq(checkIn.personId, person.personId))
    .where(eq(checkIn.eventId, eventId))
    .orderBy(desc(checkIn.checkedInAt));

  // Search
  const query = typeof searchParams.q === "string" ? searchParams.q : "";
  let searchResults: Awaited<ReturnType<typeof searchPersons>> = [];
  let showFtvPrompt = false;

  if (query.length >= 2) {
    searchResults = await searchPersons(query);
    if (searchResults.length === 0) {
      showFtvPrompt = true;
    }
  }

  const ftverr = typeof searchParams.ftverr === "string" ? searchParams.ftverr : undefined;
  const checkinErr = typeof searchParams.checkin_err === "string" ? searchParams.checkin_err : undefined;

  // Server actions
  async function handleCheckIn(formData: FormData) {
    "use server";
    const personId = Number(formData.get("personId"));
    const result = await checkInPerson(eventId, personId);
    if ("error" in result) {
      redirect(`/events/${eventId}/attendance?checkin_err=${encodeURIComponent(result.error)}`);
    }
    redirect(`/events/${eventId}/attendance`);
  }

  async function handleCaptureVisitor(formData: FormData) {
    "use server";
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const birthday = formData.get("birthday") as string;
    const email = formData.get("email") as string;
    const consentToContact = formData.get("consentToContact") === "on";
    const invitedByPersonIdRaw = formData.get("invitedByPersonId") as string;
    const invitedByPersonId = invitedByPersonIdRaw
      ? Number(invitedByPersonIdRaw)
      : undefined;

    const result = await captureVisitor(eventId, {
      firstName,
      lastName,
      birthday,
      email,
      consentToContact,
      invitedByPersonId,
    });

    if ("error" in result && result.error === "person_already_exists") {
      redirect(
        `/events/${eventId}/attendance?q=${encodeURIComponent(email)}&ftverr=exists`
      );
    }
    redirect(`/events/${eventId}/attendance`);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/events/${eventId}`}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← {eventRow.name}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Attendance</h1>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalCheckIns}</p>
          <p className="text-xs text-gray-500 mt-1">Total Check-ins</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{uniquePersons}</p>
          <p className="text-xs text-gray-500 mt-1">Unique Persons</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{ftvCount}</p>
          <p className="text-xs text-gray-500 mt-1">First-time Visitors</p>
        </div>
      </div>

      {/* Search form */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Check In</h2>
        {checkinErr && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded px-3 py-2">
            {checkinErr === "already_checked_in"
              ? "This person is already checked in."
              : checkinErr}
          </p>
        )}
        <form method="GET" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by name or email…"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
        </form>

        {/* QR Scanner */}
        <QrScanner eventId={eventId} />
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          </p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {searchResults.map((p) => (
              <li key={p.personId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {p.lastName}, {p.firstName}
                  </p>
                  {p.email && (
                    <p className="text-xs text-gray-500">{p.email}</p>
                  )}
                </div>
                <form action={handleCheckIn}>
                  <input type="hidden" name="personId" value={p.personId} />
                  <button
                    type="submit"
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    Check in
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* FTV form */}
      {showFtvPrompt && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 space-y-4">
          <h3 className="text-base font-semibold text-blue-900">
            No results for &ldquo;{query}&rdquo; — capture as first-time visitor?
          </h3>

          {ftverr === "exists" && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
              This email is already in the system. Please search by name or email to find the person.
            </div>
          )}

          <form action={handleCaptureVisitor} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First name <span className="text-red-500">*</span>
                </label>
                <input
                  name="firstName"
                  type="text"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last name <span className="text-red-500">*</span>
                </label>
                <input
                  name="lastName"
                  type="text"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birthday <span className="text-red-500">*</span>
              </label>
              <input
                name="birthday"
                type="date"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                defaultValue={query.includes("@") ? query : ""}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invited by (person ID, optional)
              </label>
              <input
                name="invitedByPersonId"
                type="number"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                name="consentToContact"
                id="consentToContact"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <label
                htmlFor="consentToContact"
                className="text-sm text-gray-700"
              >
                Consent to contact
              </label>
            </div>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Capture &amp; Check in
            </button>
          </form>
        </div>
      )}

      {/* Check-in list */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Check-in List ({checkIns.length})
        </h2>
        {checkIns.length === 0 ? (
          <p className="text-sm text-gray-500">No check-ins yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {checkIns.map((ci) => (
                <tr key={ci.checkInId} className="border-b border-gray-100">
                  <td className="py-2 pr-4">
                    {ci.lastName}, {ci.firstName}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">
                    {new Date(ci.checkedInAt).toLocaleTimeString("en-PH")}
                  </td>
                  <td className="py-2">
                    {ci.ftvCaptureId ? (
                      <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                        FTV
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Member
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
