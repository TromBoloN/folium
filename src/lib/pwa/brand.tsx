/**
 * Brand colours for things the OS draws outside the page (home-screen icon,
 * splash screen, browser chrome). CSS tokens can't reach those, so these are
 * fixed values matching the default green preset: the paper and leaf colours.
 */
export const BRAND = {
  paper: "#f4f1e6",
  ink: "#16251c",
  leaf: "#1f7a4a",
  night: "#0f1a14",
} as const;

/** The leaf mark as a full-bleed app icon, drawn by next/og (ImageResponse). */
export function IconArt({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND.paper,
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" fill="none" role="img" aria-label="Folium">
        <path
          d="M27 4C14 4 5 11 5 21c0 2.3.6 4.4 1.6 6.1C8.3 27.7 10.2 28 12 28c9.4 0 15-8.6 15-24Z"
          fill={BRAND.leaf}
        />
        <path
          d="M4 29C9 22 15 15 22 10M11.5 21.5l-.5-5.5M15.5 17.2l-.3-4.7M11.5 21.5l5.6.2M15.5 17.2l5 .1"
          stroke={BRAND.paper}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
