export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { branch } from "@/schema/core";
import { getMinistry, createChapter } from "@/actions/ministries";

export default async function MinistryDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { err?: string };
}) {
  const ministryId = Number(params.id);
  const ministryData = await getMinistry(ministryId);
  if (!ministryData) notFound();

  const branches = await db
    .select({ branchId: branch.branchId, name: branch.name })
    .from(branch)
    .orderBy(branch.name);

  const err =
    typeof searchParams.err === "string" ? searchParams.err : undefined;

  async function handleCreateChapter(formData: FormData) {
    "use server";
    const branchId = Number(formData.get("branchId"));
    const launchedOn = formData.get("launchedOn") as string | null;
    const status = (formData.get("status") as string) || "ACTIVE";

    const result = await createChapter({
      ministryId,
      branchId,
      launchedOn: launchedOn || undefined,
      status: status as "ACTIVE" | "PAUSED" | "CLOSED",
    });

    if ("error" in result) {
      redirect(`/ministries/${ministryId}?err=${encodeURIComponent(result.error)}`);
    }

    redirect(`/ministries/${ministryId}/chapters/${result.chapterId}`);
  }

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    PAUSED: "bg-amber-100 text-amber-700",
    CLOSED: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/ministries"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Ministries
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {ministryData.name}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {ministryData.networkName}
          {ministryData.targetDemographic
            ? ` · ${ministryData.targetDemographic}`
            : ""}
        </p>
      </div>

      {/* Description */}
      {ministryData.description && (
        <p className="text-sm text-gray-600">{ministryData.description}</p>
      )}

      {/* Chapters */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Chapters</h2>

        {ministryData.chapters.length === 0 ? (
          <p className="text-sm text-gray-500">No chapters yet.</p>
        ) : (
          <div className="space-y-2">
            {ministryData.chapters.map((c) => (
              <Link
                key={c.chapterId}
                href={`/ministries/${ministryId}/chapters/${c.chapterId}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
              >
                <div>
                  <p className="font-medium text-gray-900">{c.branchName}</p>
                  {c.launchedOn && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Launched{" "}
                      {new Date(c.launchedOn).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {c.activeMemberCount} active
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      statusColors[c.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* New Chapter Form */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">New Chapter</h2>

        {err === "chapter_already_exists" && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            A chapter for this ministry already exists at that branch.
          </p>
        )}
        {err && err !== "chapter_already_exists" && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            Error: {err}
          </p>
        )}

        <form
          action={handleCreateChapter}
          className="rounded-lg border border-gray-200 bg-white p-5 space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch <span className="text-red-500">*</span>
              </label>
              <select
                name="branchId"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select branch…</option>
                {branches.map((b) => (
                  <option key={b.branchId} value={b.branchId}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue="ACTIVE"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Launched On
              </label>
              <input
                type="date"
                name="launchedOn"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create chapter
          </button>
        </form>
      </section>
    </div>
  );
}
