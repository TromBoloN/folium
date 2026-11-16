"use client";

import { useActionState, useEffect, useRef } from "react";
import { useToast } from "@/components/toast/toaster";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateProfile } from "../actions";

/** The name Folium shows in the sidebar and the greeting. A plain form: works without JavaScript. */
export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  const toast = useToast();
  const handled = useRef(state);
  useEffect(() => {
    if (!state?.ok || handled.current === state) return;
    handled.current = state;
    toast({ message: state.result?.message ?? "Saved" });
  }, [state, toast]);
  const error = state && !state.ok ? (state.fieldErrors?.displayName ?? state.error) : undefined;
  const value = state && !state.ok ? (state.values?.displayName ?? displayName) : displayName;

  return (
    <form key={JSON.stringify(state)} action={action} className="flex max-w-md flex-col gap-3" noValidate>
      <div>
        <Field
          id="displayName"
          label="Your name"
          error={error}
          hint="Shown in the sidebar and the greeting. Leave blank to show your email."
        >
          <Input
            id="displayName"
            name="displayName"
            defaultValue={value}
            maxLength={80}
            autoComplete="name"
            placeholder="e.g. Dewi"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy("displayName", error, "hint")}
          />
        </Field>
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}
