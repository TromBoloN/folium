import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { RuleForm } from "@/features/finance/components/rule-form";
import { RULE_TEMPLATES, ruleTemplate } from "@/features/finance/lib/rule-templates";
import { ensureFinanceDefaults, lastUsedAccountId, listAccounts, listCategories } from "@/features/finance/queries";
import { moneyToday } from "@/features/finance/queries/today";
import { getI18n, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Add recurring") };
}

/** ?template=subscription|kos|ukt|data|service|allowance|sinking prefills the form. */
export default function NewRulePage({ searchParams }: PageProps<"/money/recurring/new">) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Suspense fallback={<FormSkeleton label="Loading" />}>
        <New searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function New({ searchParams }: Pick<PageProps<"/money/recurring/new">, "searchParams">) {
  await requireUser();
  await ensureFinanceDefaults();
  const [{ template }, accounts, categories, { today }, { t, tl }] = await Promise.all([
    searchParams,
    listAccounts(),
    listCategories(),
    moneyToday(),
    getI18n(),
  ]);
  const active = accounts.filter((a) => !a.archived);
  const live = categories.filter((c) => !c.archived);
  const key = typeof template === "string" ? template : undefined;
  const preset = ruleTemplate(key, {
    today,
    expense: live.filter((c) => c.kind === "expense"),
    income: live.filter((c) => c.kind === "income"),
    savings: active.filter((a) => a.type === "savings"),
  });
  const label = RULE_TEMPLATES.find((x) => x.key === key)?.label;
  return (
    <>
      <PageHeader
        title={label ? t("Add: {name}", { name: t(label) }) : t("Add recurring")}
        back={<BackLink href="/money/recurring">Recurring</BackLink>}
      />
      <RuleForm
        defaults={{
          ...preset,
          // Template names ("Kos", "Allowance") are prefills: shown in the user's language.
          name: tl(preset.name),
          accountId: (await lastUsedAccountId(accounts)) ?? "",
          payee: "",
          endsOn: "",
        }}
        accounts={active.map((a) => ({ id: a.id, name: a.name }))}
        categories={live.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
      />
    </>
  );
}
