// app/src/app/signup/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { signup, listActiveHeads } from "@/actions/account";
import { googleLoginAction } from "@/actions/auth";

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
          <img src="/jlycc-logo.png" alt="JLYCC" width={64} height={64} className="mx-auto" style={{ objectFit: "contain" }} />
        </div>

        <div className="card p-6 space-y-5">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Create account
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Join JLYCC and start your journey.
            </p>
          </div>

          {process.env.AUTH_GOOGLE_ID && (
            <>
              <form action={googleLoginAction}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors"
                  style={{
                    background: "var(--bg-card-hover)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Continue with Google
                </button>
              </form>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>or</span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>
            </>
          )}

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
