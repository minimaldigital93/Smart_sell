"use client";

import Image from "next/image";
import { useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/avif"];

export function ProductImageUpload({
  productId,
  images,
  onChange,
}: {
  productId: string;
  images: string[];
  onChange: (next: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    const supabase = createClient();
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is larger than 8 MB`);
        continue;
      }
      if (!ALLOWED.includes(file.type)) {
        toast.error(`${file.name} must be PNG, JPEG, WebP, or AVIF`);
        continue;
      }

      const ext = (file.name.split(".").pop() ?? "png").toLowerCase().slice(0, 4);
      const path = `${productId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (error) {
        toast.error(`Upload failed: ${file.name}`);
        continue;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(path);
      newUrls.push(publicUrl);
    }

    if (newUrls.length > 0) onChange([...images, ...newUrls]);
    setUploading(false);
  }

  function remove(url: string) {
    onChange(images.filter((u) => u !== url));
    // Best-effort delete from storage
    const supabase = createClient();
    const marker = "/product-images/";
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      const path = url.slice(idx + marker.length);
      supabase.storage.from("product-images").remove([path]).catch(() => {});
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((url) => (
          <div
            key={url}
            className="relative aspect-square overflow-hidden rounded-2xl bg-muted"
          >
            <Image
              src={url}
              alt=""
              fill
              sizes="(max-width:600px) 33vw, 160px"
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => remove(url)}
              aria-label="Remove image"
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-foreground/85 text-background hover:bg-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <label
          className={cn(
            "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-card text-xs text-muted-foreground transition-colors hover:bg-muted",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            multiple
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              <span>Add</span>
            </>
          )}
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        First image is the cover. PNG, JPEG, WebP, or AVIF · up to 8 MB each.
      </p>
    </div>
  );
}
