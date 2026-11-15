import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Dev only. Supabase's local site_url is http://127.0.0.1:3000, so auth links land on
  // 127.0.0.1, which `next dev` treats as cross-origin and blocks from HMR. Without HMR,
  // Turbopack can't load client chunks and no client component hydrates.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
