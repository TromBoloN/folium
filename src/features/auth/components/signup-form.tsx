"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/client";
import { rich } from "@/lib/i18n/rich";
import { signUp } from "../actions";
import { MIN_PASSWORD_LENGTH } from "../schemas";
import { FormError } from "./form-error";

export function SignupForm() {
  const t = useT();
  const [state, action, pending] = useActionState(signUp, null);

  if (state?.ok && state.data.needsConfirmation) {
    return (
      <div className="flex flex-col gap-3 text-sm" role="status">
        <p className="font-medium">{t("Check your email")}</p>
        <p className="text-muted-foreground">
          {rich(t("We sent a confirmation link to {email}. Open it on this device to finish signing up."), {
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
      <div className="grid gap-2">
        <Label htmlFor="password">{t("Password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          {t("At least {n} characters.", { n: MIN_PASSWORD_LENGTH })}
        </p>
      </div>
      <FormError message={state && !state.ok ? state.error : undefined} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("Creating account…") : t("Create account")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t("Already have an account?")}{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          {t("Sign in")}
        </Link>
      </p>
    </form>
  );
}
