import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-background shadow-soft">
        <ShoppingBag className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-base font-medium">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a few products and they’ll show up here.
        </p>
      </div>
      <Link href="/shop" className={cn(buttonVariants({ size: "md" }))}>
        Start shopping
      </Link>
    </div>
  );
}
