// app/src/components/series-pattern-fields.tsx
"use client";

import { useState } from "react";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function SeriesPatternFields() {
  const [pattern, setPattern] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Repeats <span className="text-red-500">*</span>
        </label>
        <select
          name="recurrencePattern"
          required
          value={pattern}
          onChange={(e) => setPattern(e.target.value as "WEEKLY" | "MONTHLY")}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
        </select>
      </div>

      {pattern === "WEEKLY" ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Day of week <span className="text-red-500">*</span>
          </label>
          <select
            name="dayOfWeek"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Day of month <span className="text-red-500">*</span>
          </label>
          <input
            name="dayOfMonth"
            type="number"
            min="1"
            max="31"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </>
  );
}
