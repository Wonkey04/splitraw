import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * nombre de ejercicio -> grupo muscular.
 *
 * `exercises` guarda solo el nombre (viene desnormalizado del catálogo al
 * crear la rutina), así que el grupo se resuelve por nombre contra
 * exercise_catalog. Un ejercicio cargado a mano, fuera del catálogo, no
 * matchea y simplemente no muestra grupo.
 *
 * Misma resolución que hace useHomeOverview para el "grupo foco de hoy". Si
 * más adelante `exercises` guarda `muscle_group_id`, los dos lugares se
 * simplifican a leer la columna.
 */
export function useMuscleGroupsByExercise(exerciseNames: string[]): Map<string, string> {
  const [groupByExercise, setGroupByExercise] = useState<Map<string, string>>(new Map());

  // Clave estable: evita relanzar el fetch en cada render por ser un array nuevo.
  const namesKey = [...new Set(exerciseNames)].sort().join("|");

  useEffect(() => {
    const names = namesKey ? namesKey.split("|") : [];
    if (names.length === 0) {
      setGroupByExercise(new Map());
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const { data: catalogData } = await supabase
          .from("exercise_catalog")
          .select("name, muscle_group_id")
          .in("name", names);

        if (cancelled) return;

        const catalog = (catalogData as { name: string; muscle_group_id: number }[]) ?? [];
        const groupIds = [...new Set(catalog.map((row) => row.muscle_group_id))];
        if (groupIds.length === 0) {
          setGroupByExercise(new Map());
          return;
        }

        const { data: groupsData } = await supabase
          .from("muscle_groups")
          .select("id, name")
          .in("id", groupIds);

        if (cancelled) return;

        const groupNameById = new Map(
          ((groupsData as { id: number; name: string }[]) ?? []).map((group) => [group.id, group.name])
        );

        setGroupByExercise(
          new Map(
            catalog
              .filter((row) => groupNameById.has(row.muscle_group_id))
              .map((row) => [row.name, groupNameById.get(row.muscle_group_id)!])
          )
        );
      } catch {
        // Sin red: la lista se muestra igual, solo sin el grupo muscular.
        if (!cancelled) setGroupByExercise(new Map());
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [namesKey]);

  return groupByExercise;
}
