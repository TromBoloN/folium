import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { NewTaskScreen } from "@/features/tasks/components/task-screens";

export const metadata: Metadata = { title: "New task" };

export default function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="New task" back={<BackLink href="/tasks">Tasks</BackLink>} />
      <Suspense fallback={<FormSkeleton />}>
        <New searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function New({ searchParams }: Pick<PageProps<"/tasks/new">, "searchParams">) {
  const { course } = await searchParams;
  return <NewTaskScreen courseId={typeof course === "string" ? course : undefined} />;
}
