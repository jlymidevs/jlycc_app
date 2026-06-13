import { describe, expect, it } from "vitest";
import { roleForLeadershipState } from "@/lib/ministry-dashboard-sync";

describe("roleForLeadershipState", () => {
  it("keeps the dashboard role matched to active ministry and network leadership", () => {
    expect(
      roleForLeadershipState("MEMBER", {
        isActiveMinistryHead: true,
        isActiveNetworkHead: false,
      })
    ).toBe("MINISTRY_HEAD");

    expect(
      roleForLeadershipState("MINISTRY_HEAD", {
        isActiveMinistryHead: false,
        isActiveNetworkHead: true,
      })
    ).toBe("NETWORK_HEAD");

    expect(
      roleForLeadershipState("NETWORK_HEAD", {
        isActiveMinistryHead: true,
        isActiveNetworkHead: false,
      })
    ).toBe("MINISTRY_HEAD");

    expect(
      roleForLeadershipState("MINISTRY_HEAD", {
        isActiveMinistryHead: false,
        isActiveNetworkHead: false,
      })
    ).toBe("MEMBER");
  });

  it("does not downgrade admin roles when leadership changes", () => {
    expect(
      roleForLeadershipState("ADMIN", {
        isActiveMinistryHead: false,
        isActiveNetworkHead: false,
      })
    ).toBe("ADMIN");

    expect(
      roleForLeadershipState("SUPER_ADMIN", {
        isActiveMinistryHead: true,
        isActiveNetworkHead: true,
      })
    ).toBe("SUPER_ADMIN");
  });
});
