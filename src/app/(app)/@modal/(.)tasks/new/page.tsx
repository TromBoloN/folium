import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { NewTaskScreen } from "@/features/tasks/components/task-screens";

export default function NewTaskSheet({ searchParams }: PageProps<"/tasks/new">) {
  return (
    <Sheet title="New task">
      <Suspense fallback={<FormSkeleton />}>
        <New searchParams={searchParams} />
      </Suspense>
    </Sheet>
  );
}

async function New({ searchParams }: Pick<PageProps<"/tasks/new">, "searchParams">) {
  const { course } = await searchParams;
  return <NewTaskScreen courseId={typeof course === "string" ? course : undefined} />;
}
