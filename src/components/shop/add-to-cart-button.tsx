"use client";

import { ShoppingBag, Plus, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCartStore } from "@/store/cart-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  quantity?: number;
  disabled?: boolean;
  variant?: "icon" | "full";
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function AddToCartButton({
  productId,
  name,
  price,
  image,
  quantity = 1,
  disabled,
  variant = "icon",
  size = "md",
  className,
}: Props) {
  const add = useCartStore((s) => s.add);
  const [justAdded, setJustAdded] = useState(false);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    add({ productId, name, price, image, quantity });
    toast.success(`${name} added to cart`);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        aria-label={disabled ? "Out of stock" : `Add ${name} to cart`}
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform active:scale-95 disabled:opacity-40",
          className,
        )}
      >
        {justAdded ? (
          <Check className="h-[18px] w-[18px]" />
        ) : (
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.2} />
        )}
      </button>
    );
  }

  return (
    <Button
      type="button"
      onClick={handleAdd}
      disabled={disabled}
      size={size}
      className={cn("w-full", className)}
    >
      {justAdded ? (
        <>
          <Check className="h-5 w-5" />
          Added
        </>
      ) : (
        <>
          <ShoppingBag className="h-5 w-5" />
          {disabled ? "Out of stock" : "Add to cart"}
        </>
      )}
    </Button>
  );
}
