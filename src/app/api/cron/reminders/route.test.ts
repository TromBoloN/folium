import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/finance/reminders-job", () => ({
  runReminders: vi.fn(async () => ({ sent: 0, failed: 0 })),
}));

import { GET } from "./route";

describe("GET /api/cron/reminders", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("returns 401 (not 500) when the Authorization header has multi-byte characters of matching string length", async () => {
    process.env.CRON_SECRET = "secret1234";
    // "Bearer secret1234" is 17 JS chars; "Bearer 🔑🔑🔑🔑🔑" is also 17 JS chars (surrogate pairs) but more UTF-8 bytes.
    const multiByte = `Bearer ${"é".repeat(10)}`;
    expect(multiByte.length).toBe("Bearer secret1234".length);
    const res = await GET(
      new Request("http://localhost/api/cron/reminders", { headers: { authorization: multiByte } }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 when the secret matches", async () => {
    process.env.CRON_SECRET = "secret1234";
    const res = await GET(
      new Request("http://localhost/api/cron/reminders", { headers: { authorization: "Bearer secret1234" } }),
    );
    expect(res.status).toBe(200);
  });
});
