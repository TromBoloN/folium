import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/** notFound() from a signed-in page: shown inside the app shell, so navigation stays available. */
export default function AppNotFound() {
  return (
    <EmptyState icon={SearchX} title="Not found" description="This page doesn't exist, or it belongs to someone else.">
      <Button asChild size="sm">
        <Link href="/">Go to Today</Link>
      </Button>
    </EmptyState>
  );
}
