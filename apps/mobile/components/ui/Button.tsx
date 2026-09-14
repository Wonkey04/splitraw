import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../../theme";

export type ButtonVariant = "primary" | "secondary" | "destructive";

export interface ButtonProps {
  children: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  children,
  variant = "primary",
  onPress,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;

  const background = {
    primary: pressed ? colors.accentHover : colors.accent,
    secondary: pressed ? colors.bgTertiary : "transparent",
    destructive: colors.error,
  }[variant];

  const borderColor = variant === "secondary" ? colors.border : "transparent";
  const textColor = variant === "secondary" ? colors.textPrimary : colors.bgPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: background, borderColor },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius,
    borderWidth: 1,
  },
  fullWidth: { alignSelf: "stretch" },
  disabled: { opacity: 0.5 },
  text: { ...typography.body, fontWeight: "500" },
});

export default Button;
