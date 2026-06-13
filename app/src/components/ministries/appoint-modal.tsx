// app/src/components/ministries/appoint-modal.tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import {
  searchEligibleMembers,
  appointNetworkHead,
  appointMinistryHead,
  appointInnerCore,
  EligibleMember,
  AppointmentType,
} from "@/actions/ministry-leaders";

type Props = {
  type: AppointmentType;
  networkId?: number;
  chapterId?: number;
  title: string;
  onClose: () => void;
};

export function AppointModal({
  type,
  networkId,
  chapterId,
  title,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EligibleMember[]>([]);
  const [selected, setSelected] = useState<EligibleMember | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchEligibleMembers(query, type, chapterId);
        setResults(found);
      } finally {
        setSearching(false);
      }
    }, query.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, type, chapterId]);

  const handleConfirm = () => {
    if (!selected) return;
    startTransition(async () => {
      let result: { success: true } | { error: string };
      if (type === "NETWORK_HEAD" && networkId) {
        result = await appointNetworkHead(networkId, selected.memberId);
      } else if (type === "MINISTRY_HEAD" && chapterId) {
        result = await appointMinistryHead(chapterId, selected.memberId);
      } else if (type === "INNER_CORE" && chapterId) {
        result = await appointInnerCore(chapterId, selected.memberId);
      } else {
        return;
      }
      if ("error" in result) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />

        {searching && (
          <p className="text-xs text-gray-400 text-center">Searching…</p>
        )}

        {results.length > 0 && (
          <ul className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-48 overflow-y-auto">
            {results.map((r) => (
              <li key={r.memberId}>
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                    selected?.memberId === r.memberId
                      ? "bg-blue-50 font-medium"
                      : ""
                  }`}
                >
                  <span className="font-medium">
                    {r.lastName}, {r.firstName}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {r.currentStage} · {r.branchName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!searching && results.length === 0 && (
          <p className="text-xs text-gray-400 text-center">No members found.</p>
        )}

        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || pending}
            onClick={handleConfirm}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {pending ? "Appointing…" : "Confirm Appoint"}
          </button>
        </div>
      </div>
    </div>
  );
}
