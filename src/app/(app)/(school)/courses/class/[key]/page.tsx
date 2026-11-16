import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { ClassScreen } from "@/features/schedule/components/class-screen";

export const metadata: Metadata = { title: "Class" };

export default function ClassPage({ params }: PageProps<"/courses/class/[key]">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton label="Loading class" />}>
        <Class params={params} />
      </Suspense>
    </div>
  );
}

async function Class({ params }: Pick<PageProps<"/courses/class/[key]">, "params">) {
  const { key } = await params;
  return <ClassScreen occurrenceKey={decodeURIComponent(key)} variant="page" />;
}
