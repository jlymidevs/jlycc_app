// app/src/components/calendar-view-toggle.tsx
"use client";

import { useEffect, useState } from "react";

type View = "grid" | "list";

export default function CalendarViewToggle({
  grid,
  list,
}: {
  grid: React.ReactNode;
  list: React.ReactNode;
}) {
  // null until hydrated → CSS responsive default (grid ≥ md, list below)
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("calendarView");
    if (saved === "grid" || saved === "list") setView(saved);
    else setView(window.innerWidth >= 768 ? "grid" : "list");
  }, []);

  function select(v: View) {
    setView(v);
    window.localStorage.setItem("calendarView", v);
  }

  const btn = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => select(v)}
      aria-pressed={view === v}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        view === v
          ? "bg-blue-600 text-white"
          : "border border-gray-300 text-gray-700 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {btn("grid", "Grid")}
        {btn("list", "List")}
      </div>
      <div
        className={
          view === null ? "hidden md:block" : view === "grid" ? "" : "hidden"
        }
      >
        {grid}
      </div>
      <div
        className={
          view === null ? "md:hidden" : view === "list" ? "" : "hidden"
        }
      >
        {list}
      </div>
    </div>
  );
}
