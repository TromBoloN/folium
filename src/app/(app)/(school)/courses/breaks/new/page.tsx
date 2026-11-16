import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { NewBreakScreen } from "@/features/schedule/components/schedule-screens";

export const metadata: Metadata = { title: "Add a break" };

export default function NewBreakPage({ searchParams }: PageProps<"/courses/breaks/new">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <New searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function New({ searchParams }: Pick<PageProps<"/courses/breaks/new">, "searchParams">) {
  const { from } = await searchParams;
  return <NewBreakScreen variant="page" from={typeof from === "string" ? from : undefined} />;
}
