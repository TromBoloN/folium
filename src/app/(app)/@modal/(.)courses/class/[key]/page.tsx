import { Suspense } from "react";
import { Sheet } from "@/components/sheet";
import { FormSkeleton } from "@/components/skeletons";
import { ClassScreen } from "@/features/schedule/components/class-screen";

export default function ClassSheet({ params }: PageProps<"/courses/class/[key]">) {
  return (
    <Sheet title="Class">
      <Suspense fallback={<FormSkeleton label="Loading class" />}>
        <Class params={params} />
      </Suspense>
    </Sheet>
  );
}

async function Class({ params }: Pick<PageProps<"/courses/class/[key]">, "params">) {
  const { key } = await params;
  return <ClassScreen occurrenceKey={decodeURIComponent(key)} variant="sheet" />;
}
