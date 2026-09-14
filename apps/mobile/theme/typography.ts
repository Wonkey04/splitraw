import { TextStyle } from "react-native";

/**
 * Escala tipográfica — fuente de verdad: docs/branding.md
 * Inter, única familia. Sentence case en toda la interfaz.
 */
export const typography = {
  h1: { fontSize: 32, fontWeight: "700", lineHeight: 38 },
  h2: { fontSize: 24, fontWeight: "600", lineHeight: 31 },
  h3: { fontSize: 18, fontWeight: "600", lineHeight: 25 },
  body: { fontSize: 14, fontWeight: "400", lineHeight: 21 },
  small: { fontSize: 12, fontWeight: "400", lineHeight: 17 },
  label: { fontSize: 12, fontWeight: "500", lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
