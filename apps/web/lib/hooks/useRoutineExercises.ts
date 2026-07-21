"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MuscleGroup, ExerciseCatalog } from "@/lib/types";

// Cascada Grupo Muscular -> Ejercicio. Trae los grupos una sola vez (al
// montar) y los ejercicios de cada grupo recien cuando el usuario lo elige,
// guardando el resultado en un Map para no repetir el fetch si vuelve a
// elegir el mismo grupo.
export function useRoutineExercises() {
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
  const [muscleGroupsLoading, setMuscleGroupsLoading] = useState(true);
  const [exercisesByGroup, setExercisesByGroup] = useState<Map<number, ExerciseCatalog[]>>(new Map());
  const [exercisesLoading, setExercisesLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("muscle_groups")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setMuscleGroups((data as MuscleGroup[]) ?? []);
        setMuscleGroupsLoading(false);
      });
  }, []);

  async function fetchExercises(groupId: number) {
    if (exercisesByGroup.has(groupId)) return;

    setExercisesLoading(true);
    const { data } = await supabase
      .from("exercise_catalog")
      .select("*")
      .eq("muscle_group_id", groupId)
      .order("name");
    setExercisesLoading(false);

    setExercisesByGroup((prev) => new Map(prev).set(groupId, (data as ExerciseCatalog[]) ?? []));
  }

  return { muscleGroups, muscleGroupsLoading, exercisesByGroup, fetchExercises, exercisesLoading };
}
