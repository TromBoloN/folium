import { Check, Palette } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { requireUser } from "@/features/auth/queries";
import { setThemePack } from "@/features/settings/actions";
import { getSettings } from "@/features/settings/queries";
import { visibleThemes } from "@/features/themes/registry";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Themes") };
}

/**
 * Themes: the gallery of theme packs (docs/development/Themes.md). Users see
 * "Available soon" until the first bold packs ship. While running locally, the
 * registered packs are listed with an Apply button so they can be tried while
 * they're being built.
 */
export default function ThemesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Themes" description="Whole looks for Folium: colours, cards, backgrounds, motion and fonts." />
      <div className="flex flex-col gap-6">
        <EmptyState
          icon={Palette}
          title="Available soon"
          description="Full themes are on the way. Each one changes the colours, cards, background, motion and headline font, while Folium works exactly the same underneath."
        >
          <p className="text-muted-foreground text-sm">
            <Tr k="Until then, pick a colour, mode and motion in Settings." />
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">
              <Tr k="Open Settings" />
            </Link>
          </Button>
        </EmptyState>
        {process.env.NODE_ENV !== "production" ? (
          <Suspense fallback={<ListSkeleton rows={1} label="Loading" />}>
            <DevPacks />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
}

/** Development only: every registered pack, with the one in use marked. Apply works without JavaScript. */
async function DevPacks() {
  await requireUser();
  const [{ theme }, t] = await Promise.all([getSettings(), getT()]);
  return (
    <section aria-labelledby="dev-packs-h" className="tile flex flex-col gap-3 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="dev-packs-h" className="font-medium">
          {t("Theme packs (development only)")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("Only you see this list, while running Folium locally. Users see “Available soon”.")}
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border-soft">
        {visibleThemes(true).map((pack) => {
          const active = pack.id === theme.pack;
          return (
            <li key={pack.id} className="flex flex-wrap items-center gap-3 py-3">
              {/* Swatches are the pack's own preview colours (data, like course colours). */}
              <span aria-hidden className="flex shrink-0 overflow-hidden rounded-md border border-border-soft">
                {Object.values(pack.preview).map((color) => (
                  <span key={color} className="size-6" style={{ background: color }} />
                ))}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-1.5 font-medium">
                  {t(pack.label)}
                  {pack.status === "draft" ? <Pill tone="warning">{t("Draft")}</Pill> : null}
                  {pack.scheme === "dark" ? <Pill>{t("Dark only")}</Pill> : null}
                  {pack.scheme === "light" ? <Pill>{t("Light only")}</Pill> : null}
                </span>
                <span className="text-muted-foreground text-xs">{t(pack.description)}</span>
              </span>
              {active ? (
                <Pill tone="accent">
                  <Check aria-hidden />
                  {t("In use")}
                </Pill>
              ) : (
                <ActionForm action={setThemePack} fields={{ pack: pack.id }}>
                  <SubmitButton size="sm" variant="outline">
                    {t("Apply")}
                    <span className="sr-only"> {t(pack.label)}</span>
                  </SubmitButton>
                </ActionForm>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
