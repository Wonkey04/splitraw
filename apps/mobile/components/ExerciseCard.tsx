import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

const ORDER_SIZE = 26;
/** Único radius distinto al del sistema: separa la card de botones e inputs. */
const CARD_RADIUS = 8;

interface ExerciseCardProps {
  /** Posición en la rutina del día, empezando en 1. */
  order: number;
  name: string;
  muscleGroup?: string | null;
  series: number;
  reps: number;
  weightKg: number;
  onPress: () => void;
}

export function ExerciseCard({
  order,
  name,
  muscleGroup,
  series,
  reps,
  weightKg,
  onPress,
}: ExerciseCardProps) {
  const summary = series + "×" + reps + " · " + weightKg + "kg";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name + ", " + summary}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.order}>
        <Text style={styles.orderText}>{order}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        {muscleGroup && (
          <Text style={styles.muscleGroup} numberOfLines={1}>
            {muscleGroup}
          </Text>
        )}
      </View>

      <View style={styles.pill}>
        <Text style={styles.pillText}>{summary}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: CARD_RADIUS,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardPressed: {
    backgroundColor: colors.bgTertiary,
  },
  order: {
    width: ORDER_SIZE,
    height: ORDER_SIZE,
    borderRadius: ORDER_SIZE / 2,
    backgroundColor: colors.bgTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  orderText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.body,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  muscleGroup: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  pill: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  pillText: {
    ...typography.small,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
});
