// app/src/components/ministries/delete-ministry-button.tsx
"use client";

import { useState, useTransition } from "react";
import { deleteMinistry } from "@/actions/ministry-leaders";

export function DeleteMinistryButton({
  ministryId,
  ministryName,
}: {
  ministryId: number;
  ministryName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={pending}
      title={error ?? "Delete ministry"}
      onClick={() => {
        if (
          confirm(
            `Delete "${ministryName}"? This removes its chapters and memberships. This cannot be undone.`
          )
        ) {
          setError(null);
          startTransition(async () => {
            const res = await deleteMinistry(ministryId);
            if ("error" in res) setError(res.error);
          });
        }
      }}
      className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="w-3.5 h-3.5"
      >
        <path d="M6.5 1.5a.5.5 0 0 0-.5.5V3H3.5a.75.75 0 0 0 0 1.5h.06l.54 8.1A1.75 1.75 0 0 0 5.9 14.5h4.2a1.75 1.75 0 0 0 1.74-1.9l.54-8.1h.06a.75.75 0 0 0 0-1.5H10V2a.5.5 0 0 0-.5-.5h-3ZM7 6.25a.625.625 0 0 0-1.25 0v4a.625.625 0 0 0 1.25 0v-4Zm3.25 0a.625.625 0 1 0-1.25 0v4a.625.625 0 0 0 1.25 0v-4Z" />
      </svg>
    </button>
  );
}
