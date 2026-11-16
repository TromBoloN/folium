import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { EditTransactionScreen } from "@/features/finance/components/transaction-screens";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Edit transaction") };
}

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
