import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { UpdatePasswordForm } from "@/features/auth/components/update-password-form";
import { requireUser } from "@/features/auth/queries";
import { rich } from "@/lib/i18n/rich";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Set a new password") };
}

// Reached from the password-reset email (which signs the user in) or from Settings.
export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<FormSkeleton label="Loading" />}>
      <SignedIn />
    </Suspense>
  );
}

async function SignedIn() {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {rich(t("Set a new password for {email}."), { email: <span className="text-foreground">{user.email}</span> })}
      </p>
      <UpdatePasswordForm />
    </div>
  );
}
