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
          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
        >
          <span className="text-base leading-none">+</span> Appoint
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 italic">Vacant</span>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
          >
            <span className="text-base leading-none">+</span> Appoint
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
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-gray-800 font-medium">
        {head.lastName}, {head.firstName}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={handleRemove}
        title="Remove"
        className="text-gray-400 hover:text-red-500 text-xs disabled:opacity-40 transition-colors flex-shrink-0"
      >
        ×
      </button>
    </div>
  );
}
