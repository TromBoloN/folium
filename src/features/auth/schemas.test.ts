import { describe, expect, it } from "vitest";
import { safeNextPath, signUpSchema } from "./schemas";

describe("safeNextPath", () => {
  it.each([
    ["/courses", "/courses"],
    ["/tasks?due=today", "/tasks?due=today"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    ["courses", "/"],
    [null, "/"],
    [undefined, "/"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("signUpSchema", () => {
  it("normalises the email", () => {
    expect(signUpSchema.parse({ email: "  Ana@Example.COM ", password: "longenough" }).email).toBe("ana@example.com");
  });

  it("enforces the minimum password length", () => {
    expect(signUpSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
  });
});
