"use client";

import { useState } from "react";
import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";

export function ProductDetailActions({
  productId,
  name,
  price,
  image,
  maxStock,
  disabled,
}: {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  maxStock: number;
  disabled?: boolean;
}) {
  const [qty, setQty] = useState(1);

  return (
    <div className="flex items-stretch gap-3">
      <QuantityStepper
        value={qty}
        onChange={setQty}
        min={1}
        max={Math.max(1, maxStock)}
      />
      <AddToCartButton
        productId={productId}
        name={name}
        price={price}
        image={image}
        quantity={qty}
        disabled={disabled}
        variant="full"
        size="lg"
      />
    </div>
  );
}
