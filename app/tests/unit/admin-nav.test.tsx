import { describe, expect, it } from "vitest";
import { adminNavForRole } from "@/lib/admin-nav";

const hrefs = (role: Parameters<typeof adminNavForRole>[0]) =>
  adminNavForRole(role).map((i) => i.href);

describe("adminNavForRole", () => {
  it("ADMIN gets 10 admin items + cross-links, no Users", () => {
    const h = hrefs("ADMIN");
    expect(h).toHaveLength(12);
    expect(h).not.toContain("/users");
    expect(h).toContain("/me");
    expect(h).toContain("/ministry");
  });
  it("SUPER_ADMIN additionally gets Users and the All Dashboards section", () => {
    const items = adminNavForRole("SUPER_ADMIN");
    const h = items.map((i) => i.href);
    expect(h).toContain("/users");
    const heading = items.find((i) => i.heading);
    expect(heading?.label).toBe("All Dashboards");
    // One link per role dashboard, after the heading.
    for (const href of ["/members", "/network", "/ministry", "/me"]) {
      expect(h.indexOf(href, h.indexOf("#all-dashboards"))).toBeGreaterThan(
        h.indexOf("#all-dashboards")
      );
    }
  });
  it("Users appears before the All Dashboards section", () => {
    const h = hrefs("SUPER_ADMIN");
    expect(h.indexOf("/users")).toBeLessThan(h.indexOf("#all-dashboards"));
  });
  it("ADMIN does not get the All Dashboards section", () => {
    expect(hrefs("ADMIN")).not.toContain("#all-dashboards");
    expect(hrefs("ADMIN")).not.toContain("/network");
  });
  it("every non-heading item has a label and an icon", () => {
    for (const item of adminNavForRole("SUPER_ADMIN")) {
      expect(item.label.length).toBeGreaterThan(0);
      if (!item.heading) expect(item.icon).toBeTruthy();
    }
  });
});
