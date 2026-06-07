import { createClient } from "@/lib/supabase/server";
import type { ProductCategoryEnum } from "@/types/database";

export type DashboardSummary = {
  total_orders: number;
  pending_orders: number;
  active_orders: number;
  total_revenue: number;
  low_stock_count: number;
  out_of_stock_count: number;
  active_products: number;
};

export type SalesDay = { day: string; orders: number; revenue: number };

export type LowStockRow = {
  product_id: string;
  name: string;
  slug: string;
  category: ProductCategoryEnum;
  current_stock: number;
  minimum_stock: number;
  is_out_of_stock: boolean;
};

const EMPTY_SUMMARY: DashboardSummary = {
  total_orders: 0,
  pending_orders: 0,
  active_orders: 0,
  total_revenue: 0,
  low_stock_count: 0,
  out_of_stock_count: 0,
  active_products: 0,
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_admin_dashboard" as never)
    .select("*")
    .maybeSingle<DashboardSummary>();

  if (error) {
    console.error("[admin.summary]", error);
    return EMPTY_SUMMARY;
  }
  return data ?? EMPTY_SUMMARY;
}

export async function getSalesByDay(days = 14): Promise<SalesDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_sales_by_day" as never)
    .select("*")
    .order("day", { ascending: false })
    .limit(days)
    .returns<SalesDay[]>();

  if (error) {
    console.error("[admin.salesByDay]", error);
    return [];
  }
  // We queried desc to use LIMIT; flip back to chronological for the chart.
  return (data ?? []).slice().reverse();
}

export async function getLowStock(limit = 5): Promise<LowStockRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_low_stock_products" as never)
    .select("*")
    .limit(limit)
    .returns<LowStockRow[]>();

  if (error) {
    console.error("[admin.lowStock]", error);
    return [];
  }
  return data ?? [];
}
