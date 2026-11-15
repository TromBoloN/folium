import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { NewBreakScreen } from "@/features/schedule/components/schedule-screens";

export default function NewBreakSheet({ searchParams }: PageProps<"/courses/breaks/new">) {
  return (
    <Sheet title="Add a break">
      <Suspense fallback={<FormSkeleton />}>
        <New searchParams={searchParams} />
      </Suspense>
    </Sheet>
  );
}

async function New({ searchParams }: Pick<PageProps<"/courses/breaks/new">, "searchParams">) {
  const { from } = await searchParams;
  return <NewBreakScreen variant="sheet" from={typeof from === "string" ? from : undefined} />;
}
