import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { ShopTopBar } from "@/components/shared/shop-top-bar";
import { Container } from "@/components/shared/container";

export default function ShopLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <ShopTopBar />
      <main className="flex-1">
        <Container size="shop" className="pb-6 pt-2 md:pb-10 md:pt-4">
          {children}
        </Container>
      </main>
      <MobileBottomNav />
    </div>
  );
}
