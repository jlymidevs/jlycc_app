"use client";

import { useState, useTransition, useRef } from "react";
import { addNetwork } from "@/actions/ministry-leaders";

export function AddNetworkForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addNetwork(name.trim());
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        setName("");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex h-12 w-full items-center justify-center rounded-xl border border-dashed border-blue-300 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
      >
        + Add Network
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-blue-300 bg-white px-3 py-2">
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") { setOpen(false); setName(""); }
        }}
        placeholder="Network name…"
        className="h-10 w-48 rounded-xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
        disabled={pending}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !name.trim()}
        className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white disabled:opacity-40"
      >
        {pending ? "…" : "Add"}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setName(""); }}
        className="h-10 rounded-xl px-2 text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
