import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { EditTaskScreen } from "@/features/tasks/components/task-screens";

export default function EditTaskSheet({ params }: PageProps<"/tasks/[id]/edit">) {
  return (
    <Sheet title="Edit task">
      <Suspense fallback={<FormSkeleton />}>
        <Edit params={params} />
      </Suspense>
    </Sheet>
  );
}

async function Edit({ params }: Pick<PageProps<"/tasks/[id]/edit">, "params">) {
  const { id } = await params;
  return <EditTaskScreen id={id} variant="sheet" />;
}
