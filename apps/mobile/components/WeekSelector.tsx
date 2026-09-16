import { Pressable, StyleSheet, Text, View } from "react-native";
import { DAYS_OF_WEEK } from "@/constants/days";
import { colors, spacing, typography, withAlpha } from "@/theme";

const CIRCLE_SIZE = 28;

interface WeekSelectorProps {
  currentDay: number;
  /** Días (1..7) con al menos un ejercicio: el resto no es interactuable. */
  daysWithRoutine: number[];
  onSelectDay: (day: number) => void;
}

/**
 * Selector semanal L..D. Reemplaza al par anterior/próximo: mismo efecto
 * (setear el día activo), solo cambia la presentación.
 */
export function WeekSelector({ currentDay, daysWithRoutine, onSelectDay }: WeekSelectorProps) {
  return (
    <View style={styles.container}>
      {DAYS_OF_WEEK.map((day) => {
        const active = day.value === currentDay;
        const hasRoutine = daysWithRoutine.includes(day.value);
        const disabled = !hasRoutine && !active;

        return (
          <Pressable
            key={day.value}
            accessibilityRole="button"
            accessibilityLabel={day.label}
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            hitSlop={6}
            onPress={() => onSelectDay(day.value)}
            style={styles.item}
          >
            <View
              style={[
                styles.circle,
                active && styles.circleActive,
                !active && hasRoutine && styles.circleAvailable,
              ]}
            >
              <Text
                style={[
                  styles.label,
                  active && styles.labelActive,
                  disabled && styles.labelDisabled,
                ]}
              >
                {day.label.charAt(0)}
              </Text>
            </View>

            {/* El día activo ya se distingue por el círculo lleno: repetir el
                punto ahí sería ruido, no información nueva. */}
            <View style={styles.dotSlot}>{!active && hasRoutine && <View style={styles.dot} />}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  item: {
    flex: 1,
    alignItems: "center",
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: colors.bgTertiary,
  },
  circleAvailable: {
    backgroundColor: colors.bgPrimary,
    borderColor: colors.border,
  },
  circleActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
  },
  labelActive: {
    color: colors.bgPrimary,
  },
  labelDisabled: {
    color: withAlpha(colors.textSecondary, 0.55),
  },
  dotSlot: {
    height: 8,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
