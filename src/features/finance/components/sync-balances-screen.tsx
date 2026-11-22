import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/features/auth/queries";
import { Tr } from "@/lib/i18n/client";
import { ensureFinanceDefaults, listAccounts } from "../queries";
import { SyncBalancesForm } from "./sync-balances-form";

export async function SyncBalancesScreen({ variant }: { variant: "page" | "sheet" }) {
  await requireUser();
  await ensureFinanceDefaults();
  const accounts = (await listAccounts())
    .filter((a) => !a.archived)
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      color: a.color,
      icon: a.icon,
      balance: a.balance.toString(),
    }));

  if (variant === "sheet") {
    return <SyncBalancesForm accounts={accounts} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/money">
        <Tr k="Money" />
      </BackLink>
      <PageHeader title="Sync balances" description="Match your accounts to your bank and wallet apps." />
      <SyncBalancesForm accounts={accounts} />
    </div>
  );
}
