import { requireUser } from "@/features/auth/queries";
import { listCourses } from "../queries";
import { nextCourseColor } from "../schema";
import { CourseForm } from "./course-form";

/** New course form, shared by the page and the sheet. Suggests a colour no other course uses. */
export async function NewCourseScreen() {
  await requireUser();
  const courses = await listCourses();
  return <CourseForm mode="create" defaultColor={nextCourseColor(courses.map((c) => c.color))} />;
}
