"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { checkInBacQr } from "@/actions/bac";

interface BacQrScannerProps {
  initiativeId: number;
  sessionId: number;
}

export default function BacQrScanner({ initiativeId, sessionId }: BacQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const reader = new BrowserQRCodeReader();
    let stopped = false;

    reader.decodeFromVideoDevice(undefined, videoRef.current!, async (result, _err, controls) => {
      if (stopped) return;
      if (!result) return;
      const personId = parseInt(result.getText(), 10);
      if (isNaN(personId)) { setError("Invalid QR code"); return; }
      stopped = true;
      controls.stop();
      setActive(false);
      try {
        await checkInBacQr(initiativeId, sessionId, personId);
        setMessage("Checked in");
        router.refresh();
      } catch {
        setError("Check-in failed");
      }
    }).then((c) => { controlsRef.current = c; });

    return () => { stopped = true; controlsRef.current?.stop(); };
  }, [active, initiativeId, sessionId, router]);

  return (
    <div className="space-y-3">
      <video ref={videoRef} className={active ? "w-full max-w-sm rounded" : "hidden"} />
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => { setMessage(null); setError(null); setActive((v) => !v); }}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {active ? "Stop scanner" : "Start QR scanner"}
      </button>
    </div>
  );
}
