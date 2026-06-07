// Hand-written types matching database/schema.sql (Phase 2).
// Regenerate from your live Supabase project once it's set up:
//   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRoleEnum = "admin" | "staff" | "customer";
export type ProductCategoryEnum =
  | "skincare"
  | "makeup"
  | "perfume"
  | "haircare"
  | "bodycare";
export type OrderStatusEnum =
  | "pending"
  | "payment_confirmed"
  | "preparing"
  | "shipping"
  | "delivered"
  | "cancelled";
export type PaymentMethodEnum = "khqr" | "aba" | "acleda" | "wing" | "cash";
export type MovementTypeEnum = "in" | "out" | "adjustment";
export type LoyaltyTransactionTypeEnum = "earn" | "redeem" | "expire" | "manual";
export type NotificationTypeEnum = "order" | "inventory" | "promo" | "system";
export type NotificationAudienceEnum = "all" | "staff";

type Timestamp = string;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRoleEnum;
          name: string | null;
          email: string | null;
          phone: string | null;
          loyalty_points: number;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          ingredients: string | null;
          price: number;
          discount_price: number | null;
          stock: number;
          category: ProductCategoryEnum;
          images: string[];
          barcode: string | null;
          sku: string | null;
          featured: boolean;
          is_active: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["products"]["Row"],
          "id" | "created_at" | "updated_at" | "stock"
        > & { id?: string; stock?: number };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [];
      };
      product_inventory: {
        Row: {
          id: string;
          product_id: string;
          current_stock: number;
          minimum_stock: number;
          barcode: string | null;
          sku: string | null;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["product_inventory"]["Row"],
          "id" | "updated_at"
        > & { id?: string };
        Update: Partial<
          Database["public"]["Tables"]["product_inventory"]["Row"]
        >;
        Relationships: [
          {
            foreignKeyName: "product_inventory_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          user_id: string | null;
          customer_name: string;
          phone: string;
          address: string;
          note: string | null;
          subtotal: number;
          shipping_fee: number;
          discount: number;
          total: number;
          payment_method: PaymentMethodEnum;
          payment_image: string | null;
          status: OrderStatusEnum;
          inventory_applied: boolean;
          coupon_id: string | null;
          coupon_code: string | null;
          points_redeemed: number;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["orders"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "inventory_applied"
          | "discount"
          | "coupon_id"
          | "coupon_code"
          | "points_redeemed"
        > & {
          id?: string;
          status?: OrderStatusEnum;
          discount?: number;
          coupon_id?: string | null;
          coupon_code?: string | null;
          points_redeemed?: number;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          discount_type: "percent" | "fixed";
          discount_value: number;
          min_subtotal: number;
          max_redemptions: number | null;
          redeemed_count: number;
          starts_at: Timestamp | null;
          expires_at: Timestamp | null;
          is_active: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["coupons"]["Row"],
          "id" | "created_at" | "updated_at" | "redeemed_count"
        > & { id?: string; redeemed_count?: number };
        Update: Partial<Database["public"]["Tables"]["coupons"]["Row"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          price: number;
          created_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["order_items"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movements: {
        Row: {
          id: string;
          product_id: string;
          barcode: string | null;
          movement_type: MovementTypeEnum;
          quantity: number;
          resulting_stock: number;
          order_id: string | null;
          created_by: string | null;
          notes: string | null;
          barcode_image_url: string | null;
          created_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["inventory_movements"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: Partial<
          Database["public"]["Tables"]["inventory_movements"]["Row"]
        >;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          message: string;
          type: NotificationTypeEnum;
          audience: NotificationAudienceEnum;
          metadata: Json;
          read_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["notifications"]["Row"],
          "id" | "created_at" | "metadata" | "read_at"
        > & { id?: string; metadata?: Json; read_at?: Timestamp | null };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      loyalty_transactions: {
        Row: {
          id: string;
          user_id: string;
          order_id: string | null;
          type: LoyaltyTransactionTypeEnum;
          points: number;
          balance_after: number;
          note: string | null;
          created_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["loyalty_transactions"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["loyalty_transactions"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      apply_inventory_movement: {
        Args: {
          p_product_id: string;
          p_movement: MovementTypeEnum;
          p_quantity: number;
          p_notes?: string | null;
          p_order_id?: string | null;
          p_created_by?: string | null;
          p_barcode_image_url?: string | null;
        };
        Returns: number;
      };
      apply_order_inventory: {
        Args: { p_order_id: string };
        Returns: null;
      };
      earn_loyalty_points: {
        Args: { p_user_id: string; p_order_id: string; p_total: number };
        Returns: number;
      };
      redeem_loyalty_points: {
        Args: { p_user_id: string; p_order_id: string; p_points: number };
        Returns: number;
      };
      redeem_coupon: {
        Args: { p_code: string };
        Returns: {
          id: string;
          code: string;
          redeemed_count: number;
          max_redemptions: number | null;
        }[];
      };
      create_customer_order: {
        Args: {
          p_order_id: string;
          p_customer_name: string;
          p_phone: string;
          p_address: string;
          p_note: string | null;
          p_payment_method: PaymentMethodEnum;
          p_payment_image: string | null;
          p_items: { product_id: string; quantity: number }[];
          p_coupon_code?: string | null;
          p_points?: number;
        };
        Returns: { order_id: string; total: number };
      };
      unredeem_coupon: {
        Args: { p_code: string };
        Returns: null;
      };
      refund_order_credits: {
        Args: { p_order_id: string };
        Returns: null;
      };
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_sec: number };
        Returns: {
          allowed: boolean;
          remaining?: number;
          retry_after?: number;
        };
      };
    };
    Enums: {
      user_role: UserRoleEnum;
      product_category: ProductCategoryEnum;
      order_status: OrderStatusEnum;
      payment_method: PaymentMethodEnum;
      movement_type: MovementTypeEnum;
      notification_type: NotificationTypeEnum;
      loyalty_transaction_type: LoyaltyTransactionTypeEnum;
    };
  };
};
