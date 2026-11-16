import { requireUser } from "@/features/auth/queries";
import { financeBackup } from "@/features/finance/queries/imports";

/**
 * A full JSON backup of the user's finance data (every table, amounts as exact
 * strings). Authenticated: RLS limits every row to the signed-in user.
 */
export async function GET() {
  await requireUser();
  const backup = await financeBackup();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify({ ...backup, exportedAt: new Date().toISOString() }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="folium-money-${date}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
