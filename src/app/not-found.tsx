import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Tr } from "@/lib/i18n/client";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <EmptyState icon={SearchX} title="Not found" description="This page doesn't exist, or it isn't yours.">
        <Button asChild size="sm">
          <Link href="/">
            <Tr k="Go to Today" />
          </Link>
        </Button>
      </EmptyState>
    </main>
  );
}
