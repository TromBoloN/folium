import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { SyncBalancesScreen } from "@/features/finance/components/sync-balances-screen";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Sync balances") };
}

export default function SyncBalancesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <SyncBalancesScreen variant="page" />
      </Suspense>
    </div>
  );
}
