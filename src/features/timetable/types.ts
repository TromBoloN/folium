import type { Course } from "../courses/schema";
import type { SlotTiming } from "./logic";

export type TimetableSlot = SlotTiming & {
  courseId: string;
  location: string | null;
  course: Course;
};
