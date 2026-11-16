import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/skeletons";
import { requireUser } from "@/features/auth/queries";
import { CategoryForm } from "@/features/finance/components/category-form";
import { listCategories } from "@/features/finance/queries";

export const metadata: Metadata = { title: "Edit category" };

export default function EditCategoryPage({ params }: PageProps<"/settings/categories/[id]">) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <PageHeader title="Edit category" back={<BackLink href="/settings/categories">Categories</BackLink>} />
      <Suspense fallback={<FormSkeleton />}>
        <Edit params={params} />
      </Suspense>
    </div>
  );
}

async function Edit({ params }: Pick<PageProps<"/settings/categories/[id]">, "params">) {
  await requireUser();
  const { id } = await params;
  const categories = await listCategories();
  const category = categories.find((c) => c.id === id);
  if (!category) notFound();
  const hasChildren = categories.some((c) => c.parentId === id);
  // A category with subcategories stays top level (one level of nesting).
  const parents = hasChildren
    ? []
    : categories
        .filter((c) => !c.parentId && !c.archived && c.id !== id)
        .map((c) => ({ id: c.id, name: c.name, kind: c.kind }));
  return (
    <CategoryForm
      defaults={{
        id: category.id,
        name: category.name,
        kind: category.kind,
        parentId: category.parentId ?? "",
        color: category.color,
      }}
      parents={parents}
    />
  );
}
