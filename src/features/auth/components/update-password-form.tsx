"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updatePassword } from "../actions";
import { MIN_PASSWORD_LENGTH } from "../schemas";
import { FormError } from "./form-error";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-3 text-sm" role="status">
        <p className="font-medium">Password updated</p>
        <p className="text-muted-foreground">Use your new password next time you sign in.</p>
        <Link href="/" className="underline underline-offset-4">
          Go to Today
        </Link>
      </div>
    );
  }

  const hint = `At least ${MIN_PASSWORD_LENGTH} characters.`;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field id="password" label="New password" error={errors.password} hint={hint}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={describedBy("password", errors.password, hint)}
        />
      </Field>
      <Field id="confirm" label="Repeat new password" error={errors.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={describedBy("confirm", errors.confirm)}
        />
      </Field>
      <FormError message={state && !state.ok && !state.fieldErrors ? state.error : undefined} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
