"use client";

import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/wishlist-store";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  // On the server / initial render before persist rehydrates, ids is [].
  // After hydration, Zustand re-renders this component with the persisted ids.
  const active = useWishlistStore((s) => s.ids.includes(productId));
  const toggle = useWishlistStore((s) => s.toggle);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(productId);
      }}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full bg-background/80 backdrop-blur transition-transform active:scale-95",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-4.5 w-4.5 transition-colors",
          active ? "fill-pink-500 text-pink-500" : "text-foreground",
        )}
        strokeWidth={1.8}
      />
    </button>
  );
}
