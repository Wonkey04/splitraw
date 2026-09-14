"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { RoutineTemplate } from "@/lib/types";

// Lists all routine templates belonging to la organizacion del usuario logueado.
export default function RoutinesListPage() {
  const { profile, loading: profileLoading } = useUserProfile();
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
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
        const [templatesRes, orgRes] = await Promise.all([
          supabase
            .from("routine_templates")
            .select("*")
            .eq("organization_id", profile!.organization_id)
            .order("created_at", { ascending: false }),
          supabase.from("organizations").select("name").eq("id", profile!.organization_id).single(),
        ]);

        if (templatesRes.error) {
          setError("No se pudieron cargar las rutinas.");
        } else {
          setTemplates(templatesRes.data as RoutineTemplate[]);
        }

        if (!orgRes.error && orgRes.data) {
          setOrganizationName(orgRes.data.name as string);
        }
      } catch {
        setError("No se pudieron cargar las rutinas.");
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, [profile, profileLoading]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-h1">Rutinas{organizationName ? ` ${organizationName}` : ""}</h1>
        <Link
          href="/dashboard/routines/create"
          className="rounded bg-accent px-4 py-2 text-body font-medium text-white transition-colors hover:bg-accentHover"
        >
          Crear rutina
        </Link>
      </div>

      {loading && <p className="text-body text-textSecondary">Cargando...</p>}
      {error && <p className="text-body text-error">{error}</p>}

      {!loading && !error && templates.length === 0 && (
        <p className="text-body text-textSecondary">No hay rutinas aún.</p>
      )}

      {!loading && templates.length > 0 && (
        <div className="flex flex-col gap-4">
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`/dashboard/routines/${template.id}`}
              className="block rounded border border-border bg-bgPrimary p-6 transition-colors hover:border-accent hover:bg-bgTertiary"
            >
              <p className="text-body font-medium text-textPrimary">{template.name}</p>
              <p className="mt-1 text-body text-textSecondary">{template.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
