import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getCategory } from "@/services/categories";
import { CategoryForm } from "@/components/admin/categories/category-form";

export const metadata = { title: "Edit category" };

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const category = await getCategory(id);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="/admin/settings/categories"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Shop Categories
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit category
        </h1>
        <p className="text-sm text-muted-foreground">{category.name}</p>
      </header>
      <CategoryForm category={category} />
    </div>
  );
}
