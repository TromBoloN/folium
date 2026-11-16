import { requireUser } from "@/features/auth/queries";
import { buildIcs } from "@/features/schedule/ics";
import { getSchedule } from "@/features/schedule/queries";
import { getSettings } from "@/features/settings/queries";
import { addDays, todayIn } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";

/**
 * Download the timetable as an .ics file: four weeks back to six months ahead,
 * with changes applied. A one-off import (calendar apps don't re-fetch it);
 * importing a newer file updates the same events, since UIDs are stable.
 */
export async function GET(request: Request) {
  await requireUser();
  const [{ preferences }, t] = await Promise.all([getSettings(), getT()]);
  const today = todayIn(preferences.timeZone);
  const occurrences = await getSchedule({ from: addDays(today, -28), to: addDays(today, 183) });
  const body = buildIcs(occurrences, {
    timeZone: preferences.timeZone,
    stamp: new Date(),
    host: new URL(request.url).hostname,
    t,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="folium-classes-${today}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
