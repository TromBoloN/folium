import { makeT, plural } from "@/lib/i18n/core";
import "server-only";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/dates";
import { emailConfigured, escapeHtml, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatIdr } from "./lib/format-idr";
import { addDays, localDateFor } from "./lib/local-date";
import { remindersDue, weekKey } from "./lib/reminders";

/**
 * The daily reminders job (Vercel Cron → /api/cron/reminders, about 08:00 WITA).
 * For every user who turned emails on: bills whose reminder window has started,
 * and on their Monday a weekly summary. Idempotent: each reminder is claimed in
 * notification_log (unique key) BEFORE sending, and released if the send fails,
 * so a retried run never double-sends.
 *
 * Bills are the planned rows the app already generated (on Money/Today visits,
 * 45 days ahead), so a user who hasn't opened Folium in 45 days gets no bill
 * emails until they do.
 */
export async function runReminders(now: Date) {
  const admin = createAdminClient();
  if (!admin) return { skipped: "SUPABASE_SECRET_KEY is not set" };
  if (!emailConfigured()) return { skipped: "No email provider configured" };

  const { data: settings, error } = await admin.from("user_settings").select("user_id, preferences");
  if (error) throw new Error(`settings: ${error.message}`);
  let sent = 0;
  let failed = 0;

  for (const row of settings ?? []) {
    const prefs = (row.preferences ?? {}) as Record<string, unknown>;
    const bills = prefs.billReminderEmails === true;
    const weekly = prefs.weeklySummaryEmail === true;
    if (!bills && !weekly) continue;
    const timeZone = isValidTimeZone(prefs.timeZone) ? prefs.timeZone : DEFAULT_TIME_ZONE;
    // Emails go out in the user's language too.
    const t = makeT(prefs.language === "id" ? "id" : "en");
    const today = localDateFor(now, timeZone);
    const { data: user } = await admin.auth.admin.getUserById(row.user_id);
    const to = user.user?.email;
    if (!to) continue;

    const [{ data: planned }, { data: rules }] = await Promise.all([
      admin
        .from("transactions")
        .select("id, kind, amount::text, due_on, occurred_on, recurring_rule_id")
        .eq("user_id", row.user_id)
        .eq("status", "planned")
        .not("recurring_rule_id", "is", null)
        .lte("occurred_on", addDays(today, 60)),
      admin.from("recurring_rules").select("id, name, remind_days_before").eq("user_id", row.user_id),
    ]);
    const ruleById = new Map((rules ?? []).map((r) => [r.id, r]));
    const billRows = (
      (planned ?? []) as unknown as {
        id: string;
        kind: string;
        amount: string;
        due_on: string | null;
        occurred_on: string;
        recurring_rule_id: string;
      }[]
    )
      .filter((tx) => tx.kind !== "income")
      .map((tx) => {
        const rule = ruleById.get(tx.recurring_rule_id);
        return {
          id: tx.id,
          name: rule?.name ?? t("Bill"),
          amount: BigInt(tx.amount),
          dueOn: tx.due_on ?? tx.occurred_on,
          remindDaysBefore: rule?.remind_days_before ?? 3,
        };
      });

    // Claim keys first; only what this run claimed gets sent.
    const claim = async (kind: "bill_due" | "weekly_summary", keys: string[]) => {
      if (keys.length === 0) return [];
      const { data } = await admin
        .from("notification_log")
        .upsert(
          keys.map((ref_key) => ({ user_id: row.user_id, kind, ref_key, channel: "email" })),
          { onConflict: "user_id,kind,ref_key,channel", ignoreDuplicates: true },
        )
        .select("ref_key");
      return (data ?? []).map((d) => d.ref_key);
    };
    const release = async (kind: string, keys: string[]) => {
      if (keys.length)
        await admin.from("notification_log").delete().eq("user_id", row.user_id).eq("kind", kind).in("ref_key", keys);
    };

    if (bills) {
      const due = remindersDue(billRows, today);
      const claimed = await claim(
        "bill_due",
        due.map((d) => d.refKey),
      );
      const toSend = due.filter((d) => claimed.includes(d.refKey));
      if (toSend.length > 0) {
        const lines = toSend.map((b) =>
          t("{name}: {amount}, due {when}", {
            name: b.name,
            amount: formatIdr(b.amount),
            when: b.dueOn === today ? t("today") : b.dueOn,
          }),
        );
        const result = await sendEmail({
          to,
          subject:
            toSend.length === 1
              ? t("Due soon: {name}", { name: toSend[0].name })
              : t("{n} bills due soon", { n: toSend.length }),
          text: `${lines.join("\n")}\n\n${t("Mark them paid in Folium → Money → Recurring.")}`,
          html: `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul><p>${escapeHtml(t("Mark them paid in Folium → Money → Recurring."))}</p>`,
        });
        if (result.ok) sent++;
        else {
          failed++;
          await release("bill_due", claimed);
        }
      }
    }

    // Weekly summary on the user's Monday.
    if (weekly && new Date(`${today}T00:00:00Z`).getUTCDay() === 1) {
      const key = weekKey(today);
      const claimed = await claim("weekly_summary", [key]);
      if (claimed.length === 1) {
        const { data: spentRows } = await admin
          .from("transactions")
          .select("amount::text")
          .eq("user_id", row.user_id)
          .eq("status", "posted")
          .eq("kind", "expense")
          .gte("occurred_on", addDays(today, -7))
          .lt("occurred_on", today);
        const spent = ((spentRows ?? []) as unknown as { amount: string }[]).reduce((s, r) => s + BigInt(r.amount), 0n);
        const week = billRows.filter((b) => b.dueOn >= today && b.dueOn <= addDays(today, 7));
        const dueTotal = week.reduce((s, b) => s + b.amount, 0n);
        const lines = [
          t("Spent last week: {amount}", { amount: formatIdr(spent) }),
          t(plural(week.length, "Due this week: 1 bill, {amount}", "Due this week: {n} bills, {amount}"), {
            n: week.length,
            amount: formatIdr(dueTotal),
          }),
          ...week.map(
            (b) =>
              `  · ${t("{name}: {amount} on {date}", { name: b.name, amount: formatIdr(b.amount), date: b.dueOn })}`,
          ),
        ];
        const result = await sendEmail({
          to,
          subject: t("Your week in money"),
          text: lines.join("\n"),
          html: `<p>${lines.map(escapeHtml).join("<br>")}</p>`,
        });
        if (result.ok) sent++;
        else {
          failed++;
          await release("weekly_summary", claimed);
        }
      }
    }
  }
  return { sent, failed };
}
