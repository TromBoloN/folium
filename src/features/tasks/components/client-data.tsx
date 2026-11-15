import { listCourseOptions } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { ClientDataBridge } from "./client-data-bridge";

/** Server half of the bridge: loads courses and preferences once per page, in its own Suspense. */
export async function ClientData() {
  const [courses, { preferences }] = await Promise.all([listCourseOptions(), getSettings()]);
  return (
    <ClientDataBridge
      data={{
        courses,
        timeZone: preferences.timeZone,
        weekStart: preferences.weekStart,
        timeFormat: preferences.timeFormat,
      }}
    />
  );
}
