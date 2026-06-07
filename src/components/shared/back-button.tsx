"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navigates to the previous page. Falls back to `fallbackHref` when there's no
 * in-app history to go back to (e.g. the page was opened directly or via a
 * fresh tab), so the button is never a dead end.
 */
export function BackButton({
  fallbackHref = "/",
  label = "Back",
  className,
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function goBack() {
    // history.length > 1 means there's a prior entry to return to.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label}
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-full pr-3 pl-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <ChevronLeft className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );
}
