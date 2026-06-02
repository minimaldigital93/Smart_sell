"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white"
    >
      Print
    </button>
  );
}
