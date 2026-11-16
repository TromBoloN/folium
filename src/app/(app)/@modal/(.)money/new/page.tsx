import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { NewTransactionScreen } from "@/features/finance/components/transaction-screens";

export default function NewTransactionSheet({ searchParams }: PageProps<"/money/new">) {
  return (
    <Sheet title="Add transaction">
      <Suspense fallback={<FormSkeleton />}>
        <New searchParams={searchParams} />
      </Suspense>
    </Sheet>
  );
}

async function New({ searchParams }: Pick<PageProps<"/money/new">, "searchParams">) {
  const { kind, account, to } = await searchParams;
  return (
    <NewTransactionScreen
      variant="sheet"
      kind={typeof kind === "string" ? kind : undefined}
      account={typeof account === "string" ? account : undefined}
      to={typeof to === "string" ? to : undefined}
    />
  );
}
