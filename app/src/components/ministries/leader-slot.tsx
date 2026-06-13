// app/src/components/ministries/leader-slot.tsx
"use client";

import { useState, useTransition } from "react";
import {
  removeNetworkHead,
  removeMinistryHead,
  removeInnerCore,
  AppointmentType,
} from "@/actions/ministry-leaders";
import { AppointModal } from "./appoint-modal";

type HeadInfo = {
  leaderId: number;
  memberId: number;
  firstName: string;
  lastName: string;
  memberCode: string;
};

type Props = {
  type: AppointmentType;
  networkId?: number;
  chapterId?: number;
  membershipId?: number;
  head: HeadInfo | null;
  alwaysShowAppoint?: boolean;
};

export function LeaderSlot({
  type,
  networkId,
  chapterId,
  membershipId,
  head,
  alwaysShowAppoint,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [pending, startTransition] = useTransition();

  const modalTitle =
    type === "NETWORK_HEAD"
      ? "Appoint Network Head"
      : type === "MINISTRY_HEAD"
      ? "Appoint Ministry Head"
      : "Appoint Inner Core";

  const handleRemove = () => {
    startTransition(async () => {
      if (type === "NETWORK_HEAD" && networkId) {
        await removeNetworkHead(networkId);
      } else if (type === "MINISTRY_HEAD" && chapterId) {
        await removeMinistryHead(chapterId);
      } else if (type === "INNER_CORE" && membershipId) {
        await removeInnerCore(membershipId);
      }
    });
  };

  // Inner Core "always show appoint" slot (add another)
  if (alwaysShowAppoint && !head) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs font-medium text-lime-700 hover:border-lime-300 hover:bg-lime-50"
        >
          <span className="text-sm leading-none">+</span> Add inner core
        </button>
        {showModal && (
          <AppointModal
            type={type}
            chapterId={chapterId}
            networkId={networkId}
            title={modalTitle}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  if (!head) {
    return (
      <>
        <div className="mt-1 flex items-center justify-between gap-2 rounded-md bg-amber-50 px-2 py-1.5">
          <span className="text-sm font-medium italic text-amber-800">
            Vacant
          </span>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-lime-700 shadow-sm ring-1 ring-inset ring-lime-200 hover:bg-lime-50"
          >
            <span className="text-sm leading-none">+</span> Appoint
          </button>
        </div>
        {showModal && (
          <AppointModal
            type={type}
            chapterId={chapterId}
            networkId={networkId}
            title={modalTitle}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="mt-1 flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">
          {head.lastName}, {head.firstName}
        </p>
        <p className="text-[11px] text-gray-500">{head.memberCode}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={handleRemove}
        title="Remove"
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
      >
        ×
      </button>
    </div>
  );
}
