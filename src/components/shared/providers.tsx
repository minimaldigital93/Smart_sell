"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";
import { StoreHydrator } from "@/components/shared/store-hydrator";
import { RouteLoader } from "@/components/shared/route-loader";

export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <StoreHydrator />
      <Suspense fallback={null}>
        <RouteLoader />
      </Suspense>
      <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: {
            borderRadius: "1rem",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-popover)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
