// app/src/app/signup/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { signup, listActiveHeads } from "@/actions/account";

export default async function SignupPage() {
  const heads = await listActiveHeads();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute rounded-full blur-3xl opacity-20"
          style={{
            width: 600,
            height: 600,
            background: "radial-gradient(circle, rgba(31,138,139,0.25) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -60%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="JLYCC" width={64} height={64} className="mx-auto" />
        </div>

        <div className="card p-6 space-y-5">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Create account
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Join JLY Church and start your journey.
            </p>
          </div>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form action={signup as any} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  First name <span style={{ color: "var(--accent, #1f8a8b)" }}>*</span>
                </label>
                <input name="firstName" type="text" required className="input-dark" />
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Last name <span style={{ color: "var(--accent, #1f8a8b)" }}>*</span>
                </label>
                <input name="lastName" type="text" required className="input-dark" />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Email <span style={{ color: "var(--accent, #1f8a8b)" }}>*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="input-dark"
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Password <span style={{ color: "var(--accent, #1f8a8b)" }}>*</span>
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                className="input-dark"
              />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                At least 8 characters.
              </p>
            </div>

            {heads.length > 0 && (
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Your ministry head <span style={{ color: "var(--accent, #1f8a8b)" }}>*</span>
                </label>
                <select name="chapterId" required className="input-dark">
                  <option value="">Choose your ministry head…</option>
                  {heads.map((h) => (
                    <option key={h.chapterId} value={h.chapterId}>
                      {h.headFirstName} {h.headLastName} — {h.ministryName}
                    </option>
                  ))}
                </select>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Your head will approve your request (this becomes your 1st-priority
                  ministry).
                </p>
              </div>
            )}

            <button type="submit" className="btn-accent w-full mt-1">
              Sign up
            </button>
          </form>

          <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--accent, #1f8a8b)" }}>
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
