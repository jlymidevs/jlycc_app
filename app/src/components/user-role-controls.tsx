// app/src/components/user-role-controls.tsx
"use client";

import { useTransition } from "react";
import {
  changeUserRole,
  setUserActive,
  provisionUserProfile,
} from "@/actions/users";

const ROLE_OPTIONS = ["MEMBER", "MINISTRY_HEAD", "ADMIN", "SUPER_ADMIN"];

export default function UserRoleControls({
  userId,
  role,
  isActive,
  hasProfile,
  isSelf,
}: {
  userId: string;
  role: string;
  isActive: boolean;
  hasProfile: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (isSelf) {
    return <span className="text-xs text-gray-400">you</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <select
        defaultValue={role}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            await changeUserRole(userId, e.target.value);
          })
        }
        className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {!hasProfile && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await provisionUserProfile(userId);
            })
          }
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Provision profile
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await setUserActive(userId, !isActive);
          })
        }
        className={`rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50 ${
          isActive
            ? "border border-red-300 text-red-600 hover:bg-red-50"
            : "border border-green-300 text-green-700 hover:bg-green-50"
        }`}
      >
        {isActive ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}
