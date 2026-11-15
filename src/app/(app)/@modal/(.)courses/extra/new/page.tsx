import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { NewExtraSessionScreen } from "@/features/schedule/components/schedule-screens";

export default function NewExtraSessionSheet({ searchParams }: PageProps<"/courses/extra/new">) {
  return (
    <Sheet title="Extra session">
      <Suspense fallback={<FormSkeleton />}>
        <New searchParams={searchParams} />
      </Suspense>
    </Sheet>
  );
}

async function New({ searchParams }: Pick<PageProps<"/courses/extra/new">, "searchParams">) {
  const { date, course } = await searchParams;
  return (
    <NewExtraSessionScreen
      variant="sheet"
      date={typeof date === "string" ? date : undefined}
      courseId={typeof course === "string" ? course : undefined}
    />
  );
}
