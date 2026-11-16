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
    accounts: accounts.filter((a) => !a.archived || keepIds.includes(a.id)),
    categories: categories
      .filter((c) => !c.archived || keepIds.includes(c.id))
      .map((c) => ({ id: c.id, name: c.name, kind: c.kind, parentId: c.parentId })),
    history,
    allAccounts: accounts,
  };
}

export async function NewTransactionScreen({ kind, variant }: { kind?: string } & Variant) {
  await requireUser();
  const [{ accounts, categories, history, allAccounts }, { preferences }] = await Promise.all([
    formData(),
    getSettings(),
  ]);
  await io();
  const defaults: TransactionDefaults = {
    kind: TRANSACTION_KINDS.includes(kind as TransactionKind) ? (kind as TransactionKind) : "expense",
    status: "posted",
    amount: "",
    accountId: (await lastUsedAccountId(allAccounts)) ?? "",
    toAccountId: "",
    feeAmount: "",
    categoryId: "",
    payee: "",
    note: "",
    occurredOn: localDateFor(new Date(), preferences.timeZone),
    adjustmentDirection: "",
  };
  return (
    <>
      {variant === "page" ? (
        <PageHeader title="Add transaction" back={<BackLink href="/money">Money</BackLink>} />
      ) : null}
      <TransactionForm defaults={defaults} accounts={accounts} categories={categories} history={history} />
    </>
  );
}

export async function EditTransactionScreen({ id, variant }: { id: string } & Variant) {
  await requireUser();
  const transaction = await getTransaction(id);
  if (!transaction) notFound();
  const { accounts, categories, history } = await formData([
    transaction.accountId,
    transaction.toAccountId,
    transaction.categoryId,
  ]);
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
      <TransactionForm id={id} defaults={defaults} accounts={accounts} categories={categories} history={history} />
    </>
  );
}
