import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, spacing, typography, withAlpha } from "../../theme";

export type BannerVariant = "warning" | "error" | "success" | "neutral";

export interface BannerProps {
  title: string;
  message?: string;
  variant?: BannerVariant;
  style?: ViewStyle;
}

const variantColor: Record<BannerVariant, string> = {
  warning: colors.warning,
  error: colors.error,
  success: colors.success,
  neutral: colors.textSecondary,
};

// Aviso a lo ancho del contenido. Informa, no interrumpe: no es un modal, no
// tapa nada y no tiene botón de cerrar — el aviso desaparece cuando la
// condición que lo causó deja de ser cierta, no cuando el usuario lo descarta.
//
// Misma receta de superficie tintada que el resto del sistema (branding.md):
// fondo del color funcional al 10%, borde al 30%, texto pleno. Sin sombras.
export function Banner({ title, message, variant = "warning", style }: BannerProps) {
  const color = variantColor[variant];

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        { backgroundColor: withAlpha(color, 0.1), borderColor: withAlpha(color, 0.3) },
        style,
      ]}
    >
      <Text style={[styles.title, { color }]}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    fontWeight: "600",
  },
  message: {
    ...typography.small,
    color: colors.textSecondary,
  },
});

export default Banner;
