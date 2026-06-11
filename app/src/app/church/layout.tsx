import Link from "next/link";

export default function ChurchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <Link
          href="/church"
          className="flex items-center gap-2 font-semibold text-gray-900 hover:text-gray-700"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/jlycc-logo.png" alt="JLYCC" width={28} height={28} style={{ objectFit: "contain" }} />
          JLYCC
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/church/calendar"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Calendar
          </Link>
          <Link
            href="/church/events"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Events
          </Link>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
