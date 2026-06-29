"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { getCurrentStoreId } from "@/lib/tenant/context";
import { categoryFormSchema } from "@/lib/categories/schemas";
import { slugify } from "@/lib/products/barcode";
import { countProductsInCategory } from "@/services/categories";

export type CategoryMutationResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const DUP_MESSAGE = "A category with this name already exists.";
const IN_USE_MESSAGE =
  "This category is currently assigned to products. Please move or delete those products before deleting this category.";

function revalidate() {
  revalidatePath("/admin/settings/categories");
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/shop");
}

function parseForm(formData: FormData) {
  return categoryFormSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    icon: String(formData.get("icon") ?? ""),
    color: String(formData.get("color") ?? ""),
    displayOrder: formData.get("displayOrder") ?? 0,
    isActive: formData.get("isActive") === "on",
  });
}

export async function createCategoryAction(
  _prev: CategoryMutationResult,
  formData: FormData,
): Promise<CategoryMutationResult> {
  const { user } = await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("shop_categories")
    .insert({
      ...(storeId ? { store_id: storeId } : {}),
      name: v.name,
      slug: slugify(v.name),
      description: v.description || null,
      icon: v.icon || null,
      color: v.color || null,
      display_order: v.displayOrder,
      is_active: v.isActive,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: DUP_MESSAGE };
    console.error("[categories.create]", error);
    return { ok: false, error: "Could not create category." };
  }
  revalidate();
  redirect("/admin/settings/categories");
}

export async function updateCategoryAction(
  id: string,
  _prev: CategoryMutationResult,
  formData: FormData,
): Promise<CategoryMutationResult> {
  const { user } = await requireAdmin();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("shop_categories")
    .update({
      name: v.name,
      slug: slugify(v.name),
      description: v.description || null,
      icon: v.icon || null,
      color: v.color || null,
      display_order: v.displayOrder,
      is_active: v.isActive,
      updated_by: user.id,
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    if (error.code === "23505") return { ok: false, error: DUP_MESSAGE };
    console.error("[categories.update]", error);
    return { ok: false, error: "Could not update category." };
  }
  revalidate();
  redirect("/admin/settings/categories");
}

export async function toggleCategoryActiveAction(
  id: string,
  isActive: boolean,
): Promise<CategoryMutationResult> {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("shop_categories")
    .update({ is_active: isActive, updated_by: user.id })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) {
    console.error("[categories.toggle]", error);
    return { ok: false, error: "Could not update status." };
  }
  revalidate();
  return { ok: true, id };
}

export async function deleteCategoryAction(
  id: string,
): Promise<CategoryMutationResult> {
  const { user } = await requireAdmin();

  // Never orphan products: block deletion while any product references it.
  const inUse = await countProductsInCategory(id);
  if (inUse > 0) return { ok: false, error: IN_USE_MESSAGE };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shop_categories")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      updated_by: user.id,
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    console.error("[categories.delete]", error);
    return { ok: false, error: "Could not delete category." };
  }
  revalidate();
  return { ok: true, id };
}
