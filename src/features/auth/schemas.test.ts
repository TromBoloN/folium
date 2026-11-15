import { describe, expect, it } from "vitest";
import { EMAIL_OTP_TYPES, forgotPasswordSchema, safeNextPath, signUpSchema, updatePasswordSchema } from "./schemas";

describe("safeNextPath", () => {
  it.each([
    ["/courses", "/courses"],
    ["/tasks?due=today", "/tasks?due=today"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    ["/\t/evil.example", "/"],
    ["/\n/evil.example", "/"],
    ["/ /evil.example", "/"],
    ["/%2F%2Fevil.example", "/%2F%2Fevil.example"],
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

describe("password reset schemas", () => {
  it("normalises the reset email", () => {
    expect(forgotPasswordSchema.parse({ email: " Ana@Example.com " }).email).toBe("ana@example.com");
  });

  it("requires matching passwords, reported on the confirm field", () => {
    const result = updatePasswordSchema.safeParse({ password: "long-enough-1", confirm: "long-enough-2" });
    expect(result.error?.issues[0].path).toEqual(["confirm"]);
  });

  it("enforces the length rules on the new password", () => {
    expect(updatePasswordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
    expect(updatePasswordSchema.safeParse({ password: "x".repeat(73), confirm: "x".repeat(73) }).success).toBe(false);
    expect(updatePasswordSchema.safeParse({ password: "long-enough-1", confirm: "long-enough-1" }).success).toBe(true);
  });

  it("only accepts known email link types", () => {
    expect(EMAIL_OTP_TYPES).toContain("recovery");
    expect(EMAIL_OTP_TYPES).not.toContain("sms" as never);
  });
});
