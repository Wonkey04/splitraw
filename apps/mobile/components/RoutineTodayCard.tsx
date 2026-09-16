import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui";
import { colors, radius, spacing, typography, withAlpha } from "@/theme";

export interface RoutineTodayCardProps {
  /** "Rutina de hoy" o "Rutina del lunes", según el día seleccionado. */
  label: string;
  routineName: string;
  exerciseCount: number;
  durationMinutes: number;
  onPress: () => void;
}

// Estado CON rutina asignada. No es el mismo componente que el estado vacío
// con props en cero: son dos escenarios distintos para el socio (uno agenda
// el entrenamiento, el otro le pide que avise a su entrenador).
export function RoutineTodayCard({
  label,
  routineName,
  exerciseCount,
  durationMinutes,
  onPress,
}: RoutineTodayCardProps) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroHeader}>
        <View style={styles.heroHeaderText}>
          <Text style={styles.heroLabel}>{label}</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {routineName}
          </Text>
        </View>
        <Icon name="list" size={20} color={colors.accent} />
      </View>

      <View style={styles.heroMetrics}>
        <View style={styles.heroMetric}>
          <Text style={styles.heroMetricValue}>{exerciseCount}</Text>
          <Text style={styles.heroMetricLabel}>{exerciseCount === 1 ? "Ejercicio" : "Ejercicios"}</Text>
        </View>
        <View style={styles.heroMetric}>
          <Text style={styles.heroMetricValue}>{durationMinutes > 0 ? durationMinutes + " min" : "-"}</Text>
          <Text style={styles.heroMetricLabel}>Duración estimada</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={styles.heroButton}
      >
        <Text style={styles.heroButtonText}>Ver rutina completa</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: withAlpha(colors.accent, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.3),
    borderRadius: radius,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  heroHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  heroLabel: {
    ...typography.label,
    color: colors.accent,
  },
  heroTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  heroMetric: {
    flexShrink: 1,
  },
  heroMetricValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  heroMetricLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  heroButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  heroButtonText: {
    ...typography.body,
    fontWeight: "500",
    color: colors.bgPrimary,
  },
});

export default RoutineTodayCard;
