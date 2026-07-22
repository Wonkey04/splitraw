"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { RoutineTemplate } from "@/lib/types";

// Assigns a routine template to a single member by inserting a row into
// `routines`. Redirects back to the members list on success.
export default function AssignRoutinePage() {
  const params = useParams<{ id: string }>();
  const memberId = params?.id as string;
  const router = useRouter();
  const { profile, loading: profileLoading } = useUserProfile();

  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profileLoading) return;

    if (!profile) {
      setError("No se encontró tu perfil. Volvé a loguearte.");
      setLoading(false);
      return;
    }

    async function loadTemplates() {
      const { data, error: fetchError } = await supabase
        .from("routine_templates")
        .select("*")
        .eq("organization_id", profile!.organization_id);

      if (fetchError) {
        setError("No se pudieron cargar las rutinas.");
      } else {
        setTemplates(data as RoutineTemplate[]);
        if (data && data.length > 0) setSelectedId(data[0].id);
      }
      setLoading(false);
    }
    loadTemplates();
  }, [profile, profileLoading]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedId) {
      setError("Seleccioná una rutina.");
      return;
    }

    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      setError("Tu sesión expiró, volvé a loguearte.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("routines").insert({
      member_id: memberId,
      routine_template_id: selectedId,
      organization_id: profile!.organization_id,
      assigned_by: userId,
    });

    setSubmitting(false);

    if (insertError) {
      setError("No se pudo asignar la rutina.");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/dashboard/members"), 1200);
  }

  if (loading) return <p className="text-text-secondary">Cargando...</p>;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">Asignar Rutina</h1>

      {success ? (
        <p className="rounded border border-success bg-bg-secondary px-4 py-3 text-success">
          Rutina asignada correctamente
        </p>
      ) : (
        <form onSubmit={handleAssign} className="card space-y-4">
          {templates.length === 0 ? (
            <p className="text-text-secondary">No hay rutinas creadas todavía.</p>
          ) : (
            <div>
              <label className="mb-1 block text-sm text-text-secondary">Seleccionar Rutina</label>
              <select
                className="input-field"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={submitting || templates.length === 0}
          >
            {submitting ? "Asignando..." : "Asignar"}
          </button>
        </form>
      )}
    </div>
  );
}
