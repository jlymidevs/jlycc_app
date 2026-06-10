// app/src/app/signup/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { signup, listActiveHeads } from "@/actions/account";

export default async function SignupPage() {
  const heads = await listActiveHeads();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">
            Join JLY Church and start your journey.
          </p>
        </div>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <form action={signup as any} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First name <span className="text-red-500">*</span>
              </label>
              <input
                name="firstName"
                type="text"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last name <span className="text-red-500">*</span>
              </label>
              <input
                name="lastName"
                type="text"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">At least 8 characters.</p>
          </div>

          {heads.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your ministry head <span className="text-red-500">*</span>
              </label>
              <select
                name="chapterId"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose your ministry head…</option>
                {heads.map((h) => (
                  <option key={h.chapterId} value={h.chapterId}>
                    {h.headFirstName} {h.headLastName} — {h.ministryName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Your head will approve your request (this becomes your 1st-priority
                ministry).
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign up
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:text-blue-800">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
