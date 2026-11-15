"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "../actions";
import { FormError } from "./form-error";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-3 text-sm" role="status">
        <p className="font-medium">Check your email</p>
        <p className="text-muted-foreground">
          If an account exists for <span className="text-foreground">{state.email}</span>, we sent a link to reset its
          password. The link works once.
        </p>
        <Link href="/login" className="underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p className="text-muted-foreground text-sm">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
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
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-muted-foreground text-sm">
        Remembered it?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
