import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/colors";

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
            <Pressable onPress={onClose} hitSlop={12}>
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

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text,
    flexShrink: 1,
  },
  closeX: {
    fontSize: 20,
    color: colors.textSecondary,
    paddingLeft: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "600",
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "bold",
  },
});
