import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/features/auth/queries";
import { setCategoryArchived } from "@/features/finance/actions/categories";
import { CategoryForm } from "@/features/finance/components/category-form";
import { type Category, ensureFinanceDefaults, listCategories } from "@/features/finance/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Money categories"
        description="Archived categories disappear from pickers but keep their history."
        back={<BackLink href="/settings">Settings</BackLink>}
      />
      <Suspense fallback={<ListSkeleton rows={4} label="Loading categories" />}>
        <Categories />
      </Suspense>
    </div>
  );
}

async function Categories() {
  await requireUser();
  await ensureFinanceDefaults();
  const categories = await listCategories();
  const parents = categories
    .filter((c) => !c.parentId && !c.archived)
    .map((c) => ({ id: c.id, name: c.name, kind: c.kind }));
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]">
      {(["expense", "income"] as const).map((kind) => (
        <section key={kind} aria-labelledby={`${kind}-h`} className="flex flex-col gap-3">
          <h2 id={`${kind}-h`} className="font-medium">
            {kind === "expense" ? "Expense" : "Income"}
          </h2>
          <CategoryTree categories={categories.filter((c) => c.kind === kind)} />
        </section>
      ))}
      <div className="tile p-5">
        <CategoryForm
          defaults={{ name: "", kind: "expense", parentId: "", color: "#495057", icon: "" }}
          parents={parents}
        />
      </div>
    </div>
  );
}

function CategoryTree({ categories }: { categories: Category[] }) {
  const top = categories.filter((c) => !c.parentId);
  return (
    <ul className="tile flex flex-col divide-y divide-border-soft overflow-hidden">
      {top
        .flatMap((parent) => [parent, ...categories.filter((c) => c.parentId === parent.id)])
        .map((c) => (
          <li
            key={c.id}
            className={cn(
              "flex items-center gap-2 py-2 pr-2",
              c.parentId ? "pl-10" : "pl-4",
              c.archived && "text-muted-foreground",
            )}
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full bg-(--c)"
              style={{ "--c": c.color } as React.CSSProperties}
            />
            <span className="min-w-0 flex-1 truncate text-sm">
              {c.name}
              {c.archived ? " (archived)" : ""}
            </span>
            <Button asChild size="icon" variant="ghost">
              <Link href={`/settings/categories/${c.id}`} aria-label={`Edit ${c.name}`}>
                <Pencil aria-hidden />
              </Link>
            </Button>
            <ActionForm action={setCategoryArchived} fields={{ id: c.id, archive: String(!c.archived) }}>
              <SubmitButton
                size="icon"
                variant="ghost"
                aria-label={c.archived ? `Unarchive ${c.name}` : `Archive ${c.name}`}
              >
                {c.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              </SubmitButton>
            </ActionForm>
          </li>
        ))}
    </ul>
  );
}
