// app/src/components/ministries/close-ministry-button.tsx
"use client";

import { useTransition } from "react";
import { closeMinistry } from "@/actions/ministry-leaders";

export function CloseMinistryButton({ ministryId }: { ministryId: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      title="Close ministry"
      onClick={() => {
        if (confirm("Close this ministry? All chapters will be marked CLOSED.")) {
          startTransition(async () => {
            await closeMinistry(ministryId);
          });
        }
      }}
      className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
      </svg>
    </button>
  );
}
