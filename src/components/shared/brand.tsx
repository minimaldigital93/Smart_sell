import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Renders the store's logo (when set) and/or business name. Presentational —
 * callers pass branding read from {@link getStoreSettings}.
 */
export function Brand({
  businessName,
  logoUrl,
  className,
  textClassName,
  showName = true,
}: {
  businessName: string;
  logoUrl: string | null;
  className?: string;
  textClassName?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={businessName}
          width={28}
          height={28}
          unoptimized
          className="h-7 w-7 rounded-lg object-contain"
        />
      ) : null}
      {showName || !logoUrl ? (
        <span className={cn("font-semibold tracking-tight", textClassName)}>
          {businessName}
        </span>
      ) : null}
    </span>
  );
}
