import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/colors";
import type { Exercise } from "@/types";
import { ExerciseCard } from "@/components/ExerciseCard";

interface RoutineListProps {
  exercises: Exercise[];
  onExercisePress: (exercise: Exercise) => void;
  loading?: boolean;
}

export function RoutineList({ exercises, onExercisePress, loading }: RoutineListProps) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (exercises.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Sin rutina hoy. Descansa.</Text>
      </View>
    );
  }

  return (
    <View>
      {exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          name={exercise.name}
          series={exercise.target_sets}
          reps={exercise.target_reps}
          weightKg={exercise.target_weight_kg}
          onPress={() => onExercisePress(exercise)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});
