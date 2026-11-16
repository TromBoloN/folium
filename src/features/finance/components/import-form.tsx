"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { plural } from "@/lib/i18n/core";
import { type ImportState, importCsv } from "../actions/data";

const input =
  "h-10 rounded-md border border-border bg-surface-1 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

function ColumnSelect({
  name,
  label,
  header,
  value,
  optional = true,
}: {
  name: string;
  label: string;
  header: string[];
  value: number | undefined;
  optional?: boolean;
}) {
  const { t, tl } = useI18n();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={name} className="font-medium text-sm">
        {tl(label)}
      </label>
      <select id={name} name={name} defaultValue={value === undefined ? "" : String(value)} className={input}>
        {optional ? <option value="">{t("Not in this file")}</option> : null}
        {header.map((h, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
          <option key={i} value={i}>
            {h || t("Column {n}", { n: i + 1 })}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * CSV import: upload, map the columns, preview, import. Each step is a submit
 * of the same server action, so it works without JavaScript. Nothing is
 * written until "Import".
 */
export function ImportForm({
  accounts,
  defaultAccountId,
}: {
  accounts: { id: string; name: string }[];
  defaultAccountId: string;
}) {
  const { t, tl } = useI18n();
  const [state, action, pending] = useActionState(importCsv, { step: "upload" } as ImportState);

  if (state.step === "done") {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p className="font-medium">
          {t(plural(state.inserted ?? 0, "Imported 1 transaction", "Imported {n} transactions"), {
            n: state.inserted ?? 0,
          })}
          {state.skipped ? t("; skipped {n} already imported", { n: state.skipped }) : ""}.
        </p>
        <p className="text-muted-foreground text-sm">
          {t("Next, match the account to your real balance so the totals line up.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/money/accounts/${state.accountId}#reconcile`}>{t("Match my real balance")}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/money/transactions?account=${state.accountId}`}>{t("See them")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const m = state.mapping ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" encType="multipart/form-data">
      <div className="grid gap-1.5 sm:max-w-xs">
        <label htmlFor="accountId" className="font-medium text-sm">
          {t("Account this file is from")}
        </label>
        <select id="accountId" name="accountId" defaultValue={state.accountId ?? defaultAccountId} className={input}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {state.step === "upload" ? (
        <>
          <input type="hidden" name="step" value="upload" />
          <div className="grid gap-1.5">
            <label htmlFor="file" className="font-medium text-sm">
              {t("CSV file")}
            </label>
            <input id="file" name="file" type="file" accept=".csv,text/csv" required className="text-sm" />
            <p className="text-muted-foreground text-xs">
              {t(
                "From your bank or e-wallet (most can export a statement as CSV). You choose the columns next; nothing is saved yet.",
              )}
            </p>
          </div>
          <Button type="submit" disabled={pending} className="self-start">
            <Upload aria-hidden />
            {pending ? t("Reading…") : t("Read file")}
          </Button>
        </>
      ) : (
        <>
          <input type="hidden" name="csv" value={state.csv ?? ""} />
          <input type="hidden" name="filename" value={state.filename ?? ""} />
          <p className="text-sm">
            <span className="font-medium">{state.filename}</span>
            {t(": choose what each column means.")}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <ColumnSelect name="colDate" label="Date" header={state.header ?? []} value={m.date} optional={false} />
            <div className="grid gap-1.5">
              <label htmlFor="dateFormat" className="font-medium text-sm">
                {t("Date order")}
              </label>
              <select id="dateFormat" name="dateFormat" defaultValue={m.dateFormat ?? "dmy"} className={input}>
                <option value="dmy">{t("Day/month/year (05/11/2026)")}</option>
                <option value="ymd">{t("Year-month-day (2026-11-05)")}</option>
                <option value="mdy">{t("Month/day/year (11/05/2026)")}</option>
              </select>
            </div>
            <ColumnSelect name="colPayee" label="Description / payee" header={state.header ?? []} value={m.payee} />
            <ColumnSelect
              name="colAmount"
              label="Amount (one column, signed)"
              header={state.header ?? []}
              value={m.amount}
            />
            <ColumnSelect name="colDebit" label="…or money out" header={state.header ?? []} value={m.debit} />
            <ColumnSelect name="colCredit" label="…and money in" header={state.header ?? []} value={m.credit} />
            <ColumnSelect name="colNote" label="Note" header={state.header ?? []} value={m.note} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="positiveIsExpense"
                defaultChecked={m.positiveIsExpense}
                className="size-4 accent-primary"
              />
              {t("Positive amounts are spending")}
            </label>
            <label className="flex items-center gap-2">
              <input type="hidden" name="hasHeader" value="off" />
              <input
                type="checkbox"
                name="hasHeader"
                value="on"
                defaultChecked={m.hasHeader !== false}
                className="size-4 accent-primary"
              />
              {t("The first row is a header")}
            </label>
          </div>

          {state.preview ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                {t(plural(state.total ?? 0, "1 row ready", "{n} rows ready"), { n: state.total ?? 0 })}
                {state.problems?.length ? t(", {n} with problems (skipped)", { n: state.problems.length }) : ""}
                {t(". First ones:")}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <caption className="sr-only">{t("Preview")}</caption>
                  <thead>
                    <tr className="text-left text-muted-foreground text-xs">
                      <th scope="col" className="py-1 pr-3 font-normal">
                        {t("Line")}
                      </th>
                      <th scope="col" className="py-1 pr-3 font-normal">
                        {t("Date")}
                      </th>
                      <th scope="col" className="py-1 pr-3 font-normal">
                        {t("Kind")}
                      </th>
                      <th scope="col" className="py-1 pr-3 text-right font-normal">
                        {t("Amount")}
                      </th>
                      <th scope="col" className="py-1 font-normal">
                        {t("Payee")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.preview.map((r) => (
                      <tr key={r.line} className="border-border-soft border-t">
                        <td className="py-1 pr-3 text-muted-foreground">{r.line}</td>
                        <td className="py-1 pr-3">{r.date}</td>
                        <td className="py-1 pr-3">{r.kind === "income" ? t("In") : t("Out")}</td>
                        <td className="py-1 pr-3 text-right">{r.amount}</td>
                        <td className="max-w-48 truncate py-1">{r.payee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.problems?.length ? (
                <ul className="text-destructive text-xs">
                  {state.problems.map((p) => (
                    <li key={p.line}>{t("Line {n}: {message}", { n: p.line, message: tl(p.message) })}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="step" value="map" variant="outline" disabled={pending}>
              {t("Preview")}
            </Button>
            {state.preview && (state.total ?? 0) > 0 ? (
              <Button type="submit" name="step" value="import" disabled={pending}>
                {pending
                  ? t("Importing…")
                  : t(plural(state.total ?? 0, "Import 1 row", "Import {n} rows"), { n: state.total ?? 0 })}
              </Button>
            ) : null}
          </div>
        </>
      )}
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {tl(state.error)}
        </p>
      ) : null}
    </form>
  );
}
