import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmailMock, createAdminClientMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({
  emailConfigured: () => true,
  escapeHtml: (s: string) => s,
  sendEmail: sendEmailMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { runReminders } from "./reminders-job";

/** Minimal chainable PostgREST query mock that resolves when awaited. */
function queryStub(resolve: () => { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "not", "lte", "gte", "lt", "in", "order", "range", "upsert", "delete"]) {
    builder[m] = () => builder;
  }
  // biome-ignore lint/suspicious/noThenProperty: PostgREST query builders are thenable.
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(resolve()).then(onFulfilled, onRejected);
  return builder;
}

describe("runReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("releases the claimed weekly_summary key and sends no false Rp 0 email when spentRows fails", async () => {
    const deletedKinds: string[] = [];
    let txCalls = 0;

    createAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: { email: "student@test.local" } }, error: null }),
        },
      },
      from: (table: string) => {
        if (table === "user_settings") {
          return queryStub(() => ({
            data: [{ user_id: "u1", preferences: { weeklySummaryEmail: true, timeZone: "Asia/Makassar" } }],
            error: null,
          }));
        }
        if (table === "recurring_rules") {
          return queryStub(() => ({ data: [], error: null }));
        }
        if (table === "transactions") {
          txCalls++;
          // First transactions read = planned bills (ok); second = spentRows (DB error!).
          return queryStub(() =>
            txCalls === 1 ? { data: [], error: null } : { data: null, error: { message: "connection reset" } },
          );
        }
        if (table === "notification_log") {
          const stub = queryStub(() => ({ data: [{ ref_key: "week:2026-11-16" }], error: null }));
          stub.delete = () => {
            deletedKinds.push("weekly_summary");
            return queryStub(() => ({ data: null, error: null }));
          };
          return stub;
        }
        throw new Error(`unexpected table ${table}`);
      },
    });

    // Monday 2026-11-16 09:00 WITA (01:00 UTC).
    const result = await runReminders(new Date("2026-11-16T01:00:00Z"));
    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(deletedKinds).toEqual(["weekly_summary"]);
  });

  it("releases claimed bill_due keys when sendEmail fails", async () => {
    const released: string[] = [];
    sendEmailMock.mockResolvedValue({ ok: false });

    createAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: { email: "student@test.local" } }, error: null }),
        },
      },
      from: (table: string) => {
        if (table === "user_settings") {
          return queryStub(() => ({
            data: [{ user_id: "u1", preferences: { billReminderEmails: true, timeZone: "Asia/Makassar" } }],
            error: null,
          }));
        }
        if (table === "transactions") {
          return queryStub(() => ({
            data: [
              {
                id: "tx1",
                kind: "expense",
                amount: "500000",
                due_on: "2026-11-18",
                occurred_on: "2026-11-18",
                recurring_rule_id: "r1",
              },
            ],
            error: null,
          }));
        }
        if (table === "recurring_rules") {
          return queryStub(() => ({ data: [{ id: "r1", name: "Kos", remind_days_before: 3 }], error: null }));
        }
        if (table === "notification_log") {
          const stub = queryStub(() => ({ data: [{ ref_key: "tx1:2026-11-18" }], error: null }));
          stub.delete = () => {
            released.push("bill_due");
            return queryStub(() => ({ data: null, error: null }));
          };
          return stub;
        }
        throw new Error(`unexpected table ${table}`);
      },
    });

    const result = await runReminders(new Date("2026-11-16T01:00:00Z"));
    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(released).toEqual(["bill_due"]);
  });
});
