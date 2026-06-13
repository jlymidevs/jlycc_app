// app/src/components/ministries/edit-network-button.tsx
"use client";

import { useState, useTransition } from "react";
import { renameNetwork } from "@/actions/ministry-leaders";

export function EditNetworkButton({
  networkId,
  networkName,
}: {
  networkId: number;
  networkName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={pending}
      title={error ?? "Rename network"}
      onClick={() => {
        const next = prompt("Rename network:", networkName);
        if (next === null) return;
        if (!next.trim() || next.trim() === networkName) return;
        setError(null);
        startTransition(async () => {
          const res = await renameNetwork(networkId, next.trim());
          if ("error" in res) setError(res.error);
        });
      }}
      className="rounded p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 disabled:opacity-40 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className="w-4 h-4"
      >
        <path d="M12.146 1.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1 0 .708l-8.5 8.5a.5.5 0 0 1-.233.131l-3 .75a.5.5 0 0 1-.606-.606l.75-3a.5.5 0 0 1 .131-.232l8.5-8.5Zm.354 1.061L11.207 3.5 12.5 4.793 13.793 3.5 12.5 2.207Z" />
      </svg>
    </button>
  );
}
