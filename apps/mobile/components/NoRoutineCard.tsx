import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui";
import { colors, radius, spacing, typography } from "@/theme";

export interface NoRoutineCardProps {
  /** "Sin rutina para hoy" o "Sin rutina para el lunes", según el día elegido. */
  title: string;
  onNotifyTrainer: () => void;
}

// Estado SIN rutina asignada: componente propio, no una versión con props en
// cero del componente con datos. Acá no hay nada que "Ver rutina completa"
// pueda abrir, así que ese botón directamente no existe en este árbol.
export function NoRoutineCard({ title, onNotifyTrainer }: NoRoutineCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Icon name="calendarOff" size={22} color={colors.textSecondary} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        Tu entrenador todavía no te asignó una rutina para este día.
      </Text>

      <Pressable accessibilityRole="button" onPress={onNotifyTrainer} style={styles.button}>
        <Text style={styles.buttonText}>Avisar a mi entrenador</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgMuted,
    borderRadius: radius,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  button: {
    marginTop: spacing.md,
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    backgroundColor: colors.bgPrimary,
  },
  buttonText: {
    ...typography.body,
    fontWeight: "500",
    color: colors.textPrimary,
  },
});

export default NoRoutineCard;
