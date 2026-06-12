// app/src/app/(admin)/members/trash/trash-actions.tsx
"use client";

import { useTransition } from "react";
import { restoreMember, permanentDeleteMember } from "@/actions/members";

export function TrashActions({
  memberId,
  canPermanentDelete,
}: {
  memberId: number;
  canPermanentDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await restoreMember(memberId);
          })
        }
        className="rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors"
        style={{ border: "1px solid #86efac", color: "#166534" }}
      >
        Restore
      </button>
      {canPermanentDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("Permanently delete this member? This cannot be undone.")) {
              startTransition(async () => {
                await permanentDeleteMember(memberId);
              });
            }
          }}
          className="rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50 transition-colors"
          style={{ border: "1px solid #fca5a5", color: "#dc2626" }}
        >
          Delete forever
        </button>
      )}
    </div>
  );
}
