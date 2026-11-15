"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

/** Errors outside the signed-in area (auth pages). Signed-in pages use (app)/error.tsx inside the shell. */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description="This page couldn't load. Check your connection and try again."
      >
        <Button size="sm" onClick={() => retry()}>
          Try again
        </Button>
      </EmptyState>
    </main>
  );
}
