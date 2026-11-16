import "server-only";

/**
 * Send one email. Production: Resend's HTTP API (RESEND_API_KEY, EMAIL_FROM).
 * Local: Mailpit's send API (MAILPIT_URL, e.g. http://127.0.0.1:54324), so
 * reminders land in the same inbox as auth emails. Neither set: nothing is
 * sent and the caller is told so (reminders stay in-app).
 */
export type Email = { to: string; subject: string; text: string; html: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY || process.env.MAILPIT_URL);
}

export async function sendEmail(email: Email): Promise<{ ok: true } | { ok: false; error: string }> {
  const from = process.env.EMAIL_FROM ?? "Folium <reminders@folium.local>";
  try {
    if (process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text, html: email.html }),
      });
      return res.ok ? { ok: true } : { ok: false, error: `Resend ${res.status}` };
    }
    if (process.env.MAILPIT_URL) {
      const match = /^(.*)<(.+)>$/.exec(from);
      const res = await fetch(`${process.env.MAILPIT_URL.replace(/\/$/, "")}/api/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: match ? match[2].trim() : from, Name: match ? match[1].trim() : "" },
          To: [{ Email: email.to }],
          Subject: email.subject,
          Text: email.text,
          HTML: email.html,
        }),
      });
      return res.ok ? { ok: true } : { ok: false, error: `Mailpit ${res.status}` };
    }
    return { ok: false, error: "No email provider configured" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Send failed" };
  }
}

/** Escape text for the HTML part. */
export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
