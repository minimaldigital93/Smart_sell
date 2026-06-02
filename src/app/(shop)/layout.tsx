import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { ShopTopBar } from "@/components/shared/shop-top-bar";

export default function ShopLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <ShopTopBar />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-6 pt-2">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
