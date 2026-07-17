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

export type UserRoleEnum = "superadmin" | "admin" | "staff" | "customer";
export type StoreStatusEnum =
  | "active"
  | "grace"
  | "locked"
  | "cancelled";
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
export type OrderPaymentStatusEnum =
  | "pending"
  | "qr_generated"
  | "waiting_payment"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "rejected";
export type MovementTypeEnum = "in" | "out" | "adjustment";
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
          store_id: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          slug: string;
          name: string;
          owner_id: string | null;
          custom_domain: string | null;
          domain_verified: boolean;
          status: StoreStatusEnum;
          plan_id: string | null;
          trial_ends_at: Timestamp | null;
          current_period_end: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          owner_id?: string | null;
          custom_domain?: string | null;
          domain_verified?: boolean;
          status?: StoreStatusEnum;
          plan_id?: string | null;
          trial_ends_at?: Timestamp | null;
          current_period_end?: Timestamp | null;
        };
        Update: Partial<Database["public"]["Tables"]["stores"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          slug: string;
          description: string | null;
          ingredients: string | null;
          price: number;
          discount_price: number | null;
          stock: number;
          category: ProductCategoryEnum | null;
          category_id: string;
          images: string[];
          barcode: string | null;
          sku: string | null;
          featured: boolean;
          on_sale: boolean;
          new_arrival: boolean;
          is_active: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["products"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "stock"
          | "store_id"
          | "category"
        > & {
          id?: string;
          stock?: number;
          store_id?: string;
          category?: ProductCategoryEnum | null;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "shop_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_categories: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          color: string | null;
          display_order: number;
          is_active: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
          deleted_at: Timestamp | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["shop_categories"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "store_id"
          | "created_by"
          | "updated_by"
          | "deleted_at"
        > & {
          id?: string;
          store_id?: string;
          created_by?: string | null;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["shop_categories"]["Row"]
        >;
        Relationships: [
          {
            foreignKeyName: "shop_categories_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      product_inventory: {
        Row: {
          id: string;
          store_id: string;
          product_id: string;
          current_stock: number;
          minimum_stock: number;
          barcode: string | null;
          sku: string | null;
          updated_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["product_inventory"]["Row"],
          "id" | "updated_at" | "store_id"
        > & { id?: string; store_id?: string };
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
          store_id: string;
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
          | "store_id"
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
          store_id?: string;
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
          store_id: string;
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
          "id" | "created_at" | "updated_at" | "redeemed_count" | "store_id"
        > & { id?: string; redeemed_count?: number; store_id?: string };
        Update: Partial<Database["public"]["Tables"]["coupons"]["Row"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          store_id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          price: number;
          created_at: Timestamp;
        };
        Insert: Omit<
          Database["public"]["Tables"]["order_items"]["Row"],
          "id" | "created_at" | "store_id"
        > & { id?: string; store_id?: string };
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
          store_id: string;
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
          "id" | "created_at" | "store_id"
        > & { id?: string; store_id?: string };
        Update: Partial<
          Database["public"]["Tables"]["inventory_movements"]["Row"]
        >;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          store_id: string | null;
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
          "id" | "created_at" | "metadata" | "read_at" | "store_id"
        > & {
          id?: string;
          metadata?: Json;
          read_at?: Timestamp | null;
          store_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      store_settings: {
        Row: {
          id: number | null;
          store_id: string;
          business_name: string;
          tagline: string;
          logo_url: string | null;
          theme: string;
          default_locale: "en" | "km";
          currency: string;
          shipping_fee: number;
          contact_phone: string | null;
          contact_address: string | null;
          updated_at: Timestamp;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["store_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["store_settings"]["Row"]>;
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          id: string;
          code: string;
          name: string;
          price_usd: number;
          interval: "month" | "year";
          features: Json;
          limits: Json;
          sort: number;
          is_active: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          price_usd: number;
          interval?: "month" | "year";
          features?: Json;
          limits?: Json;
          sort?: number;
          is_active?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["subscription_plans"]["Row"]
        >;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          store_id: string;
          plan_id: string | null;
          status: "active" | "past_due" | "canceled";
          current_period_start: Timestamp | null;
          current_period_end: Timestamp | null;
          trial_ends_at: Timestamp | null;
          cancel_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          store_id: string;
          plan_id?: string | null;
          status?: "active" | "past_due" | "canceled";
          current_period_start?: Timestamp | null;
          current_period_end?: Timestamp | null;
          trial_ends_at?: Timestamp | null;
          cancel_at?: Timestamp | null;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "subscriptions_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_payments: {
        Row: {
          id: string;
          store_id: string;
          plan_id: string | null;
          amount_usd: number;
          method: "khqr" | "manual";
          bill_number: string | null;
          bakong_md5: string | null;
          bakong_txn_ref: string | null;
          status: OrderPaymentStatusEnum;
          proof_url: string | null;
          transaction_id: string | null;
          public_token: string | null;
          provider_ref: string | null;
          checkout_url: string | null;
          qr_payload: string | null;
          expires_at: Timestamp | null;
          last_checked_at: Timestamp | null;
          paid_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          store_id: string;
          plan_id?: string | null;
          amount_usd: number;
          method?: "khqr" | "manual";
          bill_number?: string | null;
          bakong_md5?: string | null;
          bakong_txn_ref?: string | null;
          status?: OrderPaymentStatusEnum;
          proof_url?: string | null;
          transaction_id?: string | null;
          public_token?: string | null;
          provider_ref?: string | null;
          checkout_url?: string | null;
          qr_payload?: string | null;
          expires_at?: Timestamp | null;
          last_checked_at?: Timestamp | null;
          paid_at?: Timestamp | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["subscription_payments"]["Row"]
        >;
        Relationships: [
          {
            foreignKeyName: "subscription_payments_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_payment_settings: {
        Row: {
          store_id: string;
          khqrpay_enabled: boolean;
          khqrpay_profile_id: string | null;
          khqrpay_secret: string | null;
          currency: "USD" | "KHR";
          updated_at: Timestamp;
          updated_by: string | null;
        };
        Insert: {
          store_id: string;
          khqrpay_enabled?: boolean;
          khqrpay_profile_id?: string | null;
          khqrpay_secret?: string | null;
          currency?: "USD" | "KHR";
          updated_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["store_payment_settings"]["Row"]
        >;
        Relationships: [];
      };
      order_payments: {
        Row: {
          id: string;
          store_id: string;
          order_id: string;
          method: PaymentMethodEnum;
          status: OrderPaymentStatusEnum;
          amount: number;
          currency: string;
          transaction_id: string | null;
          public_token: string;
          provider: string | null;
          provider_ref: string | null;
          checkout_url: string | null;
          qr_payload: string | null;
          expires_at: Timestamp | null;
          last_checked_at: Timestamp | null;
          paid_at: Timestamp | null;
          received_by: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          store_id: string;
          order_id: string;
          method: PaymentMethodEnum;
          status?: OrderPaymentStatusEnum;
          amount: number;
          currency?: string;
          transaction_id?: string | null;
          public_token?: string;
          provider?: string | null;
          provider_ref?: string | null;
          checkout_url?: string | null;
          qr_payload?: string | null;
          expires_at?: Timestamp | null;
          last_checked_at?: Timestamp | null;
          paid_at?: Timestamp | null;
          received_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["order_payments"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_webhooks: {
        Row: {
          id: string;
          provider: string;
          event_id: string;
          transaction_id: string | null;
          order_payment_id: string | null;
          subscription_payment_id: string | null;
          status: "received" | "processed" | "duplicate" | "invalid" | "ignored";
          signature_valid: boolean;
          http_status: number | null;
          payload: Json;
          error: string | null;
          received_at: Timestamp;
          processed_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          provider?: string;
          event_id: string;
          transaction_id?: string | null;
          order_payment_id?: string | null;
          subscription_payment_id?: string | null;
          status?: "received" | "processed" | "duplicate" | "invalid" | "ignored";
          signature_valid?: boolean;
          http_status?: number | null;
          payload?: Json;
          error?: string | null;
          processed_at?: Timestamp | null;
        };
        Update: Partial<Database["public"]["Tables"]["payment_webhooks"]["Row"]>;
        Relationships: [];
      };
      platform_expenses: {
        Row: {
          id: string;
          category: "hosting" | "server" | "other";
          label: string;
          amount_usd: number;
          incurred_on: string;
          note: string | null;
          created_by: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          category?: "hosting" | "server" | "other";
          label: string;
          amount_usd: number;
          incurred_on?: string;
          note?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["platform_expenses"]["Row"]
        >;
        Relationships: [];
      };
    };
    Views: {
      v_admin_dashboard: {
        Row: {
          total_orders: number;
          pending_orders: number;
          active_orders: number;
          total_revenue: number;
          low_stock_count: number;
          out_of_stock_count: number;
          active_products: number;
          total_units: number;
        };
        Relationships: [];
      };
      v_sales_by_day: {
        Row: {
          day: string;
          orders: number;
          revenue: number;
        };
        Relationships: [];
      };
      v_low_stock_products: {
        Row: {
          product_id: string;
          name: string;
          slug: string;
          category: ProductCategoryEnum | null;
          current_stock: number;
          minimum_stock: number;
          is_out_of_stock: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_superadmin: { Args: Record<string, never>; Returns: boolean };
      current_store_id: { Args: Record<string, never>; Returns: string | null };
      default_store_id: { Args: Record<string, never>; Returns: string };
      store_access_status: { Args: { p_store: string }; Returns: StoreStatusEnum };
      resolve_store: {
        Args: { p_host: string | null; p_slug: string | null };
        Returns: { id: string; slug: string; status: StoreStatusEnum }[];
      };
      start_store_trial: {
        Args: { p_store: string; p_plan_code: string };
        Returns: null;
      };
      activate_subscription: {
        Args: { p_payment: string };
        Returns: Timestamp;
      };
      platform_pnl_monthly: {
        Args: { p_year: number };
        Returns: {
          month: number;
          revenue: number;
          expense: number;
          net: number;
        }[];
      };
      platform_pnl_yearly: {
        Args: Record<string, never>;
        Returns: {
          year: number;
          revenue: number;
          expense: number;
          net: number;
        }[];
      };
      platform_summary: {
        Args: Record<string, never>;
        Returns: {
          mrr: number;
          active_stores: number;
          total_stores: number;
          overdue_stores: number;
          total_revenue: number;
          total_expense: number;
          month_revenue: number;
          month_expense: number;
        }[];
      };
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
      create_customer_order: {
        Args: {
          p_order_id: string;
          p_customer_name: string;
          p_phone: string;
          p_address: string;
          p_note: string | null;
          p_payment_method: PaymentMethodEnum;
          p_items: { product_id: string; quantity: number }[];
          p_coupon_code?: string | null;
          p_store_id?: string | null;
          p_payment_image?: string | null;
        };
        Returns: { order_id: string; total: number };
      };
      refund_order_credits: {
        Args: { p_order_id: string };
        Returns: null;
      };
      store_khqr_configured: {
        Args: { p_store: string };
        Returns: boolean;
      };
      finalize_order_payment: {
        Args: { p_id: string };
        Returns: string;
      };
      mark_order_payment_waiting: {
        Args: { p_id: string };
        Returns: null;
      };
      expire_order_payment: {
        Args: { p_id: string };
        Returns: boolean;
      };
      retire_open_order_payments: {
        Args: { p_order: string };
        Returns: null;
      };
      mark_cash_order_payment_paid: {
        Args: { p_id: string; p_cashier: string };
        Returns: string;
      };
      finalize_subscription_payment: {
        Args: { p_payment: string };
        Returns: Timestamp;
      };
      retire_open_subscription_payments: {
        Args: { p_store: string };
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
    };
  };
};
