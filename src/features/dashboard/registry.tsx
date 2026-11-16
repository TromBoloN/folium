import {
  AlarmClock,
  CalendarClock,
  CalendarRange,
  Gauge,
  GraduationCap,
  type LucideIcon,
  Plus,
  Sparkles,
  Sun,
  Wallet,
} from "lucide-react";
import type { WidgetId, WidgetSize } from "./widget-ids";
import { ClassesWidget } from "./widgets/classes-widget";
import { GradesWidget } from "./widgets/grades-widget";
import { MoneyWidget } from "./widgets/money-widget";
import { NextUpWidget } from "./widgets/next-up-widget";
import { QuickAddWidget } from "./widgets/quick-add-widget";
import { StatsWidget } from "./widgets/stats-widget";
import { DueSoonWidget, OverdueWidget } from "./widgets/task-widgets";
import { WeekWidget } from "./widgets/week-widget";

export type WidgetDefinition = {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Rendered inside its own <Suspense>, so it may read data and the clock. */
  Component: () => React.ReactNode | Promise<React.ReactNode>;
  /** Fixed footprint in the bento grid. */
  size: WidgetSize;
  /** "tile" wraps it in a titled card; "bare" widgets draw their own tiles (title kept for screen readers). */
  frame: "tile" | "bare";
  /** Fill the whole grid area instead of sizing to content. Only for elastic content (the timeline). */
  stretch?: boolean;
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
  "next-up": {
    title: "Next up",
    description: "The class on now or next, with a live countdown.",
    icon: Sparkles,
    Component: NextUpWidget,
    size: "hero",
    frame: "bare",
    skeletonRows: 4,
  },
  stats: {
    title: "At a glance",
    description: "Due today, overdue, and your GPA.",
    icon: Gauge,
    Component: StatsWidget,
    size: "small",
    frame: "bare",
    skeletonRows: 3,
  },
  classes: {
    title: "Today's classes",
    description: "Today's classes on a timeline, with a line for now.",
    icon: Sun,
    Component: ClassesWidget,
    size: "tall",
    frame: "tile",
    stretch: true,
    href: "/courses?view=day",
    hrefLabel: "By day",
    skeletonRows: 5,
  },
  week: {
    title: "This week",
    description: "Classes and deadlines for each day of the week.",
    icon: CalendarRange,
    Component: WeekWidget,
    size: "wide",
    frame: "tile",
    href: "/courses?view=day",
    hrefLabel: "By day",
    skeletonRows: 2,
  },
  "due-soon": {
    title: "Due soon",
    description: "Tasks due today and over the next two days.",
    icon: CalendarClock,
    Component: DueSoonWidget,
    size: "tall",
    frame: "tile",
    href: "/tasks?due=week",
    skeletonRows: 4,
  },
  overdue: {
    title: "Overdue",
    description: "Open tasks whose deadline has passed.",
    icon: AlarmClock,
    Component: OverdueWidget,
    size: "small",
    frame: "tile",
    href: "/tasks?due=overdue",
    skeletonRows: 2,
  },
  grades: {
    title: "Grades",
    description: "This semester's GPA and your grade so far in each course.",
    icon: GraduationCap,
    Component: GradesWidget,
    size: "small",
    frame: "tile",
    href: "/grades",
    skeletonRows: 3,
  },
  money: {
    title: "Money",
    description: "Safe to spend, bills due this week, and budgets running out.",
    icon: Wallet,
    Component: MoneyWidget,
    size: "small",
    frame: "tile",
    href: "/money",
    hrefLabel: "Open money",
    skeletonRows: 3,
  },
  "quick-add": {
    title: "Quick add",
    description: "Add a task with just a title.",
    icon: Plus,
    Component: QuickAddWidget,
    size: "small",
    frame: "tile",
    skeletonRows: 1,
  },
};
