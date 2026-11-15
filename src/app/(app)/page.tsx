import { Sun } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Today" };

// Placeholder until the Today dashboard (stage 5).
export default function TodayPage() {
  return (
    <>
      <PageHeader title="Today" description="Your classes and what's due, at a glance." />
      <EmptyState
        icon={Sun}
        title="Nothing here yet"
        description="Once you add courses and tasks, today's classes and upcoming deadlines will show up here."
      />
    </>
  );
}
