import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { SyncBalancesScreen } from "@/features/finance/components/sync-balances-screen";

export default function SyncBalancesSheet() {
  return (
    <Sheet title="Sync balances">
      <Suspense fallback={<FormSkeleton />}>
        <SyncBalancesScreen variant="sheet" />
      </Suspense>
    </Sheet>
  );
}
