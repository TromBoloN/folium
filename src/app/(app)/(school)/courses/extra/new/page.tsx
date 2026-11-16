import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { NewExtraSessionScreen } from "@/features/schedule/components/schedule-screens";

export const metadata: Metadata = { title: "Extra session" };

/** ?date=YYYY-MM-DD&course=<id> prefill it. */
export default function NewExtraSessionPage({ searchParams }: PageProps<"/courses/extra/new">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <New searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function New({ searchParams }: Pick<PageProps<"/courses/extra/new">, "searchParams">) {
  const { date, course } = await searchParams;
  return (
    <NewExtraSessionScreen
      variant="page"
      date={typeof date === "string" ? date : undefined}
      courseId={typeof course === "string" ? course : undefined}
    />
  );
}
