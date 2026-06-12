// app/src/app/church/calendar/page.tsx
export const dynamic = "force-dynamic";

import ChurchCalendar from "@/components/church-calendar";

export default function ChurchCalendarPage({
  searchParams,
}: {
  searchParams: { month?: string; type?: string };
}) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <ChurchCalendar basePath="/church/calendar" searchParams={searchParams} />
    </div>
  );
}
