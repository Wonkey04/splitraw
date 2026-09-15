import { useState } from "react";
import { StyleSheet, StyleProp, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../../theme";

export interface InputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  // `style` sigue omitido a propósito: el borde, el padding y el color del
  // campo son del sistema y no se pisan desde afuera. `inputStyle` es la
  // rendija para lo tipográfico (un código centrado y espaciado, por
  // ejemplo), y se aplica ÚLTIMA para que sea evidente qué gana.
  inputStyle?: StyleProp<TextStyle>;
}

export function Input({ label, error, editable = true, containerStyle, inputStyle, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.error : focused ? colors.accent : colors.border;
  // Foco: borde de 2px (branding.md). Se compensa el padding para que el campo no salte.
  const thick = focused || Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        {...props}
        editable={editable}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          {
            borderColor,
            borderWidth: thick ? 2 : 1,
            paddingVertical: thick ? spacing.sm - 1 : spacing.sm,
            paddingHorizontal: thick ? spacing.md - 1 : spacing.md,
          },
          !editable && styles.disabled,
          inputStyle,
        ]}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textSecondary },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.bgPrimary,
    borderRadius: radius,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  disabled: {
    backgroundColor: colors.bgTertiary,
    color: colors.textSecondary,
  },
  error: { ...typography.small, color: colors.error },
});

export default Input;
