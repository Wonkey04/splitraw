import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Exercise, Member } from "@/types";

interface HomeOverview {
  /** Días (1..7) que tienen al menos un ejercicio en la rutina asignada. */
  daysWithRoutine: number[];
  /** Rutinas asignadas a este member dentro de la semana en curso. */
  weeklyRoutineCount: number;
  /** Nombre del gimnasio (organizations.name). */
  gymName: string | null;
  /** Sucursal del member: "Sucursal Mitre 201" si hay dirección, si no el nombre solo. */
  branchLabel: string | null;
  /** nombre de ejercicio -> grupo muscular, para calcular el foco del día. */
  muscleGroupByExercise: Map<string, string>;
  loading: boolean;
}

/** Lunes 00:00 y domingo 24:00 de la semana en curso, en hora local. */
function currentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const jsDay = now.getDay();
  const daysSinceMonday = jsDay === 0 ? 6 : jsDay - 1;

  const start = new Date(now);
  start.setDate(now.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

/**
 * Datos de contexto del panel general: qué días tiene rutina, cuántas
 * rutinas le asignaron esta semana, en qué sucursal entrena y a qué grupo
 * muscular pertenece cada ejercicio.
 *
 * No reemplaza a useRoutineOfDay: esa sigue siendo la fuente de los
 * ejercicios del día seleccionado. Acá solo se traen los datos que el panel
 * necesita alrededor.
 */
export function useHomeOverview(member: Member | null): HomeOverview {
  const [daysWithRoutine, setDaysWithRoutine] = useState<number[]>([]);
  const [weeklyRoutineCount, setWeeklyRoutineCount] = useState(0);
  const [gymName, setGymName] = useState<string | null>(null);
  const [branchLabel, setBranchLabel] = useState<string | null>(null);
  const [muscleGroupByExercise, setMuscleGroupByExercise] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!member) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function load() {
      const memberId = member!.id;

      try {
        const { start, end } = currentWeekRange();

        const [routineRowsRes, weeklyRes, branchRes, orgRes] = await Promise.all([
          supabase
            .from("routines")
            .select("routine_template_id")
            .eq("member_id", memberId)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("routines")
            .select("id", { count: "exact", head: true })
            .eq("member_id", memberId)
            .gte("created_at", start.toISOString())
            .lt("created_at", end.toISOString()),
          supabase.from("branches").select("name, address").eq("id", member!.branch_id).maybeSingle(),
          supabase.from("organizations").select("name").eq("id", member!.organization_id).maybeSingle(),
        ]);

        if (cancelled) return;

        setWeeklyRoutineCount(weeklyRes.count ?? 0);

        // "Sucursal {nombre}": el nombre de la sucursal ya es corto (ej.
        // "Mitre 201"), el prefijo es lo que la distingue del nombre del
        // gimnasio en la card de "Tu gimnasio".
        const branch = branchRes.data as { name: string } | null;
        setBranchLabel(branch ? `Sucursal ${branch.name}` : null);

        const org = orgRes.data as { name: string } | null;
        setGymName(org?.name ?? null);

        const templateId = routineRowsRes.data?.[0]?.routine_template_id as string | undefined;
        if (!templateId) {
          setDaysWithRoutine([]);
          setMuscleGroupByExercise(new Map());
          return;
        }

        const { data: exercisesData } = await supabase
          .from("exercises")
          .select("name, day_of_week")
          .eq("routine_template_id", templateId);

        if (cancelled) return;

        const exercises = (exercisesData as Pick<Exercise, "name" | "day_of_week">[]) ?? [];
        setDaysWithRoutine([...new Set(exercises.map((ex) => ex.day_of_week))].sort());

        // `exercises` guarda solo el nombre (viene desnormalizado del
        // catálogo), así que el grupo muscular se resuelve por nombre.
        const names = [...new Set(exercises.map((ex) => ex.name))];
        if (names.length === 0) {
          setMuscleGroupByExercise(new Map());
          return;
        }

        const { data: catalogData } = await supabase
          .from("exercise_catalog")
          .select("name, muscle_group_id")
          .in("name", names);

        if (cancelled) return;

        const catalog = (catalogData as { name: string; muscle_group_id: number }[]) ?? [];
        const groupIds = [...new Set(catalog.map((row) => row.muscle_group_id))];
        if (groupIds.length === 0) {
          setMuscleGroupByExercise(new Map());
          return;
        }

        const { data: groupsData } = await supabase
          .from("muscle_groups")
          .select("id, name")
          .in("id", groupIds);

        if (cancelled) return;

        const groupNameById = new Map(
          ((groupsData as { id: number; name: string }[]) ?? []).map((g) => [g.id, g.name])
        );
        setMuscleGroupByExercise(
          new Map(
            catalog
              .filter((row) => groupNameById.has(row.muscle_group_id))
              .map((row) => [row.name, groupNameById.get(row.muscle_group_id)!])
          )
        );
      } catch {
        // Sin red: el panel se muestra igual, solo sin estos extras.
        if (!cancelled) {
          setDaysWithRoutine([]);
          setMuscleGroupByExercise(new Map());
          setGymName(null);
          setBranchLabel(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [member]);

  return { daysWithRoutine, weeklyRoutineCount, gymName, branchLabel, muscleGroupByExercise, loading };
}
