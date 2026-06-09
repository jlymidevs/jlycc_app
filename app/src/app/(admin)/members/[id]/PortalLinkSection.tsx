"use client";
import { useState } from "react";

export function PortalLinkSection({ portalUrl }: { portalUrl: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Portal Link</h2>
      <p className="text-sm text-gray-500">
        Share this link with the member so they can view their church record.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={portalUrl}
          className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 min-w-[90px]"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
