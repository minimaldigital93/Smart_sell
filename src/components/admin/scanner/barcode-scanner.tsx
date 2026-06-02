"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Camera, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onDecoded: (text: string) => void;
  onCancel: () => void;
};

export function BarcodeScanner({ onDecoded, onCancel }: Props) {
  const id = useId().replace(/:/g, "");
  const targetId = `scanner-${id}`;
  const instance = useRef<Html5Qrcode | null>(null);
  const lastDecoded = useRef<{ text: string; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const Html5QrcodeMod = (await import("html5-qrcode")).Html5Qrcode;
        if (cancelled) return;
        const scanner = new Html5QrcodeMod(targetId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
        instance.current = scanner;

        await scanner.start(
          {
            facingMode: { ideal: "environment" },
          },
          {
            fps: 15,
            qrbox: (vw, vh) => {
              const width = Math.floor(Math.min(vw, vh) * 0.85);
              const height = Math.floor(width * 0.45);
              return { width, height };
            },
            disableFlip: false,
            videoConstraints: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              // @ts-expect-error iOS Safari honors focusMode even though TS lib lacks it
              focusMode: "continuous",
            },
          },
          (decoded) => {
            const text = decoded.trim();
            const now = Date.now();
            if (
              lastDecoded.current &&
              lastDecoded.current.text === text &&
              now - lastDecoded.current.at < 1500
            ) {
              return; // debounce: same code held in frame
            }
            lastDecoded.current = { text, at: now };
            try {
              navigator.vibrate?.(80);
            } catch {
              /* ignore on iOS */
            }
            onDecoded(text);
          },
          () => {
            // ignore per-frame decode misses
          },
        );

        if (cancelled) {
          await scanner.stop().catch(() => {});
          try {
            scanner.clear();
          } catch {
            /* noop */
          }
          return;
        }
        setStarting(false);
      } catch (err) {
        if (cancelled) return;
        console.error("[scanner]", err);
        setError(
          err instanceof Error
            ? err.message
            : "Could not access the camera.",
        );
        setStarting(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      const s = instance.current;
      instance.current = null;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [targetId, onDecoded]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white safe-pt safe-pb">
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <p className="text-sm font-medium uppercase tracking-wider">Scan</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close scanner"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div id={targetId} className="absolute inset-0" />
        <ScannerOverlay starting={starting} error={error} />
      </div>

      <div className="flex flex-col gap-3 px-5 pb-4 pt-3 text-center">
        {error ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        ) : (
          <p className="text-xs text-white/70">
            Hold the barcode steady inside the frame.
          </p>
        )}
      </div>
    </div>
  );
}

function ScannerOverlay({
  starting,
  error,
}: {
  starting: boolean;
  error: string | null;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className={cn(
          "relative aspect-[85/38] w-[85vw] max-w-[480px] rounded-3xl border-2 border-white/40 transition-opacity",
          starting && "opacity-50",
        )}
      >
        <div className="absolute -inset-px rounded-3xl ring-1 ring-white/10" />
        <ScanLine />
      </div>

      {starting && !error ? (
        <p className="absolute bottom-12 inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-1.5 text-xs">
          <Camera className="h-4 w-4" /> Starting camera…
        </p>
      ) : null}

      {error ? (
        <p className="absolute inset-x-6 bottom-12 rounded-2xl bg-destructive/90 px-4 py-3 text-center text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ScanLine() {
  return (
    <span
      aria-hidden
      className="absolute left-4 right-4 h-0.5 rounded-full bg-pink-400 shadow-[0_0_24px_4px_rgba(212,144,151,0.55)]"
      style={{
        top: 0,
        animation: "scanline 1.8s ease-in-out infinite alternate",
      }}
    >
      <style>{`
        @keyframes scanline {
          0%   { transform: translateY(8px); }
          100% { transform: translateY(calc(85vw * 38 / 85 - 16px)); }
        }
        @media (min-width: 600px) {
          @keyframes scanline {
            0%   { transform: translateY(8px); }
            100% { transform: translateY(calc(480px * 38 / 85 - 16px)); }
          }
        }
      `}</style>
    </span>
  );
}
