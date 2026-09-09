/**
 * theme.ts  –  Nari App Design System
 *
 * Single source of truth for every colour, spacing, radius and shadow
 * used across the app. Import `T` in any screen instead of hard-coding
 * hex values.
 *
 * Usage:
 *   import { T } from "@/constants/theme";
 *   <View style={{ backgroundColor: T.pink.bg }} />
 */

// ─── Core Palette ─────────────────────────────────────────────────────────────

export const palette = {
  // Primary rose-pink spectrum
  pink50:  "#fff0f4",
  pink100: "#ffe0eb",
  pink200: "#ffb3cc",
  pink300: "#ff7faa",
  pink400: "#ff5b83",  // primary action colour
  pink500: "#e84ea1",  // vibrant brand pink
  pink600: "#d63d8f",
  pink700: "#b0296f",
  pink800: "#8e1a52",
  pink900: "#6b0f3b",

  // Neutrals
  white:   "#ffffff",
  gray50:  "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",

  // Semantic
  danger:  "#ef4444",
  warning: "#f59e0b",
  success: "#10b981",

  // Translucent pinks (for rings / overlays)
  pinkAlpha10: "rgba(232,78,161,0.10)",
  pinkAlpha20: "rgba(232,78,161,0.20)",
  pinkAlpha35: "rgba(232,78,161,0.35)",
  pinkAlpha50: "rgba(232,78,161,0.50)",
};

// ─── Semantic Tokens ──────────────────────────────────────────────────────────

export const T = {
  // ── Backgrounds ─────────────────────────────────────────────────────────────
  bg: {
    screen:   palette.white,
    soft:     palette.pink50,
    card:     palette.white,
    header:   palette.pink50,     // pink blush header
    input:    palette.gray50,
    tag:      palette.pink50,
  },

  // ── Brand / Primary ──────────────────────────────────────────────────────────
  pink: {
    primary:  palette.pink500,    // #e84ea1
    action:   palette.pink400,    // #ff5b83 – buttons, links
    light:    palette.pink100,
    bg:       palette.pink50,
    border:   palette.pink200,
    text:     palette.pink400,
    dark:     palette.pink700,
    ring1:    palette.pinkAlpha20,
    ring2:    palette.pinkAlpha35,
  },

  // ── Text ─────────────────────────────────────────────────────────────────────
  text: {
    primary:   palette.gray900,
    secondary: palette.gray600,
    muted:     palette.gray400,
    onPink:    palette.white,
    link:      palette.pink400,
    danger:    palette.danger,
  },

  // ── Borders ──────────────────────────────────────────────────────────────────
  border: {
    default: palette.gray100,
    pink:    palette.pink200,
    focus:   palette.pink400,
  },

  // ── Shadows ──────────────────────────────────────────────────────────────────
  shadow: {
    pink: {
      shadowColor:   palette.pink500,
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius:  12,
      elevation:     6,
    },
    card: {
      shadowColor:   "#000",
      shadowOffset:  { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius:  8,
      elevation:     2,
    },
  },

  // ── Border Radius ─────────────────────────────────────────────────────────────
  radius: {
    sm:   8,
    md:   12,
    lg:   20,
    xl:   28,
    full: 999,
  },

  // ── Spacing ───────────────────────────────────────────────────────────────────
  space: {
    xs:  4,
    sm:  8,
    md:  16,
    lg:  24,
    xl:  32,
    xxl: 48,
  },

  // ── Tab bar ────────────────────────────────────────────────────────────────────
  tab: {
    active:       palette.pink500,
    inactive:     palette.gray400,
    activeBg:     palette.pink50,
    indicator:    palette.pink500,
    fabBg:        palette.pink500,
    fabBgFocused: palette.pink700,
  },

  // ── Cycle phase – all pink, only label changes ────────────────────────────────
  // The app stays pink regardless of cycle phase. Phase affects label only.
  phase: {
    menstrual:  { label: "Period",     subtitle: "Take it easy today 🌸", badge: "Period" },
    follicular: { label: "Follicular", subtitle: "Energy rising! 💪",      badge: "Follicular" },
    ovulation:  { label: "Fertile",   subtitle: "Peak fertility window 🌟", badge: "Ovulation" },
    luteal:     { label: "Luteal",    subtitle: "Slow down & rest 🌙",      badge: "Luteal" },
  },

  // ── Insight card accents (subtle, used for tiny icon dots only) ──────────────
  accent: {
    purple: "#8b5cf6",
    green:  "#059669",
    orange: "#f97316",
    amber:  "#d97706",
    // backgrounds always stay within pink family
    purpleBg: "#f5f0ff",
    greenBg:  "#f0fff8",
    orangeBg: "#fff8f0",
    amberBg:  "#fffdf0",
  },
} as const;

// ─── Re-export legacy Colors for backward compat with useColorScheme ──────────
export const Colors = {
  light: {
    text:            palette.gray900,
    background:      palette.white,
    tint:            palette.pink500,
    icon:            palette.gray500,
    tabIconDefault:  palette.gray400,
    tabIconSelected: palette.pink500,
  },
  dark: {
    text:            "#ECEDEE",
    background:      "#151718",
    tint:            palette.white,
    icon:            "#9BA1A6",
    tabIconDefault:  "#9BA1A6",
    tabIconSelected: palette.white,
  },
};
