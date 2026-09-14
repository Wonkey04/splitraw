import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayISODate } from "@/utils/today";
import type { ExerciseLog } from "@/types";

interface WorkoutLog {
  /** true si ya hay una fila de exercise_log para hoy. */
  completed: boolean;
  /** Carga inicial: hasta que termine no se sabe en qué estado va el botón. */
  loading: boolean;
  /** Insert o delete en curso. */
  saving: boolean;
  error: string | null;
  /** false si no hay rutina asignada: sin routine_id no se puede registrar. */
  canLog: boolean;
  complete: () => Promise<void>;
  undo: () => Promise<void>;
}

/**
 * Registro de "entrenamiento completado" del día (docs/decisions.md: un
 * botón por rutina del día, no un tilde por ejercicio).
 *
 * Dos ids distintos, a propósito:
 *  - `userId` es auth.uid() == user_profiles.id, y es lo que va en
 *    exercise_log.member_id (contra eso corren las RLS).
 *  - `memberId` es members.id, que es por donde se busca la fila de
 *    `routines` asignada al socio.
 */
export function useWorkoutLog(
  userId: string | null | undefined,
  memberId: string | null | undefined
): WorkoutLog {
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fecha = todayISODate();

  useEffect(() => {
    if (!userId || !memberId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        // Misma rutina que muestra la pantalla: la asignación más reciente.
        const { data: routineRows, error: routineError } = await supabase
          .from("routines")
          .select("id")
          .eq("member_id", memberId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (cancelled) return;

        if (routineError) {
          setError("No se pudo cargar tu registro de hoy.");
          return;
        }

        const currentRoutineId = (routineRows?.[0]?.id as string | undefined) ?? null;
        setRoutineId(currentRoutineId);

        if (!currentRoutineId) {
          setLogId(null);
          return;
        }

        const { data: logRow, error: logError } = await supabase
          .from("exercise_log")
          .select("id")
          .eq("member_id", userId)
          .eq("routine_id", currentRoutineId)
          .eq("fecha", fecha)
          .maybeSingle();

        if (cancelled) return;

        if (logError) {
          setError("No se pudo cargar tu registro de hoy.");
          return;
        }

        setLogId(((logRow as Pick<ExerciseLog, "id"> | null)?.id) ?? null);
      } catch {
        // fetch rechaza (en vez de resolver con error) cuando no hay red.
        if (!cancelled) setError("Sin conexión.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, memberId, fecha]);

  const complete = useCallback(async () => {
    if (!userId || !routineId || logId) return;

    setSaving(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from("exercise_log")
        .insert({ member_id: userId, routine_id: routineId, fecha })
        .select("id")
        .single();

      if (insertError) {
        // 23505 = choque con el UNIQUE (member_id, routine_id, fecha): ya
        // había fila para hoy (doble tap, u otra sesión). No es un error
        // para el socio, el estado buscado ya existe: se relee y listo.
        if (insertError.code === "23505") {
          const { data: existing } = await supabase
            .from("exercise_log")
            .select("id")
            .eq("member_id", userId)
            .eq("routine_id", routineId)
            .eq("fecha", fecha)
            .maybeSingle();

          const existingId = (existing as Pick<ExerciseLog, "id"> | null)?.id ?? null;
          if (existingId) {
            setLogId(existingId);
            return;
          }
        }

        setError("No se pudo guardar tu registro.");
        return;
      }

      setLogId((data as Pick<ExerciseLog, "id">).id);
    } catch {
      setError("Sin conexión.");
    } finally {
      setSaving(false);
    }
  }, [userId, routineId, logId, fecha]);

  const undo = useCallback(async () => {
    if (!logId) return;

    setSaving(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase.from("exercise_log").delete().eq("id", logId);

      if (deleteError) {
        setError("No se pudo deshacer el registro.");
        return;
      }

      setLogId(null);
    } catch {
      setError("Sin conexión.");
    } finally {
      setSaving(false);
    }
  }, [logId]);

  return {
    completed: logId !== null,
    loading,
    saving,
    error,
    canLog: routineId !== null,
    complete,
    undo,
  };
}
