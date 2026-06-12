// app/src/components/members/list-search.tsx
// Server component — native GET form for filtering member/user lists, no client JS.

interface ListSearchProps {
  action: string;
  paramName?: string;
  defaultValue?: string;
  placeholder?: string;
  /** Other query params to preserve when this form submits. */
  preserveParams?: Record<string, string>;
  /** "lime" matches the CSS-var dashboard theme, "gray" the classic admin pages. */
  variant?: "gray" | "lime";
}

export function ListSearch({
  action,
  paramName = "q",
  defaultValue = "",
  placeholder = "Search by name…",
  preserveParams = {},
  variant = "gray",
}: ListSearchProps) {
  const inputClass =
    variant === "lime"
      ? "w-64 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2"
      : "w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const buttonClass =
    variant === "lime"
      ? "rounded-md px-4 py-2 text-sm font-medium"
      : "rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50";

  return (
    <form method="get" action={action} className="flex gap-2">
      {Object.entries(preserveParams)
        .filter(([, v]) => v.length > 0)
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <input
        name={paramName}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={inputClass}
        style={
          variant === "lime"
            ? {
                background: "var(--bg-inset)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }
            : undefined
        }
      />
      <button
        type="submit"
        className={buttonClass}
        style={
          variant === "lime"
            ? { background: "var(--lime-soft)", color: "var(--text-primary)" }
            : undefined
        }
      >
        Search
      </button>
    </form>
  );
}
