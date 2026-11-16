"use client";

import { Tags } from "lucide-react";
import { useActionState, useState } from "react";
import { ChipGroup } from "@/components/form/chip-group";
import { FormSection } from "@/components/form/form-section";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { saveCategory } from "../actions/categories";
import { AppearanceFields } from "./appearance-fields";

export type CategoryDefaults = {
  id?: string;
  name: string;
  kind: string;
  parentId: string;
  color: string;
  icon: string;
};
type Parent = { id: string; name: string; kind: "expense" | "income" };

/** Add or edit a category. Parents are top-level categories of the same kind (one level of nesting). */
export function CategoryForm({ defaults, parents }: { defaults: CategoryDefaults; parents: Parent[] }) {
  const [state, action, pending] = useActionState(saveCategory, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const value = (name: keyof CategoryDefaults) => state?.values?.[name] ?? defaults[name] ?? "";
  const [kind, setKind] = useState(value("kind"));
  const options = parents.filter((p) => p.kind === kind && p.id !== defaults.id);
  return (
    <form
      key={JSON.stringify(state)}
      action={action}
      className="flex flex-col gap-5"
      noValidate
      onChange={(e) => {
        const el = e.target as unknown as HTMLInputElement;
        if (el.name === "kind") setKind(el.value);
      }}
    >
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <FormSection title={defaults.id ? "Edit category" : "New category"} icon={Tags}>
        <Field id="name" label="Name" error={errors.name}>
          <Input
            id="name"
            name="name"
            required
            maxLength={60}
            defaultValue={value("name")}
            placeholder="e.g. Coffee"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("name", errors.name)}
          />
        </Field>
        <ChipGroup
          name="kind"
          legend="Kind"
          defaultValue={value("kind")}
          options={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
          ]}
          error={errors.kind}
        />
        <Field
          id="parentId"
          label="Inside"
          optional
          error={errors.parentId}
          hint="Leave as top level, or put it under another category of the same kind."
        >
          <NativeSelect id="parentId" name="parentId" defaultValue={value("parentId")} aria-describedby="parentId-hint">
            <option value="">Top level</option>
            {(options.length ? options : parents).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <AppearanceFields color={value("color")} icon={value("icon")} errors={errors} />
      </FormSection>
      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : defaults.id ? "Save changes" : "Add category"}
        </Button>
      </div>
    </form>
  );
}
