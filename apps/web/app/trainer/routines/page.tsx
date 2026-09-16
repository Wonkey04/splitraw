"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { RoutineTemplate } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui";

// Listado de rutinas del trainer. Vivía mezclado con miembros y el
// placeholder de planes en /trainer (ver Feature 1, home nueva); esta
// pantalla es solo lo que dice su nombre, mismo criterio que
// /dashboard/routines del lado del owner.
export default function TrainerRoutinesPage() {
  const { profile, loading: profileLoading } = useUserProfile();

  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [exerciseCountByTemplate, setExerciseCountByTemplate] = useState<Map<string, number>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profileLoading) return;

    if (!profile) {
      setError("No se encontró tu perfil. Volvé a loguearte.");
      setLoading(false);
      return;
    }

    async function loadTemplates() {
      try {
        const [orgRes, templatesRes] = await Promise.all([
          supabase.from("organizations").select("name").eq("id", profile!.organization_id).single(),
          supabase
            .from("routine_templates")
            .select("*")
            .eq("organization_id", profile!.organization_id)
            .order("created_at", { ascending: false }),
        ]);

        if (!orgRes.error && orgRes.data) setOrganizationName(orgRes.data.name as string);

        if (templatesRes.error) {
          setError("No se pudieron cargar las rutinas.");
        } else {
          const list = (templatesRes.data as RoutineTemplate[]) ?? [];
          setTemplates(list);

          if (list.length > 0) {
            const { data: exerciseRows } = await supabase
              .from("exercises")
              .select("routine_template_id")
              .in(
                "routine_template_id",
                list.map((t) => t.id)
              );

            const counts = new Map<string, number>();
            for (const row of (exerciseRows as { routine_template_id: string }[]) ?? []) {
              counts.set(row.routine_template_id, (counts.get(row.routine_template_id) ?? 0) + 1);
            }
            setExerciseCountByTemplate(counts);
          }
        }
      } catch {
        setError("No se pudo cargar el listado.");
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, [profile, profileLoading]);

  if (loading) return <p className="text-body text-textSecondary">Cargando...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1">
          Rutinas
          {organizationName && <span className="text-textSecondary"> · {organizationName}</span>}
        </h1>
        <Link
          href="/trainer/routines/create"
          className="rounded bg-accent px-4 py-2 text-body font-medium text-white transition-colors hover:bg-accentHover"
        >
          Crear rutina
        </Link>
      </div>

      {error && <p className="text-body text-error">{error}</p>}

      {templates.length === 0 ? (
        <p className="text-body text-textSecondary">No hay rutinas todavía.</p>
      ) : (
        // Denso a proposito (branding.md / referencia Linear-Notion): una
        // fila por rutina, nombre + descripcion + cantidad de ejercicios en
        // la misma linea, padding vertical minimo.
        <Table>
          <TableHead>
            <TableRow hoverable={false}>
              <TableHeaderCell className="py-1">Rutina</TableHeaderCell>
              <TableHeaderCell className="py-1">Descripción</TableHeaderCell>
              <TableHeaderCell className="w-24 py-1 text-right">Ejercicios</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="py-1">
                  <Link
                    href={`/trainer/routines/${template.id}`}
                    className="rounded font-medium text-textPrimary hover:text-accent"
                  >
                    {template.name}
                  </Link>
                </TableCell>
                <TableCell className="py-1 text-textSecondary">{template.description || "-"}</TableCell>
                <TableCell className="py-1 text-right text-textSecondary">
                  {exerciseCountByTemplate.get(template.id) ?? 0}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
