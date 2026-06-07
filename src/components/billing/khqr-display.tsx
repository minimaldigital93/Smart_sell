"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Render a KHQR payload string as a scannable QR image (generated locally). */
export function KhqrDisplay({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: 256, margin: 1 })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (!src) {
    return (
      <div className="bg-muted text-muted-foreground grid h-64 w-64 place-items-center rounded-xl text-sm">
        Generating QR…
      </div>
    );
  }

  return (
    // QR is a generated data-URL, not a remote asset — next/image adds no value.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="KHQR payment code"
      width={256}
      height={256}
      className="rounded-xl border"
    />
  );
}
