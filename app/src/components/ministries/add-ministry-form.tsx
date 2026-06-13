// app/src/components/ministries/add-ministry-form.tsx
"use client";

import { useState, useTransition, useRef } from "react";
import { addMinistry } from "@/actions/ministry-leaders";

export function AddMinistryForm({
  networkId,
  variant = "inline",
}: {
  networkId: number;
  variant?: "inline" | "primary";
}) {
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
      const result = await addMinistry(networkId, name.trim());
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
        className={
          variant === "primary"
            ? "inline-flex h-10 items-center justify-center rounded-xl bg-lime-300 px-4 text-sm font-bold text-gray-950 shadow-sm transition-colors hover:bg-lime-200"
            : "inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-700"
        }
      >
        + Add Ministry
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") { setOpen(false); setName(""); }
        }}
        placeholder="Ministry name…"
        className="h-10 w-48 rounded-xl border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200"
        disabled={pending}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !name.trim()}
        className="h-10 rounded-xl bg-gray-950 px-4 text-xs font-bold text-white disabled:opacity-40"
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
