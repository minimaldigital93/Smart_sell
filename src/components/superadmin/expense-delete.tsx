"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExpense } from "@/app/actions/expenses";

export function ExpenseDelete({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await deleteExpense(id);
          if (res.ok) router.refresh();
          else alert(res.error ?? "Could not delete");
        })
      }
      className="text-muted-foreground hover:text-destructive text-xs disabled:opacity-50"
    >
      Remove
    </button>
  );
}
