import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ListSkeleton } from "@/components/skeletons";
import { TaskDetailScreen } from "@/features/tasks/components/task-screens";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Task") };
}

export default function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4">
        <BackLink href="/tasks">Tasks</BackLink>
      </div>
      <Suspense fallback={<ListSkeleton label="Loading task" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({ params }: Pick<PageProps<"/tasks/[id]">, "params">) {
  const { id } = await params;
  return <TaskDetailScreen id={id} />;
}
