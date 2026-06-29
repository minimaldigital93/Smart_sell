"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  deleteCategoryAction,
  toggleCategoryActiveAction,
} from "@/app/actions/categories";

type Props = {
  id: string;
  name: string;
  isActive: boolean;
};

export function CategoryActions({ id, name, isActive }: Props) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={`/admin/settings/categories/${id}/edit`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
        aria-label={`Edit ${name}`}
      >
        <Pencil className="h-4 w-4" />
      </Link>

      <button
        type="button"
        disabled={pending}
        aria-label={isActive ? `Disable ${name}` : `Enable ${name}`}
        title={isActive ? "Disable" : "Enable"}
        onClick={() =>
          start(async () => {
            const res = await toggleCategoryActiveAction(id, !isActive);
            if (!res.ok) toast.error(res.error);
            else toast.success(isActive ? "Disabled" : "Enabled");
          })
        }
        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-50"
      >
        {isActive ? (
          <Eye className="h-4 w-4" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <button
        type="button"
        disabled={pending}
        aria-label={`Delete ${name}`}
        onClick={() => {
          if (!confirm(`Delete category “${name}”?`)) return;
          start(async () => {
            const res = await deleteCategoryAction(id);
            if (!res.ok) toast.error(res.error);
            else toast.success(`Deleted ${name}`);
          });
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-destructive hover:bg-destructive/10 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
