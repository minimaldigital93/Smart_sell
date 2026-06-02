import { WishlistView } from "@/components/shop/wishlist-view";

export const metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Wishlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved to this device.
        </p>
      </header>
      <WishlistView />
    </div>
  );
}
