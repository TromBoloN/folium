import { io } from "next/cache";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/features/auth/queries";
import { listCourseOptions } from "@/features/courses/queries";
import { getSettings } from "@/features/settings/queries";
import { groupDigits } from "../lib/format-idr";
import { localDateFor } from "../lib/local-date";
import {
  ensureFinanceDefaults,
  getTransaction,
  lastUsedAccountId,
  listAccounts,
  listCategories,
  listPayeeHistory,
} from "../queries";
import { listPeople } from "../queries/people";
import { TRANSACTION_KINDS, type TransactionKind } from "../schemas";
import { type TransactionDefaults, TransactionForm } from "./transaction-form";

type Variant = { variant: "page" | "sheet" };

async function formData(keepIds: (string | null)[] = []) {
  await ensureFinanceDefaults();
  const [accounts, categories, history, people, courses] = await Promise.all([
    listAccounts(),
    listCategories(),
    listPayeeHistory(),
    listPeople(),
    listCourseOptions(),
  ]);
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
    people: people.filter((p) => !p.archived || keepIds.includes(p.id)).map((p) => ({ id: p.id, name: p.name })),
    peopleById: new Map(people.map((p) => [p.id, p.name])),
    courses: courses
      .filter((c) => !c.archived || keepIds.includes(c.id))
      .map((c) => ({ id: c.id, name: c.name, code: c.code })),
    allAccounts: accounts,
  };
}

/** ?kind= and ?account= preselect (e.g. "Adjust" on an account opens an adjustment for it). */
export async function NewTransactionScreen({
  kind,
  account,
  to,
  variant,
}: { kind?: string; account?: string; to?: string } & Variant) {
  await requireUser();
  const [{ accounts, categories, history, allAccounts, people, courses }, { preferences }] = await Promise.all([
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
    // "Add money" on a goal: a transfer into its savings account.
    toAccountId: allAccounts.find((a) => a.id === to && !a.archived)?.id ?? "",
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
        people={people}
        courses={courses}
      />
    </>
  );
}

export async function EditTransactionScreen({ id, variant }: { id: string } & Variant) {
  await requireUser();
  const transaction = await getTransaction(id);
  if (!transaction) notFound();
  const [{ accounts, categories, history, people, peopleById, courses }, { preferences }] = await Promise.all([
    formData([
      transaction.accountId,
      transaction.toAccountId,
      transaction.categoryId,
      transaction.personId,
      transaction.courseId,
    ]),
    getSettings(),
  ]);
  await io();
  const today = localDateFor(new Date(), preferences.timeZone);
  const defaults: TransactionDefaults = {
    kind: transaction.kind,
    status: transaction.status,
    amount: groupDigits(transaction.amount),
    accountId: transaction.accountId,
    toAccountId: transaction.toAccountId ?? "",
    feeAmount: transaction.feeAmount > 0n ? groupDigits(transaction.feeAmount) : "",
    categoryId: transaction.categoryId ?? "",
    payee: transaction.payee ?? "",
    note: transaction.note ?? "",
    occurredOn: transaction.occurredOn,
    adjustmentDirection: transaction.adjustmentDirection ?? "",
    personName: transaction.personId ? (peopleById.get(transaction.personId) ?? "") : "",
    courseId: transaction.courseId ?? "",
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
        people={people}
        courses={courses}
      />
    </>
  );
}
