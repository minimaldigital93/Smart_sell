// Curated accent palettes for the store theme. Beginner-proof: each preset is a
// hand-tuned, accessible set of CSS custom properties that override the defaults
// declared in globals.css (`@theme`). Overriding the variables on the <html>
// element cascades to every Tailwind utility (bg-primary, ring-ring, …).

export type ThemePreset = {
  key: string;
  label: string;
  /** Swatch shown in the picker. */
  swatch: string;
  /** CSS custom properties applied to <html>. */
  vars: Record<string, string>;
};

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    key: "rose",
    label: "Rose",
    swatch: "#d49097",
    vars: {
      "--color-primary": "#d49097",
      "--color-primary-foreground": "#ffffff",
      "--color-ring": "#e8b4b8",
      "--color-secondary": "#faf3f1",
      "--color-secondary-foreground": "#4a3f3a",
      "--color-accent": "#f5e0dc",
      "--color-accent-foreground": "#4a3f3a",
    },
  },
  {
    key: "blush",
    label: "Blush Pink",
    swatch: "#e6789a",
    vars: {
      "--color-primary": "#e6789a",
      "--color-primary-foreground": "#ffffff",
      "--color-ring": "#f2a6bd",
      "--color-secondary": "#fdeef3",
      "--color-secondary-foreground": "#4a2f39",
      "--color-accent": "#fbdce6",
      "--color-accent-foreground": "#4a2f39",
    },
  },
  {
    key: "mauve",
    label: "Mauve",
    swatch: "#a98bb0",
    vars: {
      "--color-primary": "#a98bb0",
      "--color-primary-foreground": "#ffffff",
      "--color-ring": "#c6aecb",
      "--color-secondary": "#f6f1f7",
      "--color-secondary-foreground": "#3f3543",
      "--color-accent": "#ecdef0",
      "--color-accent-foreground": "#3f3543",
    },
  },
  {
    key: "sage",
    label: "Sage",
    swatch: "#7faa8c",
    vars: {
      "--color-primary": "#7faa8c",
      "--color-primary-foreground": "#ffffff",
      "--color-ring": "#a6c6b1",
      "--color-secondary": "#eff5f1",
      "--color-secondary-foreground": "#2f433a",
      "--color-accent": "#dcebe1",
      "--color-accent-foreground": "#2f433a",
    },
  },
  {
    key: "gold",
    label: "Champagne Gold",
    swatch: "#c2a04d",
    vars: {
      "--color-primary": "#c2a04d",
      "--color-primary-foreground": "#ffffff",
      "--color-ring": "#d9c081",
      "--color-secondary": "#f8f3e6",
      "--color-secondary-foreground": "#463c25",
      "--color-accent": "#f0e4c4",
      "--color-accent-foreground": "#463c25",
    },
  },
  {
    key: "noir",
    label: "Noir",
    swatch: "#3a3a3a",
    vars: {
      "--color-primary": "#2f2f2f",
      "--color-primary-foreground": "#ffffff",
      "--color-ring": "#9a9a9a",
      "--color-secondary": "#f3f3f3",
      "--color-secondary-foreground": "#2f2f2f",
      "--color-accent": "#e6e6e6",
      "--color-accent-foreground": "#2f2f2f",
    },
  },
] as const;

export const DEFAULT_THEME_KEY = "rose";

export function getThemePreset(key: string | null | undefined): ThemePreset {
  return (
    THEME_PRESETS.find((p) => p.key === key) ??
    THEME_PRESETS.find((p) => p.key === DEFAULT_THEME_KEY)!
  );
}

/** CSS variables for a theme, ready to spread into a React `style` prop. */
export function themeStyleVars(key: string | null | undefined): React.CSSProperties {
  return getThemePreset(key).vars as React.CSSProperties;
}
