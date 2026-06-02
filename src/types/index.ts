import type { Database } from "@/types/database";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

export type ProductInventory =
  Database["public"]["Tables"]["product_inventory"]["Row"];

export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];

export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderItemInsert =
  Database["public"]["Tables"]["order_items"]["Insert"];

export type InventoryMovement =
  Database["public"]["Tables"]["inventory_movements"]["Row"];

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type LoyaltyTransaction = Database["public"]["Tables"]["loyalty_transactions"]["Row"];

// Client-side cart item — distinct from DB order_items.
export type CartItem = {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
};

// Re-export enums via the constants module so app code has a single import path.
export type {
  UserRole,
  OrderStatus,
  PaymentMethod,
  CategorySlug,
} from "@/lib/constants";
