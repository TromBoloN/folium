import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { EditTaskScreen } from "@/features/tasks/components/task-screens";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Edit task") };
}

export default function EditTaskPage({ params }: PageProps<"/tasks/[id]/edit">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton />}>
        <Edit params={params} />
      </Suspense>
    </div>
  );
}

async function Edit({ params }: Pick<PageProps<"/tasks/[id]/edit">, "params">) {
  const { id } = await params;
  return <EditTaskScreen id={id} variant="page" />;
}
