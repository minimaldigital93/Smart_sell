"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { productInputSchema } from "@/lib/products/schemas";
import { slugify } from "@/lib/products/barcode";

export type ProductActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function normalize(values: Record<string, unknown>) {
  // Convert "" to null on optional text fields
  const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
  return {
    ...values,
    description: empty(values.description),
    ingredients: empty(values.ingredients),
    barcode: empty(values.barcode),
    sku: empty(values.sku),
    slug: empty(values.slug),
    discount_price:
      values.discount_price === "" ||
      values.discount_price === undefined ||
      Number(values.discount_price) <= 0
        ? null
        : Number(values.discount_price),
  };
}

export async function createProductAction(input: unknown): Promise<ProductActionResult> {
  await requireStaff();
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = await createClient();

  const slug = v.slug && v.slug.length > 0 ? v.slug : slugify(v.name);
  const id = v.id ?? crypto.randomUUID();

  const payload = normalize({
    id,
    name: v.name,
    slug,
    description: v.description,
    ingredients: v.ingredients,
    price: v.price,
    discount_price: v.discount_price,
    category: v.category,
    images: v.images,
    barcode: v.barcode,
    sku: v.sku,
    featured: v.featured ?? false,
    is_active: v.is_active ?? true,
    stock: v.initial_stock,
  });

  const { error } = await supabase
    .from("products")
    .insert(payload as never);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Slug, SKU, or barcode already exists." };
    }
    console.error("[products.create]", error);
    return { ok: false, error: "Could not create product." };
  }

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { ok: true, id };
}

export async function updateProductAction(input: unknown): Promise<ProductActionResult> {
  await requireStaff();
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success || !parsed.data.id) {
    return { ok: false, error: parsed.success ? "Missing product id" : (parsed.error.issues[0]?.message ?? "Invalid input") };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const slug = v.slug && v.slug.length > 0 ? v.slug : slugify(v.name);

  const payload = normalize({
    name: v.name,
    slug,
    description: v.description,
    ingredients: v.ingredients,
    price: v.price,
    discount_price: v.discount_price,
    category: v.category,
    images: v.images,
    barcode: v.barcode,
    sku: v.sku,
    featured: v.featured ?? false,
    is_active: v.is_active ?? true,
  });

  const { error } = await supabase
    .from("products")
    .update(payload as never)
    .eq("id", v.id!);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Slug, SKU, or barcode already exists." };
    }
    console.error("[products.update]", error);
    return { ok: false, error: "Could not save changes." };
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${v.id}/edit`);
  revalidatePath(`/product/${slug}`);
  revalidatePath("/shop");
  return { ok: true, id: v.id! };
}

export async function deleteProductAction(id: string): Promise<ProductActionResult> {
  await requireStaff();
  if (!id) return { ok: false, error: "Missing id" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: false, featured: false })
    .eq("id", id);

  if (error) {
    console.error("[products.delete]", error);
    return { ok: false, error: "Could not deactivate product." };
  }

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { ok: true, id };
}

export async function hardDeleteProductAction(
  id: string,
): Promise<ProductActionResult> {
  await requireStaff();
  if (!id) return { ok: false, error: "Missing id" };

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    console.error("[products.hardDelete]", error);
    // Postgres FK violation — product is referenced by orders or movements.
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "Cannot delete: this product is referenced by existing orders or stock history. Deactivate it instead.",
      };
    }
    return { ok: false, error: "Could not delete product." };
  }

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { ok: true, id };
}

export async function restoreProductAction(id: string): Promise<ProductActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: true })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not restore." };
  revalidatePath("/admin/products");
  return { ok: true, id };
}

export async function redirectToAdminProducts(): Promise<void> {
  redirect("/admin/products");
}
