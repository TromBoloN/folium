import { Archive, ArchiveRestore, Pencil, Plus, Scale, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { setAccountArchived } from "@/features/finance/actions/accounts";
import { accountGlyph, IconBadge } from "@/features/finance/components/money-icon";
import { formatIdr } from "@/features/finance/lib/format-idr";
import { ensureFinanceDefaults, listAccounts } from "@/features/finance/queries";
import { ACCOUNT_TYPE_LABELS } from "@/features/finance/schemas";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Accounts") };
}

export default function AccountsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Accounts"
        description="Match each one to what your bank or e-wallet app shows. Archived accounts leave the pickers but keep their history."
        back={<BackLink href="/money">Money</BackLink>}
        action={
          <Button asChild size="sm">
            <Link href="/money/accounts/new">
              <Plus aria-hidden />
              <Tr k="Add account" />
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<ListSkeleton rows={4} label="Loading accounts" />}>
        <Accounts />
      </Suspense>
    </div>
  );
}

async function Accounts() {
  await requireUser();
  await ensureFinanceDefaults();
  const [accounts, t] = await Promise.all([listAccounts(), getT()]);
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {accounts.map((a, i) => (
        <li
          key={a.id}
          className={cn(
            "tile reveal relative flex flex-col gap-4 overflow-hidden p-4 pl-5",
            a.archived && "opacity-70",
          )}
          style={{ "--c": a.color, "--i": i } as React.CSSProperties}
        >
          <span aria-hidden className="money-accent absolute inset-y-0 left-0 w-1" />
          <div className="flex items-center gap-3">
            <IconBadge icon={accountGlyph(a)} color={a.color} size="lg" />
            <div className="flex min-w-0 flex-1 flex-col">
              <Link
                href={`/money/accounts/${a.id}`}
                className="truncate rounded-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
              >
                {a.name}
                {a.archived ? " (archived)" : ""}
              </Link>
              <span className="text-muted-foreground text-xs">{t(ACCOUNT_TYPE_LABELS[a.type])}</span>
            </div>
            <span className={cn("font-display font-medium text-xl tabular-nums", a.balance < 0n && "text-money-out")}>
              {formatIdr(a.balance)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-border-soft border-t pt-3">
            {!a.archived ? (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/money/accounts/${a.id}#reconcile`}>
                    <Scale aria-hidden />
                    {t("Match balance")}
                    <span className="sr-only">: {a.name}</span>
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/money/new?kind=adjustment&account=${a.id}`}>
                    <SlidersHorizontal aria-hidden />
                    Adjust<span className="sr-only"> {a.name}</span>
                  </Link>
                </Button>
              </>
            ) : null}
            <span className="ml-auto flex items-center gap-1">
              <Button asChild size="icon" variant="ghost">
                <Link href={`/money/accounts/${a.id}`} aria-label={t("Edit {name}", { name: a.name })}>
                  <Pencil aria-hidden />
                </Link>
              </Button>
              <ActionForm action={setAccountArchived} fields={{ id: a.id, archive: String(!a.archived) }}>
                <SubmitButton
                  size="icon"
                  variant="ghost"
                  aria-label={
                    a.archived ? t("Unarchive {name}", { name: a.name }) : t("Archive {name}", { name: a.name })
                  }
                >
                  {a.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
                </SubmitButton>
              </ActionForm>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
