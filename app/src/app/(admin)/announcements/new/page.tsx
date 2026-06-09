import { redirect } from "next/navigation";
import { createAnnouncement } from "@/actions/announcements";

export default function NewAnnouncementPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  async function handleCreate(formData: FormData) {
    "use server";
    const result = await createAnnouncement({
      title: formData.get("title") as string,
      body: formData.get("body") as string,
      targetType: formData.get("targetType") as
        | "ALL_MEMBERS"
        | "BRANCH"
        | "LIFECYCLE_STAGE"
        | "MANUAL",
      targetId: (formData.get("targetId") as string) || undefined,
    });
    if ("announcementId" in result) {
      redirect(`/announcements/${result.announcementId}`);
    }
    redirect("/announcements/new?error=1");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        New Announcement
      </h1>

      {searchParams.error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          Failed to create announcement. Please check your inputs and try again.
        </div>
      )}

      <form action={handleCreate} className="space-y-5">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="body"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Body
          </label>
          <textarea
            id="body"
            name="body"
            rows={6}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="targetType"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Target
          </label>
          <select
            id="targetType"
            name="targetType"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL_MEMBERS">All Members</option>
            <option value="BRANCH">Branch</option>
            <option value="LIFECYCLE_STAGE">Lifecycle Stage</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create announcement
        </button>
      </form>
    </div>
  );
}
