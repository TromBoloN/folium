"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last resort: replaces the root layout when it fails (e.g. settings can't load).
 * It renders its own <html>/<body>, so it uses the default theme and plain markup.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" data-mode="system" data-preset="green" data-font="system" data-density="comfortable">
      <body>
        <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="font-semibold text-xl">Folium couldn&apos;t load</h1>
          <p className="text-muted-foreground text-sm">Something went wrong on our side. Please try again.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
