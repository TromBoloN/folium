import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { AccountForm } from "@/features/finance/components/account-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Add account") };
}

export default function NewAccountPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Add account" back={<BackLink href="/money/accounts">Accounts</BackLink>} />
      <AccountForm defaults={{ name: "", type: "ewallet", color: "#1971c2", icon: "", openingBalance: "" }} />
    </div>
  );
}
