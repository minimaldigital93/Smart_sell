import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Store unavailable",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function StoreUnavailablePage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="bg-secondary text-secondary-foreground mb-6 flex h-16 w-16 items-center justify-center rounded-full text-2xl">
        ✦
      </div>
      <h1 className="text-foreground mb-2 text-2xl font-semibold tracking-tight">
        Store temporarily unavailable
      </h1>
      <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
        This shop is paused while its subscription is renewed. Please check back
        soon — the store owner can restore access from their billing page.
      </p>
    </main>
  );
}
