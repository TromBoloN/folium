import { AlarmClock, CalendarClock, type LucideIcon, Plus, Sun } from "lucide-react";
import type { WidgetId } from "./widget-ids";
import { ClassesWidget } from "./widgets/classes-widget";
import { QuickAddWidget } from "./widgets/quick-add-widget";
import { DueSoonWidget, OverdueWidget } from "./widgets/task-widgets";

export type WidgetDefinition = {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Rendered inside its own <Suspense>, so it may read data and the clock. */
  Component: () => React.ReactNode | Promise<React.ReactNode>;
  href?: string;
  hrefLabel?: string;
  /** Skeleton rows while it loads. */
  skeletonRows: number;
};

/**
 * Every dashboard widget. The dashboard renders whatever the user's layout
 * lists, using this map, so adding a widget means: one id in widget-ids.ts,
 * one entry here. Default order comes from WIDGET_IDS.
 */
export const WIDGETS: Record<WidgetId, WidgetDefinition> = {
  classes: {
    title: "Today's classes",
    description: "Your classes today, with what's on now and next.",
    icon: Sun,
    Component: ClassesWidget,
    href: "/courses/timetable",
    hrefLabel: "Week",
    skeletonRows: 3,
  },
  "due-soon": {
    title: "Due soon",
    description: "Tasks due today and over the next two days.",
    icon: CalendarClock,
    Component: DueSoonWidget,
    href: "/tasks?due=week",
    skeletonRows: 2,
  },
  overdue: {
    title: "Overdue",
    description: "Open tasks whose deadline has passed.",
    icon: AlarmClock,
    Component: OverdueWidget,
    href: "/tasks?due=overdue",
    skeletonRows: 2,
  },
  "quick-add": {
    title: "Quick add",
    description: "Add a task with just a title.",
    icon: Plus,
    Component: QuickAddWidget,
    skeletonRows: 1,
  },
};
