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
    <div className="reveal flex flex-col gap-1.5">
      <p className="font-medium text-muted-foreground text-sm">{date}</p>
      <h1 className="font-display font-medium text-4xl leading-[1.05] tracking-tight md:text-[2.5rem]">
        {hello}
        {name ? (
          <>
            , <span className="text-[color-mix(in_oklab,var(--primary)_50%,var(--foreground))] italic">{name}</span>
          </>
        ) : null}
      </h1>
    </div>
  );
}

export function GreetingSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-2">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="h-10 w-72 max-w-full animate-pulse rounded bg-muted" />
    </div>
  );
}
