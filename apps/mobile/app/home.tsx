import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors } from "@/constants/colors";
import { dayLabel, getTodayDayOfWeek, nextDay, previousDay } from "@/constants/days";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentMember } from "@/hooks/useCurrentMember";
import { useRoutineOfDay } from "@/hooks/useRoutineOfDay";
import { RoutineList } from "@/components/RoutineList";
import { DayNavigator } from "@/components/DayNavigator";
import { ExerciseDetailModal } from "@/components/ExerciseDetailModal";
import type { Exercise } from "@/types";

const todayDayOfWeek = getTodayDayOfWeek();

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { member, loading: memberLoading, error: memberError } = useCurrentMember(user?.id);
  const [currentDay, setCurrentDay] = useState(todayDayOfWeek);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const { routineName, exercises, loading: routineLoading, error: routineError } = useRoutineOfDay(
    member?.id,
    currentDay
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const loading = authLoading || memberLoading;
  const error = memberError ?? routineError;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Hoy</Text>
          <Pressable onPress={handleLogout} hitSlop={8}>
            <Text style={styles.logout}>Cerrar sesión</Text>
          </Pressable>
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!loading && error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && !error && (
          <>
            <Text style={styles.routineName}>
              {routineName ? `Rutina: ${routineName}` : "Todavía no tenés una rutina asignada."}
            </Text>

            <RoutineList
              exercises={exercises}
              loading={routineLoading}
              onExercisePress={setSelectedExercise}
            />

            <DayNavigator
              currentDay={currentDay}
              onPrevious={() => setCurrentDay(previousDay(currentDay))}
              onNext={() => setCurrentDay(nextDay(currentDay))}
            />
          </>
        )}
      </ScrollView>

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
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "bold",
  },
  logout: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  routineName: {
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: 16,
  },
  center: {
    paddingVertical: 32,
    alignItems: "center",
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
  },
});
