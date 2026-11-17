import { BookOpen, Sprout, Wallet } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tile } from "@/components/ui/tile";
import { getT } from "@/lib/i18n/server";

/**
 * Today before there's anything in Folium: one prompt with the two ways in,
 * instead of a grid of empty cards. Gone as soon as a course, task or
 * transaction exists (the widgets with data take over).
 */
export async function Welcome() {
  const t = await getT();
  return (
    <Tile as="section" aria-labelledby="welcome-h" reveal={0} className="overflow-hidden p-6 sm:p-8">
      <span
        aria-hidden
        data-slot="hero-art"
        className="leaf-veins pointer-events-none absolute -right-10 -bottom-14 size-72 opacity-15"
      />
      <div className="relative flex max-w-xl flex-col gap-4">
        <Sprout aria-hidden className="size-7 text-primary" />
        <h2 id="welcome-h" className="font-display font-medium text-3xl leading-tight">
          {t("Today fills itself in")}
        </h2>
        <p className="text-muted-foreground">
          {t(
            "Add a class and Today shows what's on, which meeting you're at, and what's due. Cards appear as soon as they have something to say.",
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/courses/new">
              <BookOpen aria-hidden />
              {t("Add your first class")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/money/new">
              <Wallet aria-hidden />
              {t("Start managing your finances")}
            </Link>
          </Button>
        </div>
      </div>
    </Tile>
  );
}
