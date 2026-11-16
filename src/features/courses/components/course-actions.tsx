import { Archive, ArchiveRestore, GraduationCap, ListChecks, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { rich } from "@/lib/i18n/rich";
import { getT } from "@/lib/i18n/server";
import { deleteCourse, setCourseArchived } from "../actions";
import type { Course } from "../schema";

export async function CourseActions({ course }: { course: Course }) {
  const t = await getT();
  const archived = Boolean(course.archivedAt);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/tasks?course=${course.id}`}>
          <ListChecks aria-hidden />
          {t("Tasks")}
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/grades/${course.id}`}>
          <GraduationCap aria-hidden />
          {t("Grades")}
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/courses/${course.id}/edit`}>
          <Pencil aria-hidden />
          {t("Edit")}
        </Link>
      </Button>
      {/* Rarer actions in a "⋯" menu. <details> keeps it (and the delete confirm) working without JavaScript. */}
      <details className="group relative">
        <summary
          aria-label={t("More actions")}
          className="inline-flex h-8 cursor-pointer list-none items-center justify-center rounded-md border border-border px-2.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </summary>
        <div className="absolute right-0 z-20 mt-2 flex w-72 flex-col gap-1 panel rounded-xl p-1.5 text-popover-foreground sm:right-auto sm:left-0">
          <ActionForm action={setCourseArchived} fields={{ id: course.id, archive: String(!archived) }}>
            <SubmitButton variant="ghost" size="sm" className="w-full justify-start">
              {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {archived ? t("Unarchive") : t("Archive (hide from the timetable)")}
            </SubmitButton>
          </ActionForm>
          <details className="group/delete">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md px-3 font-medium text-destructive text-sm hover:bg-destructive/10">
              <Trash2 aria-hidden className="size-4" />
              {t("Delete…")}
            </summary>
            <div className="flex flex-col gap-3 px-3 pt-2 pb-2">
              <p className="text-sm">
                {rich(t("Delete {name} and its class times? Its tasks are kept. This can't be undone."), {
                  name: <strong>{course.name}</strong>,
                })}
              </p>
              <ActionForm action={deleteCourse} fields={{ id: course.id }}>
                <SubmitButton variant="destructive" size="sm" pendingLabel={t("Deleting…")}>
                  {t("Delete course")}
                </SubmitButton>
              </ActionForm>
            </div>
          </details>
        </div>
      </details>
    </div>
  );
}
