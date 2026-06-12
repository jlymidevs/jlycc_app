import { describe, expect, it } from "vitest";
import { memberNavForRole } from "@/lib/member-nav";

const hrefs = (role: Parameters<typeof memberNavForRole>[0]) =>
  memberNavForRole(role).map((i) => i.href);

describe("memberNavForRole", () => {
  it("MEMBER sees base items only", () => {
    expect(hrefs("MEMBER")).toEqual([
      "/me",
      "/me/attendance",
      "/me/ministries",
      "/me/announcements",
      "/me/calendar",
    ]);
  });
  it("MINISTRY_HEAD also sees ministry dashboard", () => {
    expect(hrefs("MINISTRY_HEAD")).toContain("/ministry");
    expect(hrefs("MINISTRY_HEAD")).not.toContain("/members");
  });
  it("ADMIN sees ministry dashboard and admin portal", () => {
    expect(hrefs("ADMIN")).toContain("/ministry");
    expect(hrefs("ADMIN")).toContain("/members");
  });
  it("SUPER_ADMIN sees everything ADMIN sees", () => {
    expect(hrefs("SUPER_ADMIN")).toEqual(hrefs("ADMIN"));
  });
  it("every item has a label and an icon", () => {
    for (const item of memberNavForRole("SUPER_ADMIN")) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeTruthy();
    }
  });
});
