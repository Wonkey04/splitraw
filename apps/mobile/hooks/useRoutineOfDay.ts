import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Exercise } from "@/types";

interface RoutineOfDay {
  routineName: string | null;
  exercises: Exercise[];
  loading: boolean;
  error: string | null;
}

// Rutina asignada mas reciente (routines.member_id -> routine_template_id),
// filtrada a los ejercicios de un dia puntual (1=Lunes..7=Domingo). Un
// member sin fila en `routines` no tiene rutina asignada; una fila sin
// ejercicios ese dia_of_week simplemente descansa ese dia.
export function useRoutineOfDay(memberId: string | null | undefined, dayOfWeek: number): RoutineOfDay {
  const [routineName, setRoutineName] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      const { data: routineRows, error: routineError } = await supabase
        .from("routines")
        .select("routine_template_id")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (cancelled) return;

      if (routineError) {
        setError("No se pudo cargar tu rutina.");
        setLoading(false);
        return;
      }

      const templateId = routineRows?.[0]?.routine_template_id as string | undefined;
      if (!templateId) {
        setRoutineName(null);
        setExercises([]);
        setLoading(false);
        return;
      }

      const [templateRes, exercisesRes] = await Promise.all([
        supabase.from("routine_templates").select("name").eq("id", templateId).single(),
        supabase
          .from("exercises")
          .select("*")
          .eq("routine_template_id", templateId)
          .eq("day_of_week", dayOfWeek)
          .order("name", { ascending: true }),
      ]);

      if (cancelled) return;

      if (templateRes.error || exercisesRes.error) {
        setError("No se pudo cargar tu rutina.");
      } else {
        setRoutineName((templateRes.data?.name as string | undefined) ?? null);
        setExercises((exercisesRes.data as Exercise[]) ?? []);
      }
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [memberId, dayOfWeek]);

  return { routineName, exercises, loading, error };
}
