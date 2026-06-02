"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/avif",
];

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  productId: string;
  disabled?: boolean;
};

export function BarcodeProofCapture({
  value,
  onChange,
  productId,
  disabled,
}: Props) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Image is larger than 5 MB.");
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      toast.error("Use PNG, JPEG, WebP, HEIC, or AVIF.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() ?? "jpg")
        .toLowerCase()
        .slice(0, 4);
      const path = `${productId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("movement-proofs")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) {
        console.error("[barcode-proof.upload]", error);
        toast.error("Upload failed. Please retry.");
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("movement-proofs").getPublicUrl(path);
      onChange(publicUrl);
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (libraryRef.current) libraryRef.current.value = "";
    }
  }

  function remove() {
    if (!value) return;
    const supabase = createClient();
    const marker = "/movement-proofs/";
    const idx = value.indexOf(marker);
    if (idx >= 0) {
      const path = value.slice(idx + marker.length);
      supabase.storage
        .from("movement-proofs")
        .remove([path])
        .catch(() => {});
    }
    onChange(null);
  }

  if (value) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Barcode photo
        </p>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted">
          <Image
            src={value}
            alt="Scanned barcode photo"
            fill
            sizes="(max-width: 600px) 100vw, 480px"
            className="object-cover"
          />
          <button
            type="button"
            onClick={remove}
            aria-label="Remove photo"
            disabled={disabled}
            className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-foreground/85 text-background shadow-soft hover:bg-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Barcode photo · required
      </p>
      <div
        className={cn(
          "grid grid-cols-2 gap-2",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => cameraRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => libraryRef.current?.click()}
          disabled={disabled || uploading}
        >
          <ImagePlus className="h-5 w-5" />
          From library
        </Button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/avif"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <p className="text-xs text-muted-foreground">
        Attach a clear shot of the scanned barcode. Up to 5 MB.
      </p>
    </div>
  );
}
