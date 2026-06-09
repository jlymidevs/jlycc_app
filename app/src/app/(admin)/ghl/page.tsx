"use client";

import { useState } from "react";
import { importFromGHL, pushMembersToGHL } from "@/actions/ghl";

type SyncResult = { imported: number; skipped: number; errors: number };

export default function GHLSyncPage() {
  const [importing, setImporting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [importResult, setImportResult] = useState<SyncResult | null>(null);
  const [pushResult, setPushResult] = useState<SyncResult | null>(null);

  async function handleImport() {
    setImporting(true);
    setImportResult(null);
    try {
      const r = await importFromGHL();
      setImportResult(r);
    } finally {
      setImporting(false);
    }
  }

  async function handlePush() {
    setPushing(true);
    setPushResult(null);
    try {
      const r = await pushMembersToGHL();
      setPushResult(r);
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          GoHighLevel Sync
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Sync members between JLYCC App and your GHL location.
        </p>
      </div>

      {/* Status badge */}
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
        style={{ background: "rgba(31,138,139,0.08)", border: "1px solid rgba(31,138,139,0.2)" }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: "var(--teal)" }}
        />
        <span style={{ color: "var(--teal)" }} className="font-medium">Connected</span>
        <span style={{ color: "var(--text-muted)" }}>— Location ID: DiD7LkE8KQEe9zWMUJl5</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Import from GHL */}
        <div className="card p-5 space-y-4">
          <div>
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Import from GHL
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Pull GHL contacts → create members not yet in JLYCC
            </p>
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="btn-accent w-full text-center"
            style={{ opacity: importing ? 0.6 : 1 }}
          >
            {importing ? "Importing…" : "Import from GHL →"}
          </button>
          {importResult && (
            <ResultBadges result={importResult} label="imported" />
          )}
        </div>

        {/* Push to GHL */}
        <div className="card p-5 space-y-4">
          <div>
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Push to GHL
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Push JLYCC members without a GHL contact → create in GHL
            </p>
          </div>
          <button
            onClick={handlePush}
            disabled={pushing}
            className="btn-accent w-full text-center"
            style={{ opacity: pushing ? 0.6 : 1 }}
          >
            {pushing ? "Pushing…" : "Push to GHL →"}
          </button>
          {pushResult && (
            <ResultBadges result={pushResult} label="pushed" />
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          How sync works
        </h2>
        <ul className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <li className="flex gap-2">
            <span style={{ color: "var(--teal)" }}>→</span>
            New member created in JLYCC → automatically pushed to GHL as a contact
          </li>
          <li className="flex gap-2">
            <span style={{ color: "var(--teal)" }}>→</span>
            Member updated in JLYCC → GHL contact updated
          </li>
          <li className="flex gap-2">
            <span style={{ color: "var(--teal)" }}>→</span>
            Announcements published → email + SMS sent via GHL to members with contact info
          </li>
          <li className="flex gap-2">
            <span style={{ color: "var(--teal)" }}>↔</span>
            Import/Push buttons for bulk one-time sync
          </li>
        </ul>
      </div>
    </div>
  );
}

function ResultBadges({ result, label }: { result: SyncResult; label: string }) {
  return (
    <div className="flex gap-2 flex-wrap text-xs">
      <span className="badge-green">{result.imported} {label}</span>
      <span className="badge-gray">{result.skipped} skipped</span>
      {result.errors > 0 && <span className="badge-red">{result.errors} errors</span>}
    </div>
  );
}
