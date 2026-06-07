import {
  Sparkles,
  Palette,
  SprayCan,
  Scissors,
  Droplets,
  type LucideIcon,
} from "lucide-react";
import type { CategorySlug } from "@/lib/constants";

/**
 * Per-category visual identity shared across the storefront (home category
 * rail, category page hero, etc.) so colors/icons stay consistent.
 * - `gradient`     — soft two-stop fill for small tiles
 * - `bannerGradient` — richer three-stop fill for page heroes
 */
export const CATEGORY_META: Record<
  CategorySlug,
  {
    icon: LucideIcon;
    gradient: string;
    bannerGradient: string;
    iconClass: string;
  }
> = {
  skincare: {
    icon: Sparkles,
    gradient: "from-pink-50 to-pink-100",
    bannerGradient: "from-pink-100 via-nude-50 to-pink-200",
    iconClass: "text-pink-500",
  },
  makeup: {
    icon: Palette,
    gradient: "from-nude-50 to-nude-100",
    bannerGradient: "from-nude-100 via-pink-50 to-nude-200",
    iconClass: "text-nude-500",
  },
  perfume: {
    icon: SprayCan,
    gradient: "from-pink-50 to-nude-100",
    bannerGradient: "from-pink-100 via-nude-50 to-nude-200",
    iconClass: "text-pink-400",
  },
  haircare: {
    icon: Scissors,
    gradient: "from-nude-50 to-pink-100",
    bannerGradient: "from-nude-100 via-pink-50 to-pink-200",
    iconClass: "text-nude-400",
  },
  bodycare: {
    icon: Droplets,
    gradient: "from-pink-50 to-pink-100",
    bannerGradient: "from-pink-100 via-nude-50 to-pink-200",
    iconClass: "text-pink-400",
  },
};
