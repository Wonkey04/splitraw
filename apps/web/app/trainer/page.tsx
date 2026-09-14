"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { RoutineTemplate } from "@/lib/types";
import MembersSection from "@/components/MembersSection";
import {
  Badge,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";

// Panel del TRAINER: rutinas del gimnasio, planes (pausado, placeholder) y
// los miembros de SU sucursal. El filtro por sucursal tambien esta en la
// RLS (0008), no solo en esta query.
export default function TrainerDashboardPage() {
  const { profile, loading: profileLoading } = useUserProfile();

  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
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

    async function loadDashboard() {
      try {
        const [orgRes, branchRes, templatesRes] = await Promise.all([
          supabase.from("organizations").select("name").eq("id", profile!.organization_id).single(),
          supabase.from("branches").select("name").eq("id", profile!.branch_id).maybeSingle(),
          supabase
            .from("routine_templates")
            .select("*")
            .eq("organization_id", profile!.organization_id)
            .order("created_at", { ascending: false }),
        ]);

        if (!orgRes.error && orgRes.data) setOrganizationName(orgRes.data.name as string);
        if (!branchRes.error && branchRes.data) setBranchName(branchRes.data.name as string);

        if (templatesRes.error) {
          setError("No se pudieron cargar las rutinas.");
        } else {
          const list = (templatesRes.data as RoutineTemplate[]) ?? [];
          setTemplates(list);

          // Cuantos ejercicios tiene cada rutina, para que la fila del
          // listado diga algo util sin abrirla.
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
        setError("No se pudo cargar el panel.");
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [profile, profileLoading]);

  if (loading) return <p className="text-body text-textSecondary">Cargando...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1">{organizationName ? `Panel ${organizationName}` : "Panel"}</h1>
        {branchName && <p className="mt-1 text-body text-textSecondary">Sucursal {branchName}</p>}
      </div>

      {error && <p className="text-body text-error">{error}</p>}

      {/* ------------------------------------------------------- rutinas */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-h3">Rutinas</h2>
          <Link
            href="/trainer/routines/create"
            className="rounded bg-accent px-4 py-1 text-body font-medium text-white transition-colors hover:bg-accentHover"
          >
            Crear rutina
          </Link>
        </div>

        {templates.length === 0 ? (
          <p className="text-body text-textSecondary">No hay rutinas todavía.</p>
        ) : (
          // Denso a proposito (branding.md / referencia Linear-Notion): una
          // fila por rutina, nombre + descripcion + cantidad de ejercicios en
          // la misma linea, padding vertical minimo. La idea es ver el
          // listado completo sin scrollear.
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
                  <TableCell className="py-1 text-textSecondary">
                    {template.description || "-"}
                  </TableCell>
                  <TableCell className="py-1 text-right text-textSecondary">
                    {exerciseCountByTemplate.get(template.id) ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ------------------------------------------- planes (placeholder) */}
      <section>
        <h2 className="mb-2 text-h3">Gestión de planes</h2>
        {/* Mismo patron que el home del member en mobile: la seccion existe
            en el layout pero avisa que todavia no esta disponible. Sin datos
            reales: no toca MembershipPlan ni nada parecido. */}
        <Card className="flex items-center justify-between gap-4 py-4">
          <p className="text-body text-textSecondary">
            Altas, vencimientos y cobros de planes van a vivir acá.
          </p>
          <Badge variant="neutral">Pronto</Badge>
        </Card>
      </section>

      {/* ------------------------------------------------------ miembros */}
      {/* Paginado + buscador viven adentro del componente: con cientos de
          socios no se puede traer la lista entera de una. */}
      <MembersSection
        scope="branch"
        assignHrefBase="/trainer/members"
        scopeLabel={`Solo de tu sucursal${branchName ? ` (${branchName})` : ""}`}
      />
    </div>
  );
}
