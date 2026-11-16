import { SectionTabs } from "@/components/section-tabs";
import { SCHOOL_TABS } from "@/lib/sections";

/**
 * School: Courses, Tasks and Grades share one tab bar. A route group, so the
 * URLs (/courses, /tasks, /grades and everything below) are unchanged. Each
 * page keeps its own heading.
 */
export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <SectionTabs label="School" items={SCHOOL_TABS} />
      <div>{children}</div>
    </div>
  );
}
