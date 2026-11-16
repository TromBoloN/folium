import { Check, Sprout } from "lucide-react";
import Link from "next/link";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Tile } from "@/components/ui/tile";
import { listCourses } from "@/features/courses/queries";
import { hasAnyTransaction } from "@/features/finance/queries";
import { hasAnyTask } from "@/features/tasks/queries";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/**
 * First-run checklist on Today: add a course, give it class times, add a task, track some money.
 * Progress comes from real data, so it ticks itself off and disappears once
 * everything is done (no "dismiss" state to store).
 */
export async function Onboarding() {
  const [courses, anyTask, anyTransaction, t] = await Promise.all([
    listCourses(),
    hasAnyTask(),
    hasAnyTransaction(),
    getT(),
  ]);
  const steps = [
    {
      done: courses.length > 0,
      title: t("Add your first course"),
      detail: t("In School: name, code and a colour. Colours follow the course everywhere."),
      href: "/courses/new",
      cta: t("Add a course"),
    },
    {
      done: courses.some((c) => c.slots.length > 0),
      title: t("Add its class times"),
      detail: t("Your timetable, the Next up countdown and the day timeline come from these."),
      href: courses.length > 0 ? "/courses/timetable/new" : null,
      cta: t("Add class times"),
    },
    {
      done: anyTask,
      title: t("Add an assignment"),
      detail: t("A task for a class, in one line: “Essay outline tomorrow 5pm #ING101”. Press N anywhere."),
      href: "/tasks/new",
      cta: t("Add a task"),
    },
    {
      done: anyTransaction,
      title: t("Track some money"),
      detail: t("Add what you spent or received; your accounts keep their balance. “gofood 32k #food @gopay”."),
      href: "/money/new",
      cta: t("Add a transaction"),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const nextIndex = steps.findIndex((s) => !s.done);

  return (
    <Tile as="section" aria-labelledby="onboarding" reveal={0} className="overflow-hidden p-5 sm:p-6">
      <span aria-hidden className="leaf-veins pointer-events-none absolute -top-10 -right-8 size-56 opacity-15" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
        <div className="flex items-center gap-4 md:w-64 md:shrink-0 md:flex-col md:items-start">
          <ProgressRing
            value={doneCount / steps.length}
            label={t("{n} of {total} steps done", { n: doneCount, total: steps.length })}
            size={64}
          >
            <span className="font-display font-medium text-lg tabular-nums">
              {doneCount}/{steps.length}
            </span>
          </ProgressRing>
          <div className="flex flex-col gap-1">
            <h2 id="onboarding" className="flex items-center gap-2 font-display font-medium text-2xl">
              <Sprout aria-hidden className="size-5 text-primary" />
              {t("Set up Folium")}
            </h2>
            <p className="text-muted-foreground text-sm">{t("Four steps and Today fills itself in.")}</p>
          </div>
        </div>
        <ol className="flex flex-1 flex-col gap-2">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className={cn(
                "flex items-start gap-3 rounded-xl border border-border-soft p-3",
                i === nextIndex ? "bg-surface-2 shadow-tile" : "bg-transparent",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs",
                  step.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {step.done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("font-medium", step.done && "text-muted-foreground line-through")}>
                  {step.title}
                  {step.done ? <span className="sr-only">{t(" (done)")}</span> : null}
                </span>
                {step.done ? null : <span className="text-muted-foreground text-sm">{step.detail}</span>}
              </span>
              {!step.done && step.href ? (
                <Link
                  href={step.href}
                  className={cn(
                    "shrink-0 self-center rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
                    i === nextIndex
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border-soft hover:bg-accent",
                  )}
                >
                  {step.cta}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </Tile>
  );
}
