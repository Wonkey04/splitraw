import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, spacing } from "../../theme";

export interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgPrimary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    padding: spacing.lg,
  },
});

export default Card;
