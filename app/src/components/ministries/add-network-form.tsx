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
        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 border border-dashed border-blue-300 rounded-lg px-3 py-2 w-full hover:bg-blue-50 transition-colors"
      >
        <span className="text-base leading-none font-medium">+</span> Add network
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 border border-dashed border-blue-300 rounded-lg px-3 py-2">
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
        className="rounded-md border border-gray-300 px-2 py-1 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
        disabled={pending}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !name.trim()}
        className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
      >
        {pending ? "…" : "Add"}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setName(""); }}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
