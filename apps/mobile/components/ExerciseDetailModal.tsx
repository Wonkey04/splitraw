import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { colors, overlay, radius, spacing, typography } from "@/theme";

interface ExerciseDetailModalProps {
  visible: boolean;
  exercise: {
    name: string;
    series: number;
    reps: number;
    weightKg: number;
  } | null;
  onClose: () => void;
}

export function ExerciseDetailModal({ visible, exercise, onClose }: ExerciseDetailModalProps) {
  if (!exercise) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{exercise.name}</Text>
            <Pressable accessibilityLabel="Cerrar" onPress={onClose} hitSlop={12}>
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Series</Text>
            <Text style={styles.value}>{exercise.series}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Reps</Text>
            <Text style={styles.value}>{exercise.reps}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Peso</Text>
            <Text style={styles.value}>{exercise.weightKg} kg</Text>
          </View>

          {/* Placeholder para Phase 2 (registro de series). Deshabilitado por ahora. */}
          <Button variant="secondary" fullWidth disabled style={styles.logButton}>
            Registrar serie (próximamente)
          </Button>

          <Button fullWidth onPress={onClose} style={styles.closeButton}>
            Cerrar
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  closeX: {
    ...typography.h3,
    color: colors.textSecondary,
    paddingLeft: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  logButton: {
    marginTop: spacing.lg,
  },
  closeButton: {
    marginTop: spacing.sm,
  },
});
