import { describe, expect, it } from "vitest";
import { toCsv } from "./to-csv";

describe("toCsv", () => {
  it("joins fields with commas and records with CRLF", () => {
    expect(
      toCsv([
        ["date", "payee", "amount"],
        ["2026-11-16", "GoFood", 32000],
      ]),
    ).toBe("date,payee,amount\r\n2026-11-16,GoFood,32000");
  });

  it("quotes commas, quotes and line breaks (RFC 4180)", () => {
    expect(toCsv([["a,b", 'say "hi"', "line1\nline2", "cr\rhere", "plain"]])).toBe(
      '"a,b","say ""hi""","line1\nline2","cr\rhere",plain',
    );
  });

  it("writes null and undefined as empty fields", () => {
    expect(toCsv([[null, "x", undefined]])).toBe(",x,");
  });

  it("guards text against formula injection with a leading apostrophe", () => {
    expect(toCsv([["=SUM(A1:A9)", "+62812", "-5", "@cmd", "a=b"]])).toBe("'=SUM(A1:A9),'+62812,'-5,'@cmd,a=b");
  });

  it("guards and quotes together when needed", () => {
    expect(toCsv([['=HYPERLINK("http://x","y")']])).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
  });

  it("leaves numbers and bigints alone, negatives included", () => {
    expect(toCsv([[-25000, 0, 1.5, -9_007_199_254_740_993n, 123456789012345678901234567890n]])).toBe(
      "-25000,0,1.5,-9007199254740993,123456789012345678901234567890",
    );
  });

  it("an empty table is an empty string", () => {
    expect(toCsv([])).toBe("");
  });
});
