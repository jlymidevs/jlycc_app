"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push("/login"), 2500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Green radial glow */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 800,
            height: 800,
            background: "radial-gradient(circle, rgba(34,197,94,0.18) 0%, transparent 65%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      {/* Splash content */}
      <div
        className="relative flex flex-col items-center gap-8"
        style={{
          animation: "splashIn 0.7s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-512.png"
          alt="JLYCC"
          width={180}
          height={180}
          style={{ borderRadius: 36, boxShadow: "0 0 80px rgba(34,197,94,0.25)" }}
        />

        {/* Name */}
        <div className="text-center space-y-2">
          <h1
            className="text-5xl font-black tracking-tight"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
          >
            JLYCC
          </h1>
          <p className="text-base font-medium" style={{ color: "var(--text-secondary)" }}>
            JLY Church Admin Portal
          </p>
        </div>

        {/* Spinner */}
        <div
          className="w-8 h-8 rounded-full border-2"
          style={{
            borderColor: "var(--border)",
            borderTopColor: "var(--accent)",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes splashIn {
          from { opacity: 0; transform: scale(0.88) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
