import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
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
import { ACCOUNT_ICONS } from "@/features/finance/components/money-overview";
import { formatIdr } from "@/features/finance/lib/format-idr";
import { ensureFinanceDefaults, listAccounts } from "@/features/finance/queries";
import { ACCOUNT_TYPE_LABELS } from "@/features/finance/schemas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Accounts" };

export default function AccountsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Accounts"
        description="Archived accounts disappear from pickers but keep their history."
        back={<BackLink href="/money">Money</BackLink>}
        action={
          <Button asChild size="sm">
            <Link href="/money/accounts/new">
              <Plus aria-hidden />
              Add account
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
  const accounts = await listAccounts();
  return (
    <ul className="tile flex flex-col divide-y divide-border-soft overflow-hidden">
      {accounts.map((a) => {
        const Icon = ACCOUNT_ICONS[a.type];
        return (
          <li
            key={a.id}
            className={cn("flex flex-wrap items-center gap-3 px-4 py-3", a.archived && "text-muted-foreground")}
          >
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--c)_22%,var(--surface-1))]"
              style={{ "--c": a.color } as React.CSSProperties}
            >
              <Icon className="size-4" />
            </span>
            <Link href={`/money/accounts/${a.id}`} className="flex min-w-0 flex-1 flex-col hover:underline">
              <span className="truncate font-medium">
                {a.name}
                {a.archived ? " (archived)" : ""}
              </span>
              <span className="text-muted-foreground text-xs">{ACCOUNT_TYPE_LABELS[a.type]}</span>
            </Link>
            <span className={cn("font-medium tabular-nums", a.balance < 0n && "text-destructive")}>
              {formatIdr(a.balance)}
            </span>
            <span className="flex items-center gap-1">
              <Button asChild size="icon" variant="ghost">
                <Link href={`/money/accounts/${a.id}`} aria-label={`Edit ${a.name}`}>
                  <Pencil aria-hidden />
                </Link>
              </Button>
              <ActionForm action={setAccountArchived} fields={{ id: a.id, archive: String(!a.archived) }}>
                <SubmitButton
                  size="icon"
                  variant="ghost"
                  aria-label={a.archived ? `Unarchive ${a.name}` : `Archive ${a.name}`}
                >
                  {a.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
                </SubmitButton>
              </ActionForm>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
