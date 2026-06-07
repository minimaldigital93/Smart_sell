import { ShoppingBag } from "lucide-react";
import { CartView } from "@/components/cart/cart-view";
import { PageHero } from "@/components/shared/page-hero";

export const metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <PageHero
        icon={ShoppingBag}
        title="Your cart"
        subtitle="Review your items and check out"
      />
      <CartView />
    </div>
  );
}
