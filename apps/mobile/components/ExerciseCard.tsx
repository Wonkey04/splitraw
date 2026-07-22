import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/colors";

interface ExerciseCardProps {
  name: string;
  series: number;
  reps: number;
  weightKg: number;
  onPress: () => void;
}

export function ExerciseCard({ name, series, reps, weightKg, onPress }: ExerciseCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.detail}>
        {series} × {reps} @ {weightKg} kg
      </Text>
      <Text style={styles.link}>Ver detalles →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 4,
  },
  detail: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  link: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
});
