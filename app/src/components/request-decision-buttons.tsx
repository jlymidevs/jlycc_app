// app/src/components/request-decision-buttons.tsx
"use client";

import { useTransition } from "react";
import { approveJoinRequest, rejectJoinRequest } from "@/actions/join-requests";

export default function RequestDecisionButtons({
  requestId,
}: {
  requestId: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await approveJoinRequest(requestId);
          })
        }
        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await rejectJoinRequest(requestId);
          })
        }
        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
