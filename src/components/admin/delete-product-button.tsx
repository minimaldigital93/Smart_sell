"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  deleteProductAction,
  restoreProductAction,
} from "@/app/actions/products";

export function DeleteProductButton({
  productId,
  isActive,
}: {
  productId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (isActive) {
      const sure = window.confirm(
        "Deactivate this product? It will be hidden from the storefront but order history is preserved.",
      );
      if (!sure) return;
    }

    startTransition(async () => {
      const action = isActive ? deleteProductAction : restoreProductAction;
      const result = await action(productId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "Deactivated" : "Restored");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={isActive ? "destructive" : "secondary"}
      size="md"
      onClick={onClick}
      disabled={pending}
    >
      <Trash2 className="h-4 w-4" />
      {isActive ? "Deactivate" : "Restore"}
    </Button>
  );
}
