import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/features/auth/queries";
import { getSettings } from "@/features/settings/queries";
import { dueParts } from "@/features/tasks/due";
import { Tr } from "@/lib/i18n/client";
import { getCourseGradebook } from "../queries";
import { AssessmentForm } from "./assessment-form";

type Variant = { variant: "page" | "sheet" };

export async function NewAssessmentScreen({ courseId, variant }: { courseId: string } & Variant) {
  await requireUser();
  const course = await getCourseGradebook(courseId);
  if (!course) notFound();
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="Add assessment" back={<BackLink href={`/grades/${course.id}`}>{course.name}</BackLink>} />
      ) : (
        <p className="mb-4 text-muted-foreground text-sm">
          <Tr k="For {name}" vars={{ name: course.name }} />
        </p>
      )}
      <AssessmentForm
        courseId={course.id}
        defaults={{ name: "", weight: "", maxScore: "100", score: "", dueDate: "" }}
      />
    </>
  );
}

export async function EditAssessmentScreen({
  courseId,
  assessmentId,
  variant,
}: { courseId: string; assessmentId: string } & Variant) {
  await requireUser();
  const [course, { preferences }] = await Promise.all([getCourseGradebook(courseId), getSettings()]);
  const assessment = course?.assessments.find((a) => a.id === assessmentId);
  if (!course || !assessment) notFound();
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="Edit assessment" back={<BackLink href={`/grades/${course.id}`}>{course.name}</BackLink>} />
      ) : (
        <p className="mb-4 text-muted-foreground text-sm">
          <Tr k="For {name}" vars={{ name: course.name }} />
        </p>
      )}
      <AssessmentForm
        courseId={course.id}
        id={assessment.id}
        defaults={{
          name: assessment.name,
          weight: String(assessment.weight),
          maxScore: String(assessment.maxScore),
          score: assessment.score === null ? "" : String(assessment.score),
          dueDate: assessment.dueAt ? dueParts(assessment.dueAt, false, preferences.timeZone).date : "",
        }}
      />
    </>
  );
}
