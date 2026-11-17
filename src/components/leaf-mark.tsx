import { cn } from "@/lib/utils";

/**
 * Folium's leaf mark. Draws in the current colour. The wrapper is the theme hook
 * `[data-slot="logo"]`: a pack can hide the SVG and draw its own mark on `::before`
 * (docs/themes.md, section 5), so the logo can change per theme without code here.
 */
export function LeafMark({ className }: { className?: string }) {
  return (
    <span aria-hidden data-slot="logo" className={cn("relative inline-block size-6 shrink-0", className)}>
      <svg aria-hidden viewBox="0 0 32 32" className="block size-full" fill="none">
        <path
          d="M27 4C14 4 5 11 5 21c0 2.3.6 4.4 1.6 6.1C8.3 27.7 10.2 28 12 28c9.4 0 15-8.6 15-24Z"
          fill="currentColor"
          opacity="0.18"
        />
        <path
          d="M27 4C14 4 5 11 5 21c0 2.3.6 4.4 1.6 6.1C8.3 27.7 10.2 28 12 28c9.4 0 15-8.6 15-24Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M4 29C9 22 15 15 22 10M11.5 21.5l-.5-5.5M15.5 17.2l-.3-4.7M11.5 21.5l5.6.2M15.5 17.2l5 .1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
