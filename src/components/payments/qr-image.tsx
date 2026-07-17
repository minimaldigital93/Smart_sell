"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Render a KHQR payload string as a scannable QR image (generated locally). */
export function QrImage({ value, size = 256 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className="bg-muted text-muted-foreground grid place-items-center rounded-xl text-sm"
        style={{ width: size, height: size }}
      >
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
      width={size}
      height={size}
      className="rounded-xl border"
    />
  );
}
