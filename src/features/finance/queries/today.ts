import "server-only";
import { io } from "next/cache";
import { getSettings } from "@/features/settings/queries";
import { localDateFor } from "../lib/local-date";

/** The user's today and zone. Call inside a Suspense'd component (reads the clock). */
export async function moneyToday(): Promise<{ today: string; timeZone: string }> {
  const { preferences } = await getSettings();
  await io();
  return { today: localDateFor(new Date(), preferences.timeZone), timeZone: preferences.timeZone };
}
