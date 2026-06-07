import { Heart } from "lucide-react";
import { WishlistView } from "@/components/shop/wishlist-view";
import { PageHero } from "@/components/shared/page-hero";

export const metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <PageHero
        icon={Heart}
        title="Wishlist"
        subtitle="Your saved favorites, kept on this device"
      />
      <WishlistView />
    </div>
  );
}
