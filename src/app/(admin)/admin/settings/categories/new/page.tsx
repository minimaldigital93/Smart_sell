import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { CategoryForm } from "@/components/admin/categories/category-form";

export const metadata = { title: "New category" };

export default async function NewCategoryPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="/admin/settings/categories"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Shop Categories
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New category</h1>
      </header>
      <CategoryForm />
    </div>
  );
}
