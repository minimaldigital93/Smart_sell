import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Serif_Khmer } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import { SwipeNavigation } from "@/components/shared/swipe-navigation";
import { APP_TAGLINE } from "@/lib/constants";
import { getServerLocale } from "@/lib/i18n/server";
import { getStoreSettings } from "@/services/settings";
import { themeStyleVars } from "@/lib/theme/presets";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoKhmer = Noto_Serif_Khmer({
  variable: "--font-khmer",
  subsets: ["khmer"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  const name = settings.businessName;
  const tagline = settings.tagline || APP_TAGLINE;
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ),
    title: { default: `${name} — ${tagline}`, template: `%s · ${name}` },
    description:
      "Premium cosmetic store with smart inventory, barcode stock management, and KHQR checkout — built for Cambodia.",
    applicationName: name,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: name,
    },
    formatDetection: { telephone: false, date: false, address: false, email: false, url: false },
    icons: {
      icon: settings.logoUrl ?? "/icons/icon-192.png",
      apple: settings.logoUrl ?? "/icons/apple-touch-icon.png",
    },
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getStoreSettings();
  const locale = await getServerLocale(settings.defaultLocale);
  return (
    <html
      lang={locale}
      style={themeStyleVars(settings.theme)}
      className={`${geistSans.variable} ${geistMono.variable} ${notoKhmer.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col">
        <Providers
          initialLocale={locale}
          storeConfig={{
            currency: settings.currency,
            shippingFee: settings.shippingFee,
          }}
        >
          <SwipeNavigation />
          {children}
        </Providers>
      </body>
    </html>
  );
}
