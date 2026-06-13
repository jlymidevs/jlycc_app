import type { Role } from "@/lib/authz";

type LeadershipState = {
  isActiveMinistryHead: boolean;
  isActiveNetworkHead: boolean;
};

export function roleForLeadershipState(
  currentRole: Role,
  state: LeadershipState
): Role {
  if (currentRole === "ADMIN" || currentRole === "SUPER_ADMIN") {
    return currentRole;
  }

  if (state.isActiveNetworkHead) return "NETWORK_HEAD";
  if (state.isActiveMinistryHead) return "MINISTRY_HEAD";
  return "MEMBER";
}
