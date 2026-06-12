// app/src/components/user-role-controls.tsx
"use client";

import { useTransition } from "react";
import {
  changeUserRole,
  setUserActive,
  provisionUserProfile,
  archiveUser,
  reactivateUser,
} from "@/actions/users";

const ROLE_OPTIONS = ["MEMBER", "MINISTRY_HEAD", "NETWORK_HEAD", "ADMIN", "SUPER_ADMIN"];

export default function UserRoleControls({
  userId,
  role,
  isActive,
  hasProfile,
  isSelf,
  archivedAt,
}: {
  userId: string;
  role: string;
  isActive: boolean;
  hasProfile: boolean;
  isSelf: boolean;
  archivedAt?: Date | null;
}) {
  const [pending, startTransition] = useTransition();

  if (isSelf) {
    return <span className="text-xs" style={{ color: "var(--text-muted)" }}>you</span>;
  }

  // Archived: restore only
  if (archivedAt) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => { await reactivateUser(userId); })}
          className="rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          Restore
        </button>
      </div>
    );
  }

  // Suspended (inactive, not archived): activate only
  if (!isActive) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => { await setUserActive(userId, true); })}
          className="rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50"
          style={{ border: "1px solid #86efac", color: "#166534" }}
        >
          Activate
        </button>
      </div>
    );
  }

  // Active: full controls
  return (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      <select
        defaultValue={role}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => { await changeUserRole(userId, e.target.value); })
        }
        className="rounded-md px-2 py-1 text-xs focus:outline-none"
        style={{
          background: "var(--bg-inset)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      {!hasProfile && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => { await provisionUserProfile(userId); })}
          className="rounded-md px-2 py-1 text-xs disabled:opacity-50"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          Provision profile
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await setUserActive(userId, false); })}
        className="rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50"
        style={{ border: "1px solid #fca5a5", color: "#dc2626" }}
      >
        Suspend
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await archiveUser(userId); })}
        className="rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50"
        style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        Archive
      </button>
    </div>
  );
}
