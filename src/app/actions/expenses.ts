"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSuperadmin } from "@/lib/auth/session";

export type ExpenseState = { ok: boolean; error?: string; message?: string };

const expenseSchema = z.object({
  category: z.enum(["hosting", "server", "other"]),
  label: z.string().trim().min(1, "Label is required").max(80),
  amount_usd: z.coerce.number().min(0, "Must be 0 or more").max(1_000_000),
  incurred_on: z.string().optional(),
  note: z.string().trim().max(300).optional().default(""),
});

export async function addExpense(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const { user } = await requireSuperadmin();

  const parsed = expenseSchema.safeParse({
    category: formData.get("category"),
    label: formData.get("label"),
    amount_usd: formData.get("amount_usd"),
    incurred_on: formData.get("incurred_on") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("platform_expenses").insert({
    category: parsed.data.category,
    label: parsed.data.label,
    amount_usd: parsed.data.amount_usd,
    incurred_on: parsed.data.incurred_on || undefined,
    note: parsed.data.note || null,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/superadmin/finance");
  revalidatePath("/superadmin");
  return { ok: true, message: "Expense added." };
}

export async function deleteExpense(id: string): Promise<ExpenseState> {
  await requireSuperadmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_expenses")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/superadmin/finance");
  revalidatePath("/superadmin");
  return { ok: true, message: "Expense removed." };
}
