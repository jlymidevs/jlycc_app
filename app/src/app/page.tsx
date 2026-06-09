import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute rounded-full blur-3xl opacity-20"
          style={{
            width: 600, height: 600,
            background: "radial-gradient(circle, #22c55e 0%, transparent 70%)",
            top: "50%", left: "50%", transform: "translate(-50%, -60%)",
          }}
        />
      </div>
      <div className="relative text-center space-y-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="JLYCC" width={80} height={80} className="mx-auto" />
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>JLYCC APP</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>JLY Church Admin Portal</p>
        </div>
        <Link href="/login" className="btn-accent inline-block">
          Sign in →
        </Link>
      </div>
    </div>
  );
}
