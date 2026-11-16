import { QuickAdd } from "@/features/tasks/components/quick-add";
import { QUICK_ADD_HINT } from "@/features/tasks/parse";
import { rich } from "@/lib/i18n/rich";
import { getT } from "@/lib/i18n/server";

export async function QuickAddWidget() {
  const t = await getT();
  return (
    <div className="flex flex-col gap-2">
      <QuickAdd />
      <p className="text-muted-foreground text-xs">
        {t(QUICK_ADD_HINT)}.{" "}
        {rich(t("Press {key} anywhere to add."), {
          key: <kbd className="rounded border border-border-soft px-1 font-sans">N</kbd>,
        })}
      </p>
    </div>
  );
}
