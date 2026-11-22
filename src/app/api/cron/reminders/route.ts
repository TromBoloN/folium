import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/features/finance/reminders-job";

/**
 * Daily reminders (bills due soon, Monday summaries). Called by Vercel Cron
 * (vercel.json, 00:00 UTC = 08:00 WITA), which sends
 * `Authorization: Bearer $CRON_SECRET`. Locally:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/reminders
 * and read the email in Mailpit (MAILPIT_URL).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  const ok = Boolean(secret) && a.length === b.length && timingSafeEqual(a, b);
  if (!ok) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await runReminders(new Date());
    return Response.json(result);
  } catch (error) {
    console.error("[cron] reminders", error);
    return Response.json({ error: "Reminders failed" }, { status: 500 });
  }
}
