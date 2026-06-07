import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Serif_Khmer } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: `${APP_NAME} — ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description:
    "Premium cosmetic store with smart inventory, barcode stock management, and KHQR checkout — built for Cambodia.",
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: { telephone: false, date: false, address: false, email: false, url: false },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

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
          {children}
        </Providers>
      </body>
    </html>
  );
}
