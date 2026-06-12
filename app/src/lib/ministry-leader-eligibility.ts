export type AppointmentType = "NETWORK_HEAD" | "MINISTRY_HEAD" | "INNER_CORE";

export function buildLeaderSearchWhere(type: AppointmentType): {
  requiresHeadEligible: boolean;
  requiresChapterMember: boolean;
} {
  return {
    requiresHeadEligible: type === "NETWORK_HEAD" || type === "MINISTRY_HEAD",
    requiresChapterMember: type === "MINISTRY_HEAD" || type === "INNER_CORE",
  };
}
