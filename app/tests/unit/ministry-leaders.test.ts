import { describe, it, expect } from "vitest";
import { buildLeaderSearchWhere } from "@/lib/ministry-leader-eligibility";

describe("buildLeaderSearchWhere — appointment type eligibility", () => {
  it("NETWORK_HEAD requires head-eligible stage", () => {
    const result = buildLeaderSearchWhere("NETWORK_HEAD");
    expect(result.requiresHeadEligible).toBe(true);
    expect(result.requiresChapterMember).toBe(false);
  });

  it("MINISTRY_HEAD requires head-eligible stage and chapter membership", () => {
    const result = buildLeaderSearchWhere("MINISTRY_HEAD");
    expect(result.requiresHeadEligible).toBe(true);
    expect(result.requiresChapterMember).toBe(true);
  });

  it("INNER_CORE requires chapter membership only", () => {
    const result = buildLeaderSearchWhere("INNER_CORE");
    expect(result.requiresHeadEligible).toBe(false);
    expect(result.requiresChapterMember).toBe(true);
  });
});
