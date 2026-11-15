import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { ListSkeleton } from "@/components/skeletons";
import { TaskDetailScreen } from "@/features/tasks/components/task-screens";

export default function TaskSheet({ params }: PageProps<"/tasks/[id]">) {
  return (
    <Sheet title="Task">
      <Suspense fallback={<ListSkeleton label="Loading task" />}>
        <Detail params={params} />
      </Suspense>
    </Sheet>
  );
}

async function Detail({ params }: Pick<PageProps<"/tasks/[id]">, "params">) {
  const { id } = await params;
  return <TaskDetailScreen id={id} />;
}
