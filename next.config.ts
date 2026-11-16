import type { NextConfig } from "next";

/** Sent with every response. See docs/security-review.md. */
const securityHeaders = [
  // Nobody may frame the app (clickjacking). frame-ancestors is the modern form; X-Frame-Options covers old browsers.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Dev only. Supabase's local site_url is http://127.0.0.1:3000, so auth links land on
  // 127.0.0.1, which `next dev` treats as cross-origin and blocks from HMR. Without HMR,
  // Turbopack can't load client chunks and no client component hydrates.
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    // The timetable became a view of /courses. The query (?week=) is passed through.
    return [
      { source: "/courses/timetable", destination: "/courses?view=week", permanent: false },
      // Categories moved under Money (finance-specific; keeps the Money tabs visible).
      { source: "/settings/categories", destination: "/money/categories", permanent: false },
      { source: "/settings/categories/:id", destination: "/money/categories/:id", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
