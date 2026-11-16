import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { EditTransactionScreen } from "@/features/finance/components/transaction-screens";

export default function EditTransactionSheet({ params }: PageProps<"/money/[id]/edit">) {
  return (
    <Sheet title="Edit transaction">
      <Suspense fallback={<FormSkeleton />}>
        <Edit params={params} />
      </Suspense>
    </Sheet>
  );
}

async function Edit({ params }: Pick<PageProps<"/money/[id]/edit">, "params">) {
  const { id } = await params;
  return <EditTransactionScreen variant="sheet" id={id} />;
}
