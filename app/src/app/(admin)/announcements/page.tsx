import Link from "next/link";
import { listAnnouncements } from "@/actions/announcements";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-yellow-50 text-yellow-700",
    PUBLISHED: "bg-green-50 text-green-700",
    ARCHIVED: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

export default async function AnnouncementsPage() {
  const rows = await listAnnouncements();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
        <Link
          href="/announcements/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New announcement
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm mt-4">No announcements yet.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-3 pr-4 font-medium">Title</th>
              <th className="py-3 pr-4 font-medium">Target</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 pr-4 font-medium">Recipients</th>
              <th className="py-3 font-medium">Published Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr
                key={a.announcementId}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/announcements/${a.announcementId}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {a.title}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-gray-600">{a.targetType}</td>
                <td className="py-3 pr-4">
                  <StatusBadge status={a.status} />
                </td>
                <td className="py-3 pr-4 text-gray-600">{a.recipientCount}</td>
                <td className="py-3 text-gray-600">
                  {a.publishedAt
                    ? new Date(a.publishedAt).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
