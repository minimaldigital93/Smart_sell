import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-12 w-full rounded-2xl border border-input bg-background px-4 text-[15px]",
      "placeholder:text-muted-foreground/70",
      "focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
