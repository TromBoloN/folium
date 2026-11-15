import { Archive, ArchiveRestore, GraduationCap, ListChecks, Pencil, Trash2 } from "lucide-react";
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
      <ActionForm action={setCourseArchived} fields={{ id: course.id, archive: String(!archived) }}>
        <SubmitButton variant="outline" size="sm">
          {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {archived ? "Unarchive" : "Archive"}
        </SubmitButton>
      </ActionForm>
      {/* <details> gives a confirm step that works without JavaScript. */}
      <details className="group relative">
        <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded-md px-3 font-medium text-destructive text-sm hover:bg-destructive/10">
          <Trash2 aria-hidden className="size-4" />
          Delete
        </summary>
        <div className="absolute right-0 z-10 mt-2 flex w-72 flex-col gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-md sm:left-0">
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
  );
}
