/**
 * Motion level for client code (count-ups, ticking timers). CSS handles the rest
 * through data-motion on <html> and the prefers-reduced-motion media query.
 * The OS reduced-motion setting always wins over the user's choice.
 */
export type MotionLevel = "full" | "subtle" | "off";

export function motionLevel(): MotionLevel {
  if (typeof window === "undefined") return "off";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "off";
  const value = document.documentElement.dataset.motion;
  return value === "subtle" || value === "off" ? value : "full";
}
