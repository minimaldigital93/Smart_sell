import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistSans as geistSans } from "geist/font/sans";
import { GeistMono as geistMono } from "geist/font/mono";
import { Providers } from "@/components/shared/providers";
import { SwipeNavigation } from "@/components/shared/swipe-navigation";
import { APP_TAGLINE } from "@/lib/constants";
import { getServerLocale } from "@/lib/i18n/server";
import { getStoreSettings } from "@/services/settings";
import { themeStyleVars } from "@/lib/theme/presets";
import "./globals.css";

// Self-hosted (not next/font/google): this network's route to Google Fonts is
// unreliable at build time, and Next 16's Turbopack build doesn't respect the
// NODE_OPTIONS=--dns-result-order=ipv4first workaround (it does its own
// fetching outside Node's DNS resolver), so a flaky/blocked connection to
// fonts.googleapis.com now hard-fails the production build instead of just
// being slow. `geist` ships Geist/Geist Mono as local font files; Noto Serif
// Khmer is vendored under ./fonts (khmer-subset woff2, weights 400/500/600).
const notoKhmer = localFont({
  variable: "--font-khmer",
  display: "swap",
  src: [
    { path: "./fonts/noto-serif-khmer/NotoSerifKhmer-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/noto-serif-khmer/NotoSerifKhmer-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/noto-serif-khmer/NotoSerifKhmer-600.woff2", weight: "600", style: "normal" },
  ],
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
