"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { checkInPerson } from "@/actions/attendance";

interface QrScannerProps {
  eventId: number;
}

export default function QrScanner({ eventId }: QrScannerProps) {
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

    reader
      .decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        async (result, _err, controls) => {
          if (stopped) return;
          if (!result) return;

          const personId = parseInt(result.getText(), 10);
          if (isNaN(personId)) {
            setError("Invalid QR code");
            return;
          }

          stopped = true;
          controls.stop();
          setActive(false);

          const res = await checkInPerson(eventId, personId);
          if ("error" in res) {
            setError(
              res.error === "already_checked_in"
                ? "Already checked in"
                : res.error
            );
          } else {
            setMessage(`Checked in: ${res.name}`);
            router.refresh();
          }
        }
      )
      .then((controls) => {
        controlsRef.current = controls;
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Camera error");
        setActive(false);
      });

    return () => {
      stopped = true;
      controlsRef.current?.stop();
    };
  }, [active, eventId, router]);

  return (
    <div className="space-y-2">
      {!active && (
        <button
          onClick={() => {
            setMessage(null);
            setError(null);
            setActive(true);
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Scan QR
        </button>
      )}
      {active && (
        <div className="space-y-2">
          <video ref={videoRef} className="w-64 h-48 rounded border" />
          <button
            onClick={() => {
              controlsRef.current?.stop();
              setActive(false);
            }}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Cancel scan
          </button>
        </div>
      )}
      {message && (
        <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-1">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 rounded px-3 py-1">
          {error}
        </p>
      )}
    </div>
  );
}
