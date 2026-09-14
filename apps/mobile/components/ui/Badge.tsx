import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, spacing, typography, withAlpha } from "../../theme";

export type BadgeVariant = "success" | "error" | "warning" | "neutral";

export interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const tokenByVariant: Record<BadgeVariant, string> = {
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
  neutral: colors.textSecondary,
};

/**
 * branding.md: fondo del color funcional al 10%, borde 1px del color al 30%,
 * texto del color pleno.
 */
export function Badge({ children, variant = "neutral", style }: BadgeProps) {
  const color = tokenByVariant[variant];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: withAlpha(color, 0.1), borderColor: withAlpha(color, 0.3) },
        style,
      ]}
    >
      <Text style={[styles.text, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  text: typography.small,
});

export default Badge;
