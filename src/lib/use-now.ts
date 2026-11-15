"use client";

import { useEffect, useState } from "react";
import { minutesNowIn, todayIn } from "./dates";

/**
 * The current time, ticking once a minute on the minute, in the user's time zone.
 * Starts from the server's clock (`initialNow`, epoch ms) so the first client
 * render matches the server render, then syncs to the device clock after mount.
 * Pauses while the tab is hidden and catches up the moment it's visible again.
 */
export function useNow(initialNow: number, timeZone: string) {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      // Next tick just after the next minute boundary.
      timer = setTimeout(tick, 60_000 - (t % 60_000) + 50);
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden) tick();
    };
    tick();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const date = new Date(now);
  return { now, minute: minutesNowIn(timeZone, date), today: todayIn(timeZone, date) };
}
