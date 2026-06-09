// app/src/app/(admin)/layout.tsx
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-gray-900">JLY Church Admin</span>
          <Link
            href="/members"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Members
          </Link>
          <Link
            href="/members/applications"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Applications
          </Link>
          <Link
            href="/events"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Events
          </Link>
          <Link
            href="/events/attendance"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Attendance
          </Link>
          <Link href="/programs/heartlink" className="text-sm text-gray-600 hover:text-gray-900">
            Programs
          </Link>
          <Link
            href="/education/bc/students"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Education
          </Link>
          <Link
            href="/ministries"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Ministries
          </Link>
          <Link
            href="/missions/scholarships"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Missions
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user?.email}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
