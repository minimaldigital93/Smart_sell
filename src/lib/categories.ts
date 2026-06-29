import {
  Sparkles,
  Palette,
  SprayCan,
  Scissors,
  Droplets,
  Heart,
  Gem,
  Flower,
  Flower2,
  Sun,
  Moon,
  Star,
  Leaf,
  Brush,
  Wind,
  Bath,
  Pipette,
  FlaskConical,
  Gift,
  ShoppingBag,
  Tag,
  Package,
  Eye,
  Smile,
  Crown,
  Wand2,
  Glasses,
  Footprints,
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

/**
 * Curated Lucide icon set offered in the admin category icon picker, keyed by
 * the kebab-case name we persist in `shop_categories.icon`. Keeping a registry
 * (rather than `lucide-react/dynamic`) keeps the bundle tree-shakeable and the
 * picker predictable.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  palette: Palette,
  "spray-can": SprayCan,
  scissors: Scissors,
  droplets: Droplets,
  heart: Heart,
  gem: Gem,
  flower: Flower,
  "flower-2": Flower2,
  sun: Sun,
  moon: Moon,
  star: Star,
  leaf: Leaf,
  brush: Brush,
  wind: Wind,
  bath: Bath,
  pipette: Pipette,
  "flask-conical": FlaskConical,
  gift: Gift,
  "shopping-bag": ShoppingBag,
  tag: Tag,
  package: Package,
  eye: Eye,
  smile: Smile,
  crown: Crown,
  "wand-2": Wand2,
  glasses: Glasses,
  footprints: Footprints,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export const DEFAULT_CATEGORY_ICON: LucideIcon = Tag;
export const DEFAULT_CATEGORY_COLOR = "#ec4899";
const DEFAULT_GRADIENT = "from-pink-50 to-nude-100";
const DEFAULT_BANNER_GRADIENT = "from-pink-100 via-nude-50 to-pink-200";
const DEFAULT_ICON_CLASS = "text-pink-500";

function isBuiltinSlug(slug?: string | null): slug is CategorySlug {
  return !!slug && Object.prototype.hasOwnProperty.call(CATEGORY_META, slug);
}

/** Resolve the Lucide component for a stored icon name (falls back to a tag). */
export function categoryIcon(name?: string | null): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || DEFAULT_CATEGORY_ICON;
}

export type CategoryVisualInput = {
  slug?: string | null;
  icon?: string | null;
  color?: string | null;
};

/**
 * Visual identity for any category (built-in or custom), used across the
 * storefront + admin. Built-in slugs keep their curated tailwind tint/gradient
 * so the existing storefront stays pixel-identical; custom categories use their
 * stored hex `color` (as an inline tint) over a neutral gradient.
 */
export function categoryVisual(cat: CategoryVisualInput) {
  const builtin = isBuiltinSlug(cat.slug) ? CATEGORY_META[cat.slug] : null;
  const Icon =
    (cat.icon && CATEGORY_ICONS[cat.icon]) ||
    builtin?.icon ||
    DEFAULT_CATEGORY_ICON;
  return {
    Icon,
    // Built-ins keep their tailwind class tint; custom categories tint via hex.
    color: builtin ? null : (cat.color ?? null),
    iconClass: builtin?.iconClass ?? DEFAULT_ICON_CLASS,
    gradient: builtin?.gradient ?? DEFAULT_GRADIENT,
    bannerGradient: builtin?.bannerGradient ?? DEFAULT_BANNER_GRADIENT,
  };
}
