import { Download, FileJson, Trash2, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmitButton } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { deleteAllFinanceData, undoImport } from "@/features/finance/actions/data";
import { ImportForm } from "@/features/finance/components/import-form";
import { ToastForm } from "@/features/finance/components/toast-form";
import { ensureFinanceDefaults, lastUsedAccountId, listAccounts } from "@/features/finance/queries";
import { listImportBatches } from "@/features/finance/queries/imports";
import { formatDate } from "@/lib/dates";
import { getI18n, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Import and export") };
}

export default function ImportPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Import and export"
        description="Backfill from a bank CSV, take your data with you, or start over."
        back={<BackLink href="/money">Money</BackLink>}
      />
      <Suspense fallback={<FormSkeleton label="Loading" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  await requireUser();
  await ensureFinanceDefaults();
  const [accounts, batches, { t, intl }] = await Promise.all([listAccounts(), listImportBatches(), getI18n()]);
  const active = accounts.filter((a) => !a.archived);
  const name = new Map(accounts.map((a) => [a.id, a.name]));
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="import-h" className="tile flex flex-col gap-4 p-5">
        <h2 id="import-h" className="font-medium">
          {t("Import a CSV")}
        </h2>
        <ImportForm
          accounts={active.map((a) => ({ id: a.id, name: a.name }))}
          defaultAccountId={(await lastUsedAccountId(accounts)) ?? active[0]?.id ?? ""}
        />
      </section>

      {batches.length > 0 ? (
        <section aria-labelledby="batches-h" className="tile flex flex-col overflow-hidden">
          <h2 id="batches-h" className="px-5 pt-5 pb-2 font-medium">
            {t("Past imports")}
          </h2>
          <ul className="flex flex-col divide-y divide-border-soft">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{b.filename ?? t("CSV import")}</span>
                  <span className="text-muted-foreground text-xs">
                    {t("{n} rows into {account}", { n: b.rowCount, account: name.get(b.accountId) ?? t("an account") })}{" "}
                    · {formatDate(b.createdAt.slice(0, 10), { day: "numeric", month: "short", year: "numeric" }, intl)}
                  </span>
                </div>
                <ToastForm action={undoImport} fields={{ id: b.id }}>
                  <SubmitButton size="sm" variant="outline">
                    <Undo2 aria-hidden />
                    {t("Undo this import")}
                    <span className="sr-only">: {b.filename}</span>
                  </SubmitButton>
                </ToastForm>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="export-h" className="tile flex flex-col gap-3 p-5">
        <h2 id="export-h" className="font-medium">
          {t("Export")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <a href="/money/export.csv" download>
              <Download aria-hidden />
              {t("CSV (spreadsheets)")}
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/money/export.json" download>
              <FileJson aria-hidden />
              {t("Full backup (JSON)")}
            </a>
          </Button>
        </div>
      </section>

      <section aria-labelledby="danger-h" className="tile flex flex-col gap-3 border-destructive/40 p-5">
        <h2 id="danger-h" className="font-medium text-destructive">
          {t("Delete all money data")}
        </h2>
        <p className="text-muted-foreground text-sm">
          Every transaction, account, category, budget, goal, recurring bill and person. This can't be undone; download
          a backup first. The four default accounts come back empty.
        </p>
        <ToastForm action={deleteAllFinanceData} className="flex-row flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <label htmlFor="confirm" className="font-medium text-sm">
              {t("Type DELETE to confirm")}
            </label>
            <input
              id="confirm"
              name="confirm"
              autoComplete="off"
              className="h-10 rounded-md border border-border bg-surface-1 px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
            />
          </div>
          <SubmitButton size="sm" variant="destructive">
            <Trash2 aria-hidden />
            {t("Delete everything")}
          </SubmitButton>
        </ToastForm>
      </section>
    </div>
  );
}
