import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    ).hostname;
  } catch {
    return "placeholder.supabase.co";
  }
})();

const isProd = process.env.NODE_ENV === "production";

// When the app is served under a sub-path (e.g. minimaldigital.dev/smart_sell)
// set NEXT_PUBLIC_BASE_PATH=/smart_sell. Empty/unset = served at the host root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const csp = [
  "default-src 'self'",
  // Next.js needs eval'd inline scripts for hydration; Tailwind v4 injects
  // styles inline. We accept 'unsafe-inline' for those. To upgrade to a
  // strict CSP later, generate per-request nonces in the proxy.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // Camera scanner reads frames as blob URLs; images can come from any HTTPS.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Supabase REST + Storage + Realtime websocket
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const baseHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
];

if (isProd) {
  baseHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  basePath,
  reactStrictMode: true,
  allowedDevOrigins: ["10.10.10.198", "192.168.0.12", "*.local"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    qualities: [50, 75, 90],
  },
  experimental: {
    // Server Actions cap request bodies at 1 MB by default, which rejected
    // logo uploads (allowed up to 2 MB) before the action ran. Give headroom.
    serverActions: {
      bodySizeLimit: "4mb",
    },
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "date-fns",
      "@tanstack/react-query",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: baseHeaders,
      },
      {
        // Service worker must be served with the right scope + no caching.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
