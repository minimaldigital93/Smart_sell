import { cn } from "@/lib/utils";

/**
 * Responsive page container. Centers content and grows the readable width as the
 * viewport widens, so the same page reads as a phone column on mobile and a full
 * workspace on desktop. Sizes intentionally cap out at the 1440px+ desktop tier.
 *
 * - `shop`  — storefront browsing canvas (phone column → multi-column grid).
 * - `app`   — admin / superadmin workspace (wide tables + dashboards).
 * - `wide`  — edge-to-edge dashboards that want maximum canvas.
 * - `prose` — single-column reading / form flows (checkout, account, details).
 * - `narrow`— centered cards (auth).
 */
export type ContainerSize = "shop" | "app" | "wide" | "prose" | "narrow";

const SIZE: Record<ContainerSize, string> = {
  shop: "max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl",
  app: "max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[88rem]",
  wide: "max-w-7xl 2xl:max-w-[96rem]",
  prose: "max-w-md md:max-w-2xl",
  narrow: "max-w-md",
};

export function Container({
  size = "shop",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { size?: ContainerSize }) {
  return (
    <div
      className={cn("mx-auto w-full px-4", SIZE[size], className)}
      {...props}
    >
      {children}
    </div>
  );
}
