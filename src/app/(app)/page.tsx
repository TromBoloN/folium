import { LayoutGrid, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { DashboardEditor } from "@/features/dashboard/components/dashboard-editor";
import { Greeting, GreetingSkeleton } from "@/features/dashboard/components/greeting";
import { WidgetFrame, WidgetSkeleton } from "@/features/dashboard/components/widget-frame";
import { visibleWidgets } from "@/features/dashboard/layout";
import { getDashboardLayout } from "@/features/dashboard/queries";
import { WIDGETS } from "@/features/dashboard/registry";
import { WIDGET_IDS, type WidgetId } from "@/features/dashboard/widget-ids";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Suspense fallback={<GreetingSkeleton />}>
          <Greeting />
        </Suspense>
        <Suspense>
          <EditToggle searchParams={searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={<WidgetSkeleton rows={4} label="Loading your dashboard" />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EditToggle({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const { edit } = await searchParams;
  if (edit === "1") return null;
  return (
    <Button asChild variant="outline" size="sm">
      <Link href="/?edit=1">
        <SlidersHorizontal aria-hidden />
        Customize
      </Link>
    </Button>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await requireUser();
  const [{ edit }, layout] = await Promise.all([searchParams, getDashboardLayout()]);

  if (edit === "1") {
    return (
      <section aria-labelledby="customize" className="flex flex-col gap-3">
        <div>
          <h2 id="customize" className="font-medium">
            Customize your dashboard
          </h2>
          <p className="text-muted-foreground text-sm">Choose which widgets to show and drag them into order.</p>
        </div>
        <DashboardEditor
          widgets={WIDGET_IDS.map((id) => ({ id, title: WIDGETS[id].title, description: WIDGETS[id].description }))}
          layout={layout}
          defaultOrder={[...WIDGET_IDS]}
        />
      </section>
    );
  }

  const ids = visibleWidgets(layout) as WidgetId[];
  if (ids.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="All widgets are hidden"
        description="Turn some back on to fill your dashboard."
      >
        <Button asChild size="sm">
          <Link href="/?edit=1">Customize</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {ids.map((id) => {
        const widget = WIDGETS[id];
        return (
          <WidgetFrame
            key={id}
            id={id}
            title={widget.title}
            icon={widget.icon}
            href={widget.href}
            hrefLabel={widget.hrefLabel}
          >
            <Suspense fallback={<WidgetSkeleton rows={widget.skeletonRows} label={`Loading ${widget.title}`} />}>
              <widget.Component />
            </Suspense>
          </WidgetFrame>
        );
      })}
    </div>
  );
}
