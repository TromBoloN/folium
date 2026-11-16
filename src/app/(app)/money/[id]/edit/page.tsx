import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { EditTransactionScreen } from "@/features/finance/components/transaction-screens";

export const metadata: Metadata = { title: "Edit transaction" };

export default function EditTransactionPage({ params }: PageProps<"/money/[id]/edit">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <Edit params={params} />
      </Suspense>
    </div>
  );
}

async function Edit({ params }: Pick<PageProps<"/money/[id]/edit">, "params">) {
  const { id } = await params;
  return <EditTransactionScreen variant="page" id={id} />;
}
