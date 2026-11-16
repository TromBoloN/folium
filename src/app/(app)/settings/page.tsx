import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { InstallCard } from "@/components/pwa/install-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { requireUser } from "@/features/auth/queries";
import { getDisplayName } from "@/features/dashboard/queries";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { getSettings } from "@/features/settings/queries";
import { listTimeZones } from "@/lib/dates";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Make Folium look and work the way you like." />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const [user, settings, displayName] = await Promise.all([requireUser(), getSettings(), getDisplayName()]);
  return (
    <div className="flex flex-col gap-6">
      <SettingsForm settings={settings} timeZones={listTimeZones(settings.preferences.timeZone)} />
      <InstallCard />
      <Card>
        <CardHeader>
          <CardTitle>Money</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Categories for spending and income, your accounts, and a CSV of everything.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/money/categories">Categories</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/money/accounts">Accounts</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href="/money/export.csv" download>
                Export CSV
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ProfileForm displayName={displayName ?? ""} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-border-soft border-t pt-4">
            <p className="text-muted-foreground text-sm">
              Signed in as <span className="text-foreground">{user.email}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/update-password">Change password</Link>
              </Button>
              <SignOutButton />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading settings" className="flex flex-col gap-6">
      <div className="h-96 animate-pulse rounded-xl bg-muted" />
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
