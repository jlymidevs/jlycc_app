import { describe, it, expect } from "vitest";
import { buildAnnouncementHtml } from "@/lib/email";

describe("buildAnnouncementHtml", () => {
  it("includes the announcement title", () => {
    const html = buildAnnouncementHtml({
      title: "Sunday Service Update",
      body: "Service starts at 9am.",
      recipientName: "Juan dela Cruz",
    });
    expect(html).toContain("Sunday Service Update");
  });

  it("includes the announcement body", () => {
    const html = buildAnnouncementHtml({
      title: "Sunday Service Update",
      body: "Service starts at 9am.",
      recipientName: "Juan dela Cruz",
    });
    expect(html).toContain("Service starts at 9am.");
  });

  it("includes the recipient name", () => {
    const html = buildAnnouncementHtml({
      title: "Sunday Service Update",
      body: "Service starts at 9am.",
      recipientName: "Juan dela Cruz",
    });
    expect(html).toContain("Juan dela Cruz");
  });

  it("returns a non-empty string", () => {
    const html = buildAnnouncementHtml({
      title: "T",
      body: "B",
      recipientName: "N",
    });
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });

  it("escapes HTML special chars in title", () => {
    const html = buildAnnouncementHtml({
      title: "<script>alert(1)</script>",
      body: "body",
      recipientName: "name",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML special chars in body", () => {
    const html = buildAnnouncementHtml({
      title: "title",
      body: "<b>bold</b>",
      recipientName: "name",
    });
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("escapes HTML special chars in recipientName", () => {
    const html = buildAnnouncementHtml({
      title: "title",
      body: "body",
      recipientName: '<a href="#">hack</a>',
    });
    expect(html).not.toContain("<a ");
    expect(html).toContain("&lt;a ");
  });
});
