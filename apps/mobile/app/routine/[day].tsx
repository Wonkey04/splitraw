import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { RoutineList } from "@/components/RoutineList";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import { WorkoutCompleteButton } from "@/components/WorkoutCompleteButton";
import { dayLabel, getTodayDayOfWeek } from "@/constants/days";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { useRoutineOfDay } from "@/hooks/useRoutineOfDay";
import { useWorkoutLog } from "@/hooks/useWorkoutLog";
import { colors, spacing, typography } from "@/theme";
import type { Exercise } from "@/types";

/** Alto reservado abajo para que el footer fijo no tape el último ejercicio. */
const FOOTER_CLEARANCE = 100;

/**
 * Detalle de la rutina de un día: la misma lista de ejercicios que antes
 * vivía dentro de home, ahora como pantalla propia. Home quedó como panel
 * general y entra acá con "Ver rutina completa".
 */
export default function RoutineDetail() {
  const params = useLocalSearchParams<{ day?: string }>();
  const parsedDay = Number(params.day);
  const day = parsedDay >= 1 && parsedDay <= 7 ? parsedDay : getTodayDayOfWeek();

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { member } = useCurrentMember(user?.id);
  const { routineName, exercises, loading, error } = useRoutineOfDay(member?.id, day);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const workoutLog = useWorkoutLog(user?.id, member?.id);

  // Los días de la rutina son simbólicos: marcan frecuencia semanal, no un
  // calendario que el socio tenga que respetar al pie de la letra. Por eso
  // el botón aparece en cualquier día con ejercicios cargados, sin exigir
  // que coincida con la fecha del dispositivo. El registro en exercise_log
  // igual se guarda con la fecha real de hoy (ver useWorkoutLog).
  const canRegister = exercises.length > 0 && workoutLog.canLog;
  const showFooter = !error && !loading && !workoutLog.loading && canRegister;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: showFooter ? FOOTER_CLEARANCE : spacing.md + insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.back}>Volver</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>{dayLabel(day)}</Text>
        <Text style={styles.subtitle}>
          {routineName ? `Rutina: ${routineName}` : "Todavía no tenés una rutina asignada."}
        </Text>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <RoutineList exercises={exercises} loading={loading} onExercisePress={setSelectedExercise} />
        )}
      </ScrollView>

      {/* Footer fijo: el botón queda siempre a mano, sin scrollear hasta el
          final de la lista. El padding inferior suma el inset para no quedar
          debajo del home indicator. */}
      {showFooter && (
        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          <WorkoutCompleteButton
            completed={workoutLog.completed}
            saving={workoutLog.saving}
            onComplete={workoutLog.complete}
            onUndo={workoutLog.undo}
          />
          {workoutLog.error && <Text style={styles.logError}>{workoutLog.error}</Text>}
        </View>
      )}

      <ExerciseDetailModal
        visible={selectedExercise !== null}
        exercise={
          selectedExercise
            ? {
                name: selectedExercise.name,
                series: selectedExercise.target_sets,
                reps: selectedExercise.target_reps,
                weightKg: selectedExercise.target_weight_kg,
              }
            : null
        }
        onClose={() => setSelectedExercise(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.md },
  header: { marginBottom: spacing.md },
  back: { ...typography.body, color: colors.accent, fontWeight: "500" },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  errorText: { ...typography.body, color: colors.error },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    // Sin paddingTop propio: el separador de arriba lo pone el marginTop del
    // propio WorkoutCompleteButton, que no se toca.
    paddingTop: 0,
  },
  logError: {
    ...typography.small,
    color: colors.error,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
