"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";
import { rich } from "@/lib/i18n/rich";
import { requestPasswordReset } from "../actions";
import { FormError } from "./form-error";

export function ForgotPasswordForm() {
  const t = useT();
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-3 text-sm" role="status">
        <p className="font-medium">{t("Check your email")}</p>
        <p className="text-muted-foreground">
          {rich(t("If an account exists for {email}, we sent a link to reset its password. The link works once."), {
            email: <span className="text-foreground">{state.email}</span>,
          })}
        </p>
        <Link href="/login" className="underline underline-offset-4">
          {t("Back to sign in")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p className="text-muted-foreground text-sm">
        {t("Enter your email and we'll send you a link to set a new password.")}
      </p>
      <div className="grid gap-2">
        <Label htmlFor="email">{t("Email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state?.email}
        />
      </div>
      <FormError message={state && !state.ok ? state.error : undefined} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("Sending…") : t("Send reset link")}
      </Button>
      <p className="text-center text-muted-foreground text-sm">
        {t("Remembered it?")}{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          {t("Sign in")}
        </Link>
      </p>
    </form>
  );
}
