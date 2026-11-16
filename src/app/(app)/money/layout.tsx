import { Suspense } from "react";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { requireUser } from "@/features/auth/queries";
import { getQuickMoneyContext } from "@/features/finance/actions/transactions";
import { MoneyChrome } from "@/features/finance/components/money-chrome";
import { QuickAddSkeleton } from "@/features/finance/components/money-skeletons";
import { QuickAddBar } from "@/features/finance/components/quick-add-bar";
import { ensureFinanceDefaults } from "@/features/finance/queries";

/** Every /money/* page: one header, a tab bar, and the quick-add bar that works from any tab. */
export default function MoneyLayout({ children }: LayoutProps<"/money">) {
  return (
    <MoneyChrome
      quick={
        <SectionErrorBoundary label="Quick add">
          <Suspense fallback={<QuickAddSkeleton />}>
            <Quick />
          </Suspense>
        </SectionErrorBoundary>
      }
    >
      {children}
    </MoneyChrome>
  );
}

async function Quick() {
  await requireUser();
  await ensureFinanceDefaults();
  const context = await getQuickMoneyContext();
  if (!context.ok) throw new Error(context.error);
  return <QuickAddBar context={context.data} />;
}
