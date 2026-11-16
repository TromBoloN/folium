import { io } from "next/cache";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/features/auth/queries";
import { getSettings } from "@/features/settings/queries";
import { localDateFor } from "../lib/local-date";
import {
  ensureFinanceDefaults,
  getTransaction,
  lastUsedAccountId,
  listAccounts,
  listCategories,
  listPayeeHistory,
} from "../queries";
import { TRANSACTION_KINDS, type TransactionKind } from "../schemas";
import { type TransactionDefaults, TransactionForm } from "./transaction-form";

type Variant = { variant: "page" | "sheet" };

/** "25000" → "25.000" for an editable amount field (parseAmount reads it back). */
const grouped = (n: bigint) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

async function formData(keepIds: (string | null)[] = []) {
  await ensureFinanceDefaults();
  const [accounts, categories, history] = await Promise.all([listAccounts(), listCategories(), listPayeeHistory()]);
  // Archived ones are hidden from pickers, unless the transaction being edited uses them.
  return {
    accounts: accounts
      .filter((a) => !a.archived || keepIds.includes(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        color: a.color,
        icon: a.icon,
        balance: a.balance.toString(),
      })),
    categories: categories
      .filter((c) => !c.archived || keepIds.includes(c.id))
      .map((c) => ({ id: c.id, name: c.name, kind: c.kind, parentId: c.parentId, color: c.color, icon: c.icon })),
    history,
    allAccounts: accounts,
  };
}

/** ?kind= and ?account= preselect (e.g. "Adjust" on an account opens an adjustment for it). */
export async function NewTransactionScreen({ kind, account, variant }: { kind?: string; account?: string } & Variant) {
  await requireUser();
  const [{ accounts, categories, history, allAccounts }, { preferences }] = await Promise.all([
    formData(),
    getSettings(),
  ]);
  await io();
  const today = localDateFor(new Date(), preferences.timeZone);
  const defaults: TransactionDefaults = {
    kind: TRANSACTION_KINDS.includes(kind as TransactionKind) ? (kind as TransactionKind) : "expense",
    status: "posted",
    amount: "",
    accountId:
      allAccounts.find((a) => a.id === account && !a.archived)?.id ?? (await lastUsedAccountId(allAccounts)) ?? "",
    toAccountId: "",
    feeAmount: "",
    categoryId: "",
    payee: "",
    note: "",
    occurredOn: today,
    adjustmentDirection: "",
  };
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="Add transaction" back={<BackLink href="/money">Money</BackLink>} />
      ) : null}
      <TransactionForm
        defaults={defaults}
        today={today}
        accounts={accounts}
        categories={categories}
        history={history}
      />
    </>
  );
}

export async function EditTransactionScreen({ id, variant }: { id: string } & Variant) {
  await requireUser();
  const transaction = await getTransaction(id);
  if (!transaction) notFound();
  const [{ accounts, categories, history }, { preferences }] = await Promise.all([
    formData([transaction.accountId, transaction.toAccountId, transaction.categoryId]),
    getSettings(),
  ]);
  await io();
  const today = localDateFor(new Date(), preferences.timeZone);
  const defaults: TransactionDefaults = {
    kind: transaction.kind,
    status: transaction.status,
    amount: grouped(transaction.amount),
    accountId: transaction.accountId,
    toAccountId: transaction.toAccountId ?? "",
    feeAmount: transaction.feeAmount > 0n ? grouped(transaction.feeAmount) : "",
    categoryId: transaction.categoryId ?? "",
    payee: transaction.payee ?? "",
    note: transaction.note ?? "",
    occurredOn: transaction.occurredOn,
    adjustmentDirection: transaction.adjustmentDirection ?? "",
  };
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="Edit transaction" back={<BackLink href="/money">Money</BackLink>} />
      ) : null}
      <TransactionForm
        id={id}
        defaults={defaults}
        today={today}
        accounts={accounts}
        categories={categories}
        history={history}
      />
    </>
  );
}
