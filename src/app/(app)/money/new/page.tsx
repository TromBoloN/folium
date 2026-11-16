import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { NewTransactionScreen } from "@/features/finance/components/transaction-screens";

export const metadata: Metadata = { title: "Add transaction" };

/** ?kind=expense|income|transfer|adjustment preselects the kind. */
export default function NewTransactionPage({ searchParams }: PageProps<"/money/new">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <New searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function New({ searchParams }: Pick<PageProps<"/money/new">, "searchParams">) {
  const { kind, account, to } = await searchParams;
  return (
    <NewTransactionScreen
      variant="page"
      kind={typeof kind === "string" ? kind : undefined}
      account={typeof account === "string" ? account : undefined}
      to={typeof to === "string" ? to : undefined}
    />
  );
}
