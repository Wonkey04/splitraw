"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { RoutineTemplate, Exercise } from "@/lib/types";

// Muestra una rutina: nombre, descripcion, y la misma tabla ejercicio x dia
// de la pantalla de creacion, pero de solo lectura.
export default function RoutineDetailPage() {
  const params = useParams<{ id: string }>();
  const templateId = params?.id as string;

  const [template, setTemplate] = useState<RoutineTemplate | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const [templateRes, exercisesRes] = await Promise.all([
        supabase.from("routine_templates").select("*").eq("id", templateId).single(),
        supabase
          .from("exercises")
          .select("*")
          .eq("routine_template_id", templateId)
          .order("day_of_week", { ascending: true }),
      ]);

      if (templateRes.error || exercisesRes.error) {
        setError("No se pudo cargar la rutina.");
      } else {
        setTemplate(templateRes.data as RoutineTemplate);
        setExercises(exercisesRes.data as Exercise[]);
      }
      setLoading(false);
    }
    loadData();
  }, [templateId]);

  if (loading) return <p className="text-text-secondary">Cargando...</p>;
  if (error || !template) return <p className="text-error">{error ?? "Rutina no encontrada."}</p>;

  // Filas = nombres de ejercicio distintos (en el orden en que aparecen).
  const rowNames: string[] = [];
  for (const ex of exercises) {
    if (!rowNames.includes(ex.name)) rowNames.push(ex.name);
  }

  function cellFor(exName: string, day: number) {
    return exercises.find((ex) => ex.name === exName && ex.day_of_week === day);
  }

  return (
    <div>
      <div className="card mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{template.name}</h1>
            <p className="mt-1 text-text-secondary">{template.description}</p>
          </div>
          <Link href={`/dashboard/routines/${template.id}/assign`} className="btn-primary">
            Asignar a Miembro
          </Link>
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold">Ejercicios</h2>

      {rowNames.length === 0 ? (
        <p className="text-text-secondary">No hay ejercicios aún.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left">
            <thead>
              <tr className="bg-bg-secondary">
                <th className="border-b border-gray-800 px-2 py-2 text-sm text-text-secondary">Ejercicio</th>
                {DAYS_OF_WEEK.map((d) => (
                  <th key={d.value} className="border-b border-gray-800 px-2 py-2 text-center text-sm text-text-secondary">
                    {d.label.slice(0, 3).toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowNames.map((exName, i) => (
                <tr key={exName} className={i % 2 === 0 ? "" : "bg-bg-secondary/40"}>
                  <td className="border-b border-gray-800 px-2 py-2 text-sm">{exName}</td>
                  {DAYS_OF_WEEK.map((d) => {
                    const cell = cellFor(exName, d.value);
                    return (
                      <td key={d.value} className="border-b border-gray-800 px-2 py-2 text-center text-sm">
                        {cell ? (
                          <span title={`${cell.target_weight_kg}kg`}>
                            {cell.target_sets}x{cell.target_reps}
                          </span>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
