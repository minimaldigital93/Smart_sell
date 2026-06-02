import { CartView } from "@/components/cart/cart-view";

export const metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>
      </header>
      <CartView />
    </div>
  );
}
