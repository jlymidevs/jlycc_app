import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { announcementRecipient } from "@/schema/communications";
import { person } from "@/schema/core";
import { eq } from "drizzle-orm";
import { getAnnouncement, publishAnnouncement, archiveAnnouncement } from "@/actions/announcements";

export const dynamic = "force-dynamic";

export default async function AnnouncementDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const row = await getAnnouncement(id);
  if (!row) notFound();

  const recipients = await db
    .select({
      firstName: person.firstName,
      lastName: person.lastName,
    })
    .from(announcementRecipient)
    .innerJoin(person, eq(announcementRecipient.personId, person.personId))
    .where(eq(announcementRecipient.announcementId, id))
    .limit(20);

  async function handlePublish() {
    "use server";
    await publishAnnouncement(id);
  }

  async function handleArchive() {
    "use server";
    await archiveAnnouncement(id);
  }

  const statusColors = {
    DRAFT: "bg-yellow-50 text-yellow-700",
    PUBLISHED: "bg-green-50 text-green-700",
    ARCHIVED: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{row.title}</h1>
          <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[row.status]}`}>
            {row.status}
          </span>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {row.status === "DRAFT" && (
            <form action={handlePublish}>
              <button type="submit" className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                Publish
              </button>
            </form>
          )}
          {row.status === "PUBLISHED" && (
            <form action={handleArchive}>
              <button type="submit" className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
                Archive
              </button>
            </form>
          )}
        </div>
      </div>

      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Target</dt>
          <dd className="text-gray-900">{row.targetType}{row.targetId ? ` (${row.targetId})` : ""}</dd>
          <dt className="text-gray-500">Recipients</dt>
          <dd className="text-gray-900">{row.recipientCount}</dd>
          {row.publishedAt && (
            <>
              <dt className="text-gray-500">Published</dt>
              <dd className="text-gray-900">{new Date(row.publishedAt).toLocaleDateString("en-PH")}</dd>
            </>
          )}
          <dt className="text-gray-500">Created</dt>
          <dd className="text-gray-900">{new Date(row.createdAt).toLocaleDateString("en-PH")}</dd>
        </dl>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Body</h2>
        <p className="text-sm text-gray-900 whitespace-pre-wrap">{row.body}</p>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          Recipients ({row.recipientCount})
        </h2>
        {recipients.length === 0 ? (
          <p className="text-sm text-gray-500">No recipients yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-900">
            {recipients.map((r, i) => (
              <li key={i}>{r.firstName} {r.lastName}</li>
            ))}
            {row.recipientCount > 20 && (
              <li className="text-gray-400">...and {row.recipientCount - 20} more</li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
