import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="bg-secondary text-secondary-foreground mb-6 flex h-16 w-16 items-center justify-center rounded-full text-2xl">
        ✦
      </div>
      <h1 className="text-foreground mb-2 text-2xl font-semibold tracking-tight">
        You&rsquo;re offline
      </h1>
      <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
        We couldn&rsquo;t reach the network. Recent pages you visited may still
        load from cache. Reconnect and try again.
      </p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground mt-8 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium shadow-sm transition active:scale-[0.98]"
      >
        Try home page
      </Link>
    </main>
  );
}
