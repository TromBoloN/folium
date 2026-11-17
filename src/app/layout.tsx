import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Inter } from "next/font/google";
import { getSettings } from "@/features/settings/queries";
import { chromeColors, themeAttributes } from "@/features/settings/theme";
import { THEME_FONT_VARIABLES } from "@/features/themes/fonts";
import { I18nProvider } from "@/lib/i18n/client";
import "./globals.css";
// Theme packs after the base tokens, so their [data-theme] rules win (docs/themes.md).
import "@/features/themes/packs/index.css";

const defaultUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: { default: "Folium", template: "%s · Folium" },
  description: "Your classes, deadlines and tasks in one place.",
  appleWebApp: { capable: true, title: "Folium", statusBarStyle: "default" },
};

// The browser chrome colour (theme-color) depends on the user's theme pack and mode,
// so it's rendered as <meta> tags in the layout below, not here.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// The saved theme goes on <html> in the server render so the first paint is
// already right (no flash). That means the root layout reads the session and
// blocks; see docs/decisions/frontend.md.
export const instant = false;

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
// Only some users pick Inter, so don't preload it for everyone.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap", preload: false });
// Display serif for page titles, the greeting and big numerals. Variable, with the optical-size axis.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap", axes: ["opsz"] });

/**
 * Marks <html data-booted> when the app has already started once this session (MotionRuntime
 * records that), which hides the boot screen.
 */
const BOOT_ONCE = `try{if(sessionStorage.getItem("folium-booted"))document.documentElement.setAttribute("data-booted","")}catch(e){}`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { theme, preferences } = await getSettings();

  return (
    <html
      // The inline script below adds data-booted before hydration.
      suppressHydrationWarning
      lang={preferences.language}
      className={[geist.variable, inter.variable, fraunces.variable, ...THEME_FONT_VARIABLES].join(" ")}
      {...themeAttributes(theme)}
    >
      <head>
        {/* The first-load screen shows once per browser session; this runs before first paint. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, no user input */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_ONCE }} />
        {chromeColors(theme).map(({ media, color }) => (
          <meta key={media ?? "all"} name="theme-color" media={media} content={color} />
        ))}
      </head>
      <body>
        <I18nProvider locale={preferences.language}>{children}</I18nProvider>
      </body>
    </html>
  );
}
