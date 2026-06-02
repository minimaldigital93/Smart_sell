"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;

export function ScreenshotUpload({
  name = "screenshot",
  onChange,
}: {
  name?: string;
  onChange?: (file: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0] ?? null;
    if (!file) {
      setPreview(null);
      onChange?.(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is larger than 5 MB.");
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
    onChange?.(file);
  }

  function clear() {
    if (ref.current) ref.current.value = "";
    setPreview(null);
    setError(null);
    onChange?.(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        className={cn(
          "flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-card text-sm text-muted-foreground transition-colors hover:bg-muted",
          preview && "border-solid",
        )}
      >
        <input
          ref={ref}
          type="file"
          name={name}
          accept="image/png,image/jpeg,image/webp,image/heic"
          required
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Selected screenshot preview"
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            <ImagePlus className="h-6 w-6" />
            Tap to upload payment screenshot
            <span className="text-xs text-muted-foreground/80">
              PNG, JPEG, WebP, HEIC · up to 5 MB
            </span>
          </span>
        )}
      </label>
      {preview ? (
        <button
          type="button"
          onClick={clear}
          className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <span className="inline-flex items-center gap-1">
            <X className="h-3.5 w-3.5" /> Remove
          </span>
        </button>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
