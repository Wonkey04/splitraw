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
        const { data, error: fetchError } = await supabase
          .from("routine_templates")
          .select("*")
          .eq("organization_id", profile!.organization_id)
          .order("created_at", { ascending: false });

        if (fetchError) {
          setError("No se pudieron cargar las rutinas.");
        } else {
          setTemplates(data as RoutineTemplate[]);
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
        <h1 className="text-2xl font-semibold">Mis Rutinas</h1>
        <Link href="/dashboard/routines/create" className="btn-primary">
          Crear Rutina
        </Link>
      </div>

      {loading && <p className="text-text-secondary">Cargando...</p>}
      {error && <p className="text-error">{error}</p>}

      {!loading && !error && templates.length === 0 && (
        <p className="text-text-secondary">No hay rutinas aún.</p>
      )}

      {!loading && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`/dashboard/routines/${template.id}`}
              className="card block hover:border-primary"
            >
              <p className="font-medium">{template.name}</p>
              <p className="text-sm text-text-secondary">{template.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
