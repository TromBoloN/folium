"use client";

import { useActionState, useState, useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import type { FormState } from "@/lib/action-result";
import { cn } from "@/lib/utils";

/**
 * A small server-action form (mark paid, settle, copy budgets…): hidden fields,
 * any inputs as children, the error inline and a toast on success.
 *
 * Two paths. Without JavaScript the form posts to the server action (the page
 * re-renders with its result). With JavaScript, onSubmit calls the same action
 * directly and toasts from the result. Not from an effect: a successful submit
 * often removes this form's own row (a paid bill, a settled debt), unmounting it
 * before an effect could run, while the toaster above stays.
 */
export function ToastForm({
  action,
  fields = {},
  children,
  className,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields?: Record<string, string>;
  children: React.ReactNode;
  className?: string;
}) {
  const [serverState, formAction] = useActionState(action, null);
  const [clientState, setClientState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const state = clientState ?? serverState;
  return (
    <form
      key={JSON.stringify(state)}
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        start(async () => {
          const result = await action(state, formData);
          if (result?.ok && result.result?.message) toast({ message: result.result.message });
          setClientState(result);
        });
      }}
      className={cn("flex flex-col gap-1", className)}
      noValidate
      aria-busy={pending || undefined}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
