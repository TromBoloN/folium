import { Archive, ArchiveRestore, GraduationCap, ListChecks, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { deleteCourse, setCourseArchived } from "../actions";
import type { Course } from "../schema";

export function CourseActions({ course }: { course: Course }) {
  const archived = Boolean(course.archivedAt);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/tasks?course=${course.id}`}>
          <ListChecks aria-hidden />
          Tasks
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/grades/${course.id}`}>
          <GraduationCap aria-hidden />
          Grades
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/courses/${course.id}/edit`}>
          <Pencil aria-hidden />
          Edit
        </Link>
      </Button>
      {/* Rarer actions in a "⋯" menu. <details> keeps it (and the delete confirm) working without JavaScript. */}
      <details className="group relative">
        <summary
          aria-label="More actions"
          className="inline-flex h-8 cursor-pointer list-none items-center justify-center rounded-md border border-border px-2.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </summary>
        <div className="absolute right-0 z-20 mt-2 flex w-72 flex-col gap-1 rounded-xl border border-border-soft bg-popover p-1.5 text-popover-foreground shadow-raised sm:right-auto sm:left-0">
          <ActionForm action={setCourseArchived} fields={{ id: course.id, archive: String(!archived) }}>
            <SubmitButton variant="ghost" size="sm" className="w-full justify-start">
              {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {archived ? "Unarchive" : "Archive (hide from the timetable)"}
            </SubmitButton>
          </ActionForm>
          <details className="group/delete">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md px-3 font-medium text-destructive text-sm hover:bg-destructive/10">
              <Trash2 aria-hidden className="size-4" />
              Delete…
            </summary>
            <div className="flex flex-col gap-3 px-3 pt-2 pb-2">
              <p className="text-sm">
                Delete <strong>{course.name}</strong> and its class times? Its tasks are kept. This can't be undone.
              </p>
              <ActionForm action={deleteCourse} fields={{ id: course.id }}>
                <SubmitButton variant="destructive" size="sm" pendingLabel="Deleting…">
                  Delete course
                </SubmitButton>
              </ActionForm>
            </div>
          </details>
        </div>
      </details>
    </div>
  );
}
