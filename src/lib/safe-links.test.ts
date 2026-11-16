import { describe, expect, it } from "vitest";
import { mailtoLink, normalizePhone, safeHttpsUrl, whatsappLink } from "./safe-links";

describe("safeHttpsUrl", () => {
  it("keeps https links, normalised", () => {
    expect(safeHttpsUrl(" https://meet.google.com/abc-defg-hij ")).toBe("https://meet.google.com/abc-defg-hij");
    expect(safeHttpsUrl("HTTPS://Zoom.us/j/123?pwd=x")).toBe("https://zoom.us/j/123?pwd=x");
  });

  it("rejects javascript:, data: and other schemes, in any case or disguise", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(document.cookie)",
      " javascript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "//evil.example/x",
      "http://meet.example/abc",
      "https://",
      "https:///no-host",
      "https://user:pass@meet.example/",
    ]) {
      expect(safeHttpsUrl(bad), bad).toBeNull();
    }
  });

  it("rejects line breaks and control characters (no header or .ics line injection)", () => {
    expect(safeHttpsUrl("https://meet.example/a\nBEGIN:VEVENT")).toBeNull();
    expect(safeHttpsUrl("https://meet.example/a\r\nX")).toBeNull();
    expect(safeHttpsUrl("https://meet.example/a b")).toBeNull();
    expect(safeHttpsUrl("https://meet.example/\u0000")).toBeNull();
    expect(safeHttpsUrl(null)).toBeNull();
    expect(safeHttpsUrl(42)).toBeNull();
  });
});

describe("phone and WhatsApp", () => {
  it("normalises to digits with an optional +", () => {
    expect(normalizePhone("+62 812-3456 (7890)")).toBe("+6281234567890");
    expect(normalizePhone("0812 3456 7890")).toBe("081234567890");
  });

  it("rejects anything that isn't a phone number", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/plain,1",
      "call me",
      "12345",
      "+1234567890123456",
      "0812\n3456",
    ]) {
      expect(normalizePhone(bad), bad).toBeNull();
      expect(whatsappLink(bad), bad).toBeNull();
    }
  });

  it("builds a digits-only wa.me link; a local 0 becomes 62", () => {
    expect(whatsappLink("0812-3456-7890")).toBe("https://wa.me/6281234567890");
    expect(whatsappLink("+62 812 3456 7890")).toBe("https://wa.me/6281234567890");
    expect(whatsappLink("+44 20 7946 0958")).toBe("https://wa.me/442079460958");
  });
});

describe("mailtoLink", () => {
  it("allows plain addresses only", () => {
    expect(mailtoLink(" siti.rahma@ft.campus.ac.id ")).toBe("mailto:siti.rahma@ft.campus.ac.id");
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,x",
      "a@b.co?cc=boss@x.com",
      "a@b.co&body=hi",
      "a b@c.co",
      "a@b.co\nBcc: x@y.co",
      "not-an-email",
    ]) {
      expect(mailtoLink(bad), bad).toBeNull();
    }
  });
});
