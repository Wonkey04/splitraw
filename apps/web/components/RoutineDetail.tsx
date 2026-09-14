"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { RoutineTemplate, Exercise } from "@/lib/types";
import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";

// Muestra una rutina: nombre, descripcion, y la misma tabla ejercicio x dia
// de la pantalla de creacion, pero de solo lectura.
//
// Compartido entre el GYM_OWNER (/dashboard/routines/[id]) y el TRAINER
// (/trainer/routines/[id]): lo unico que cambia es a donde apunta el boton
// de asignar.
export interface RoutineDetailProps {
  /** Base de la ruta de rutinas de quien la usa. */
  basePath: string;
}

export default function RoutineDetail({ basePath }: RoutineDetailProps) {
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

  if (loading) return <p className="text-body text-textSecondary">Cargando...</p>;
  if (error || !template) return <p className="text-body text-error">{error ?? "Rutina no encontrada."}</p>;

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
      <Card className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1">{template.name}</h1>
            <p className="mt-2 text-body text-textSecondary">{template.description}</p>
          </div>
          <Link
            href={`${basePath}/${template.id}/assign`}
            className="shrink-0 rounded bg-accent px-4 py-2 text-body font-medium text-white transition-colors hover:bg-accentHover"
          >
            Asignar a miembro
          </Link>
        </div>
      </Card>

      <h2 className="mb-4 text-h2">Ejercicios</h2>

      {rowNames.length === 0 ? (
        <p className="text-body text-textSecondary">No hay ejercicios aún.</p>
      ) : (
        <Table className="min-w-[700px]">
          <TableHead>
            <TableRow hoverable={false}>
              <TableHeaderCell>Ejercicio</TableHeaderCell>
              {DAYS_OF_WEEK.map((d) => (
                <TableHeaderCell key={d.value} className="text-center">
                  {d.label.slice(0, 3)}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rowNames.map((exName) => (
              <TableRow key={exName}>
                <TableCell>{exName}</TableCell>
                {DAYS_OF_WEEK.map((d) => {
                  const cell = cellFor(exName, d.value);
                  return (
                    <TableCell key={d.value} className="text-center">
                      {cell ? (
                        <span title={`${cell.target_weight_kg} kg`}>
                          {cell.target_sets}x{cell.target_reps}
                        </span>
                      ) : (
                        <span className="text-textSecondary">-</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
