// app/src/components/members/member-search.tsx
// Server component — native GET form, no client-side JS needed.

interface MemberSearchProps {
  defaultValue?: string;
}

export function MemberSearch({ defaultValue = "" }: MemberSearchProps) {
  return (
    <form method="get" action="/members" className="flex gap-2">
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder="Search by name…"
        className="rounded-md border border-gray-300 px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Search
      </button>
    </form>
  );
}
