// app/src/app/me/calendar/page.tsx
// Church calendar inside the member dashboard shell — same data as the
// public /church/calendar page, but the sidebar stays put.
export const dynamic = "force-dynamic";

import ChurchCalendar from "@/components/church-calendar";

export default function MemberCalendarPage({
  searchParams,
}: {
  searchParams: { month?: string; type?: string };
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <ChurchCalendar basePath="/me/calendar" searchParams={searchParams} />
    </div>
  );
}
