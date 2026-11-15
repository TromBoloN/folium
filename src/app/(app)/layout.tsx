import { AppShell } from "@/components/app-shell/app-shell";

// Signed-in area. The proxy already redirects logged-out visitors; pages that
// load user data still call requireUser() themselves. `modal` is the @modal
// slot: add/edit/detail routes opened from inside the app show there as sheets.
export default function AppLayout({ children, modal }: LayoutProps<"/">) {
  return <AppShell modal={modal}>{children}</AppShell>;
}
