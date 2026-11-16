"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { addSubtask } from "../actions";

export function AddSubtask({ taskId }: { taskId: string }) {
  const { t, tl } = useI18n();
  const [state, action, pending] = useActionState(addSubtask, null);
  const kept = state && !state.ok ? state.values?.title : undefined;
  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-1">
      <input type="hidden" name="taskId" value={taskId} />
      <div className="flex gap-2">
        <Input
          name="title"
          defaultValue={kept}
          placeholder={t("Add a step…")}
          aria-label={t("New step")}
          autoComplete="off"
          aria-invalid={state && !state.ok ? true : undefined}
        />
        <Button type="submit" variant="outline" disabled={pending} aria-label={t("Add step")}>
          <Plus aria-hidden />
        </Button>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-xs">
          {tl(state.error)}
        </p>
      ) : null}
    </form>
  );
}
