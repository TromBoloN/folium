import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { UpdatePasswordForm } from "@/features/auth/components/update-password-form";
import { requireUser } from "@/features/auth/queries";

export const metadata: Metadata = { title: "Set a new password" };

// Reached from the password-reset email (which signs the user in) or from Settings.
export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<FormSkeleton label="Loading" />}>
      <SignedIn />
    </Suspense>
  );
}

async function SignedIn() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Set a new password for <span className="text-foreground">{user.email}</span>.
      </p>
      <UpdatePasswordForm />
    </div>
  );
}
