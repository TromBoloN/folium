import { AppShell } from "@/components/app-shell/app-shell";

// Signed-in area. The proxy already redirects logged-out visitors; pages that
// load user data still call requireUser() themselves.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
