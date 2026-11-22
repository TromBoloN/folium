import { LayoutGrid, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Button } from "@/components/ui/button";
import { Tile } from "@/components/ui/tile";
import { requireUser } from "@/features/auth/queries";
import { AttendancePrompt } from "@/features/dashboard/components/attendance-prompt";
import { DashboardEditor } from "@/features/dashboard/components/dashboard-editor";
import { Greeting, GreetingSkeleton } from "@/features/dashboard/components/greeting";
import { Onboarding } from "@/features/dashboard/components/onboarding";
import { Welcome } from "@/features/dashboard/components/welcome";
import { WelcomeBack } from "@/features/dashboard/components/welcome-back";
import { SIZE_CLASSES, WidgetFrame, WidgetSkeleton } from "@/features/dashboard/components/widget-frame";
import { visibleWidgets } from "@/features/dashboard/layout";
import { isBlank, widgetsToShow } from "@/features/dashboard/presence";
import { getDashboardFacts, getDashboardLayout } from "@/features/dashboard/queries";
import { WIDGETS } from "@/features/dashboard/registry";
import { DEFAULT_HIDDEN_WIDGETS, WIDGET_IDS, type WidgetId } from "@/features/dashboard/widget-ids";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Today") };
}

export default function TodayPage({ searchParams }: PageProps<"/">) {
  return (
    <div data-wide className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Suspense fallback={<GreetingSkeleton />}>
          <Greeting />
        </Suspense>
        <Suspense>
          <EditToggle searchParams={searchParams} className="hidden md:inline-flex" />
        </Suspense>
      </div>
      <Suspense
        fallback={
          <div className="@container">
            <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-12">
              <Tile className={`h-56 p-5 ${SIZE_CLASSES.hero}`}>
                <WidgetSkeleton rows={3} label="Loading your dashboard" />
              </Tile>
              <Tile className={`h-56 ${SIZE_CLASSES.small}`} />
            </div>
          </div>
        }
      >
        <Dashboard searchParams={searchParams} />
      </Suspense>
      <div className="flex justify-center md:hidden">
        <Suspense>
          <EditToggle searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function EditToggle({ searchParams, className }: Pick<PageProps<"/">, "searchParams"> & { className?: string }) {
  const [{ edit }, t] = await Promise.all([searchParams, getT()]);
  if (edit === "1") return null;
  return (
    <Button asChild variant="outline" size="sm" className={className}>
      <Link href="/?edit=1">
        <SlidersHorizontal aria-hidden />
        {t("Customize")}
      </Link>
    </Button>
  );
}

/** At most one banner at the top of Today, in strict priority order: Setup → Welcome back → Attendance. */
async function TopBanner() {
  const onboarding = await Onboarding();
  if (onboarding) return <SectionErrorBoundary label="Setup checklist">{onboarding}</SectionErrorBoundary>;
  const welcomeBack = await WelcomeBack();
  if (welcomeBack) return <SectionErrorBoundary label="Welcome back">{welcomeBack}</SectionErrorBoundary>;
  const attendance = await AttendancePrompt();
  if (attendance) return <SectionErrorBoundary label="Attendance">{attendance}</SectionErrorBoundary>;
  return null;
}

async function Dashboard({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await requireUser();
  const [{ edit }, layout, t] = await Promise.all([searchParams, getDashboardLayout(), getT()]);

  if (edit === "1") {
    return (
      <section aria-labelledby="customize" className="flex max-w-2xl flex-col gap-3">
        <div>
          <h2 id="customize" className="font-medium">
            {t("Customize your dashboard")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("Choose which widgets to show and drag them into order.")}</p>
        </div>
        <DashboardEditor
          widgets={WIDGET_IDS.map((id) => ({
            id,
            title: t(WIDGETS[id].title),
            description: t(WIDGETS[id].description),
          }))}
          layout={layout}
          defaultOrder={[...WIDGET_IDS]}
          defaultHidden={[...DEFAULT_HIDDEN_WIDGETS]}
        />
      </section>
    );
  }

  const visible = visibleWidgets(layout) as WidgetId[];
  if (visible.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="All widgets are hidden"
        description="Turn some back on to fill your dashboard."
      >
        <Button asChild size="sm">
          <Link href="/?edit=1">{t("Customize")}</Link>
        </Button>
      </EmptyState>
    );
  }

  const facts = await getDashboardFacts();
  // Nothing at all yet: one prompt, not a grid of empty cards.
  if (isBlank(facts)) return <Welcome />;
  // Only widgets with something to show; decided now, so the grid doesn't jump as data arrives.
  const ids = widgetsToShow(visible, facts);

  return (
    // A container, so the bento adapts to the space beside the sidebar: 1 column, 2 from @xl, 12 from @4xl.
    // Dense flow lets small tiles fill gaps; items-start keeps tiles at their content height.
    <div className="@container flex flex-col gap-4">
      {/* At most one top banner: Setup → Welcome back → Attendance. */}
      <TopBanner />
      <div className="grid grid-flow-row-dense grid-cols-1 items-start gap-4 @xl:grid-cols-2 @4xl:grid-cols-12">
        {ids.map((id, index) => {
          const widget = WIDGETS[id];
          const content = (
            <SectionErrorBoundary label={widget.title}>
              <Suspense
                fallback={
                  widget.frame === "bare" ? (
                    <Tile className="p-5">
                      <WidgetSkeleton
                        rows={widget.skeletonRows}
                        label={t("Loading {name}", { name: t(widget.title) })}
                      />
                    </Tile>
                  ) : (
                    <WidgetSkeleton rows={widget.skeletonRows} label={t("Loading {name}", { name: t(widget.title) })} />
                  )
                }
              >
                <widget.Component />
              </Suspense>
            </SectionErrorBoundary>
          );
          return (
            <WidgetFrame
              key={id}
              id={id}
              title={widget.title}
              icon={widget.icon}
              size={widget.size}
              frame={widget.frame}
              stretch={widget.stretch}
              href={widget.href}
              hrefLabel={widget.hrefLabel}
              index={index}
            >
              {content}
            </WidgetFrame>
          );
        })}
      </div>
    </div>
  );
}
