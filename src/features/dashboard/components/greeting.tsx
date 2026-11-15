import { io } from "next/cache";
import { getSettings } from "@/features/settings/queries";
import { formatDate, minutesNowIn, todayIn } from "@/lib/dates";
import { getDisplayName } from "../queries";
import { greeting } from "../today";

export async function Greeting() {
  const [{ preferences }, name] = await Promise.all([getSettings(), getDisplayName()]);
  await io();
  const now = new Date();
  const hello = greeting(minutesNowIn(preferences.timeZone, now));
  const date = formatDate(todayIn(preferences.timeZone, now), { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-semibold text-2xl tracking-tight">{name ? `${hello}, ${name}` : hello}</h1>
      <p className="text-muted-foreground text-sm">{date}</p>
    </div>
  );
}

export function GreetingSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-2">
      <div className="h-8 w-56 animate-pulse rounded bg-muted" />
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
    </div>
  );
}
