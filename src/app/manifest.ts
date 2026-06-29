import type { MetadataRoute } from "next";
import { APP_TAGLINE } from "@/lib/constants";
import { getStoreSettings } from "@/services/settings";

/**
 * PWA manifest sourced from the admin's store settings so the installed
 * app (iPhone home screen + desktop install) shows the configured business
 * name and logo. Falls back to the bundled icon files when no logo is set.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getStoreSettings();
  const name = settings.businessName;
  const tagline = settings.tagline || APP_TAGLINE;

  // The manifest body is raw JSON Next does not rewrite, so when the app is
  // served under a sub-path we must prefix in-app URLs ourselves.
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  const bundledIcons: MetadataRoute.Manifest["icons"] = [
    { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
    { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    {
      src: `${base}/icons/icon-maskable.png`,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ];

  // When the admin uploads a logo, prefer it as the install icon. Its exact
  // dimensions are unknown, so advertise it as "any" and keep the bundled
  // icons as sized fallbacks for launchers that need specific resolutions.
  const icons: MetadataRoute.Manifest["icons"] = settings.logoUrl
    ? [{ src: settings.logoUrl, sizes: "any", purpose: "any" }, ...bundledIcons]
    : bundledIcons;

  return {
    name: `${name} — ${tagline}`,
    short_name: name,
    description:
      "Premium cosmetic store with smart inventory and barcode stock management.",
    start_url: `${base}/`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait",
    icons,
  };
}
