import { QuickAdd } from "@/features/tasks/components/quick-add";
import { QUICK_ADD_HINT } from "@/features/tasks/parse";

export function QuickAddWidget() {
  return (
    <div className="flex flex-col gap-2">
      <QuickAdd />
      <p className="text-muted-foreground text-xs">
        {QUICK_ADD_HINT}. Press <kbd className="rounded border border-border-soft px-1 font-sans">N</kbd> anywhere to
        add.
      </p>
    </div>
  );
}
