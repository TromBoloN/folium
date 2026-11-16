// Demo money for the demo account (demo@folium.test). DEV ONLY.
//
//   bun run db:seed && bun run db:seed:finance
//
// Loads supabase/seed-finance.sql into the LOCAL Supabase container. Refuses
// to run in CI, under tests, in production, or when the app points at a
// Supabase that isn't on this machine.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function refuse(reason) {
  console.error(`seed-finance: refusing to run (${reason}). This is for local development only.`);
  process.exit(1);
}

if (process.env.CI) refuse("CI is set");
if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test")
  refuse(`NODE_ENV=${process.env.NODE_ENV}`);
if (process.env.VITEST || process.env.PLAYWRIGHT_TEST_BASE_URL) refuse("running under tests");

let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) {
  try {
    const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    url = /^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m.exec(env)?.[1]?.trim();
  } catch {
    // No .env.local: fall through to the check below.
  }
}
let host = "";
try {
  host = new URL(url ?? "").hostname;
} catch {
  refuse("NEXT_PUBLIC_SUPABASE_URL is missing or invalid");
}
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) refuse(`Supabase host is ${host}, not local`);

const sql = readFileSync(new URL("../supabase/seed-finance.sql", import.meta.url), "utf8");
execFileSync(
  "docker",
  ["exec", "-i", "supabase_db_folium-web", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
  {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
  },
);
console.log("seed-finance: demo money loaded for demo@folium.test.");
