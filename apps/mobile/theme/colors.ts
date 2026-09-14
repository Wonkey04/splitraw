/**
 * Tokens de color — fuente de verdad: docs/branding.md
 * Los nombres son idénticos a los de apps/web/tailwind.config.js.
 */
export const colors = {
  bgPrimary: "#FFFFFF",
  bgSecondary: "#F8F9FA",
  bgTertiary: "#F0F1F3",

  textPrimary: "#1A202C",
  textSecondary: "#6B7280",
  border: "#E5E7EB",

  accent: "#1E3A8A",
  accentHover: "#2563EB",

  success: "#10B981",
  error: "#DC2626",
  warning: "#F59E0B",
} as const;

/** Overlay de modal — branding.md: rgba(26, 32, 44, 0.4) */
export const overlay = "rgba(26, 32, 44, 0.4)";

export type ColorToken = keyof typeof colors;

/**
 * Devuelve un token con opacidad. React Native no tiene `color-mix`, así que la
 * conversión vive acá, junto a los tokens, y nunca en un componente.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
