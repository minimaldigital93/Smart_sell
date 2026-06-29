"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { ShopCategory } from "@/types";
import {
  createCategoryAction,
  updateCategoryAction,
  type CategoryMutationResult,
} from "@/app/actions/categories";
import { DEFAULT_CATEGORY_COLOR } from "@/lib/categories";
import { IconPicker } from "./icon-picker";

const initial: CategoryMutationResult = { ok: true };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-primary-foreground inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium shadow-sm transition active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

const inputClass =
  "border-input bg-background focus:ring-ring h-11 w-full rounded-lg border px-3 focus:outline-none focus:ring-2";

export function CategoryForm({ category }: { category?: ShopCategory }) {
  const isEdit = Boolean(category);
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [color, setColor] = useState(category?.color ?? DEFAULT_CATEGORY_COLOR);

  const boundAction = isEdit
    ? (prev: CategoryMutationResult, fd: FormData) =>
        updateCategoryAction(category!.id, prev, fd)
    : createCategoryAction;
  const [state, action] = useActionState(boundAction, initial);

  return (
    <form action={action} className="space-y-5">
      {!state.ok && state.error ? (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Category name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          defaultValue={category?.name ?? ""}
          placeholder="e.g. Skincare"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Description{" "}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={category?.description ?? ""}
          className="border-input bg-background focus:ring-ring w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2"
        />
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">
          Icon <span className="text-muted-foreground">(optional)</span>
        </span>
        <IconPicker value={icon} onChange={setIcon} color={color} />
        <input type="hidden" name="icon" value={icon} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="color" className="mb-1 block text-sm font-medium">
            Color <span className="text-muted-foreground">(optional)</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              id="color"
              name="color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded-lg border border-input bg-background p-1"
            />
            <span className="font-mono text-sm text-muted-foreground">
              {color}
            </span>
          </div>
        </div>
        <div>
          <label
            htmlFor="displayOrder"
            className="mb-1 block text-sm font-medium"
          >
            Display order
          </label>
          <input
            id="displayOrder"
            name="displayOrder"
            type="number"
            min={0}
            step={1}
            defaultValue={category?.display_order ?? 0}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Lower numbers appear first.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={category?.is_active ?? true}
          className="h-4 w-4 rounded"
        />
        Active (visible in product dropdown &amp; storefront)
      </label>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton label={isEdit ? "Save changes" : "Create category"} />
        <Link
          href="/admin/settings/categories"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
