// app/src/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">JLY Church</h1>
        <p className="text-gray-500">Staff portal coming soon.</p>
        <Link
          href="/members"
          className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Staff login →
        </Link>
      </div>
    </div>
  );
}
