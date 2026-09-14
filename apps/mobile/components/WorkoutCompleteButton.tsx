import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui";
import { colors, radius, spacing, typography, withAlpha } from "@/theme";

interface WorkoutCompleteButtonProps {
  completed: boolean;
  saving: boolean;
  onComplete: () => void;
  onUndo: () => void;
}

/**
 * Botón único de registro del día (docs/decisions.md: un botón por rutina,
 * no un tilde por ejercicio). En estado completado sigue siendo tocable:
 * ese segundo tap borra el registro, sin confirmación — es una acción sola
 * y reversible.
 */
export function WorkoutCompleteButton({
  completed,
  saving,
  onComplete,
  onUndo,
}: WorkoutCompleteButtonProps) {
  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ checked: completed, busy: saving }}
        accessibilityLabel={
          completed
            ? "Entrenamiento completado. Tocá de nuevo para deshacer."
            : "Completé el entrenamiento de hoy"
        }
        disabled={saving}
        onPress={completed ? onUndo : onComplete}
        style={[styles.button, completed ? styles.buttonDone : styles.buttonPending]}
      >
        {saving ? (
          <ActivityIndicator color={completed ? colors.success : colors.bgPrimary} size="small" />
        ) : (
          <>
            {completed && <Icon name="check" size={16} color={colors.success} />}
            <Text style={[styles.text, completed ? styles.textDone : styles.textPending]}>
              {completed ? "Entrenamiento completado" : "Completé el entrenamiento de hoy"}
            </Text>
          </>
        )}
      </Pressable>

      {completed && !saving && <Text style={styles.undoHint}>Tocá de nuevo para deshacer</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.lg,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius,
    borderWidth: 1,
  },
  buttonPending: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  buttonDone: {
    backgroundColor: withAlpha(colors.success, 0.1),
    borderColor: withAlpha(colors.success, 0.3),
  },
  text: {
    ...typography.body,
    fontWeight: "500",
    flexShrink: 1,
    textAlign: "center",
  },
  textPending: {
    color: colors.bgPrimary,
  },
  textDone: {
    color: colors.success,
  },
  undoHint: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
