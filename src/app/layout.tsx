import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Inter } from "next/font/google";
import { getSettings } from "@/features/settings/queries";
import { themeAttributes } from "@/features/settings/theme";
import { I18nProvider } from "@/lib/i18n/client";
import { BRAND } from "@/lib/pwa/brand";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: { default: "Folium", template: "%s · Folium" },
  description: "Your classes, deadlines and tasks in one place.",
  appleWebApp: { capable: true, title: "Folium", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Browser chrome colour (outside the page, so not a CSS token): matches the paper and night surfaces.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.paper },
    { media: "(prefers-color-scheme: dark)", color: BRAND.night },
  ],
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { theme, preferences } = await getSettings();

  return (
    <html
      lang={preferences.language}
      className={`${geist.variable} ${inter.variable} ${fraunces.variable}`}
      {...themeAttributes(theme)}
    >
      <body>
        <I18nProvider locale={preferences.language}>{children}</I18nProvider>
      </body>
    </html>
  );
}
