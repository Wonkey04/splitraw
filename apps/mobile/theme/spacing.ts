/**
 * Espaciado — fuente de verdad: docs/branding.md
 * Base 8. `xs` (4px) solo para separaciones internas de un componente.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Un único radius en toda la interfaz. */
export const radius = 6;

/** Grosor de borde estándar (la jerarquía se construye con borde, no con sombra). */
export const borderWidth = 1;

export type SpacingToken = keyof typeof spacing;
