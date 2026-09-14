import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme";
import type { Exercise } from "@/types";
import { ExerciseCard } from "@/components/ExerciseCard";
import { useMuscleGroupsByExercise } from "@/hooks/useMuscleGroupsByExercise";

interface RoutineListProps {
  exercises: Exercise[];
  onExercisePress: (exercise: Exercise) => void;
  loading?: boolean;
}

export function RoutineList({ exercises, onExercisePress, loading }: RoutineListProps) {
  const muscleGroupByExercise = useMuscleGroupsByExercise(exercises.map((ex) => ex.name));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
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
      {exercises.map((exercise, index) => (
        <ExerciseCard
          key={exercise.id}
          order={index + 1}
          name={exercise.name}
          muscleGroup={muscleGroupByExercise.get(exercise.name)}
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
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
