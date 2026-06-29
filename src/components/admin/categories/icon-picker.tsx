"use client";

import { CATEGORY_ICONS, CATEGORY_ICON_NAMES } from "@/lib/categories";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  color?: string;
};

/** Grid of curated Lucide icons; click toggles selection. Controlled. */
export function IconPicker({ value, onChange, color }: Props) {
  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
      {CATEGORY_ICON_NAMES.map((name) => {
        const Icon = CATEGORY_ICONS[name];
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            aria-label={name}
            aria-pressed={selected}
            title={name}
            onClick={() => onChange(selected ? "" : name)}
            className={cn(
              "grid aspect-square place-items-center rounded-xl border transition active:scale-[0.97]",
              selected
                ? "border-foreground bg-foreground/5 ring-2 ring-ring/30"
                : "border-input bg-card hover:bg-muted",
            )}
          >
            <Icon
              className="h-5 w-5"
              style={selected && color ? { color } : undefined}
            />
          </button>
        );
      })}
    </div>
  );
}
