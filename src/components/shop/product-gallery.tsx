"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const list = images.length > 0 ? images : [];
  const [activeIdx, setActiveIdx] = useState(0);

  if (list.length === 0) {
    return (
      <div
        className="aspect-square w-full rounded-3xl bg-muted"
        aria-label="No product image"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-muted">
        <Image
          src={list[activeIdx]!}
          alt={alt}
          fill
          sizes="(max-width: 600px) 100vw, 480px"
          className="object-cover"
          priority
        />
      </div>

      {list.length > 1 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 no-scrollbar">
          {list.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActiveIdx(i)}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === activeIdx}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border transition-colors",
                i === activeIdx ? "border-primary" : "border-border",
              )}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
