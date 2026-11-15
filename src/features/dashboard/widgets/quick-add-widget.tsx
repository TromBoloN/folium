import { QuickAdd } from "@/features/tasks/components/quick-add";

export function QuickAddWidget() {
  return (
    <div className="flex flex-col gap-2">
      <QuickAdd />
      <p className="text-muted-foreground text-xs">Just a title for now; add a deadline or course later.</p>
    </div>
  );
}
