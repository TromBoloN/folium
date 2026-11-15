import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Inter } from "next/font/google";
import { getSettings } from "@/features/settings/queries";
import { themeAttributes } from "@/features/settings/theme";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: { default: "Folium", template: "%s · Folium" },
  description: "Your classes, deadlines and tasks in one place.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// The saved theme goes on <html> in the server render so the first paint is
// already right (no flash). That means the root layout reads the session and
// blocks; see docs/documentation/decisions.md.
export const instant = false;

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
// Only some users pick Inter, so don't preload it for everyone.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap", preload: false });
// Display serif for page titles, the greeting and big numerals. Variable, with the optical-size axis.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap", axes: ["opsz"] });

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // preferences.language is saved but not applied yet: lang must match the
  // page text, which is English until translations ship.
  const { theme } = await getSettings();

  return (
    <html lang="en" className={`${geist.variable} ${inter.variable} ${fraunces.variable}`} {...themeAttributes(theme)}>
      <body>{children}</body>
    </html>
  );
}
