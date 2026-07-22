"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { Member } from "@/lib/types";

// Asigna esta rutina (ya creada) a un miembro elegido de un dropdown.
// Inserta en `routines`. Redirige a la rutina al terminar.
export default function AssignRoutineToMemberPage() {
  const params = useParams<{ id: string }>();
  const templateId = params?.id as string;
  const router = useRouter();
  const { profile, loading: profileLoading } = useUserProfile();

  const [members, setMembers] = useState<Member[]>([]);
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

    async function loadMembers() {
      try {
        const { data, error: fetchError } = await supabase
          .from("members")
          .select("*")
          .eq("organization_id", profile!.organization_id);

        if (fetchError) {
          setError("No se pudieron cargar los miembros.");
        } else {
          setMembers(data as Member[]);
          if (data && data.length > 0) setSelectedId(data[0].id);
        }
      } catch {
        setError("No se pudieron cargar los miembros.");
      } finally {
        setLoading(false);
      }
    }
    loadMembers();
  }, [profile, profileLoading]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedId) {
      setError("Seleccioná un miembro.");
      return;
    }

    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId || !profile) {
      setError("Tu sesión expiró, volvé a loguearte.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("routines").insert({
      member_id: selectedId,
      routine_template_id: templateId,
      organization_id: profile.organization_id,
      assigned_by: userId,
    });

    setSubmitting(false);

    if (insertError) {
      setError("No se pudo asignar la rutina.");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push(`/dashboard/routines/${templateId}`), 1200);
  }

  if (loading) return <p className="text-text-secondary">Cargando...</p>;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">Asignar a Miembro</h1>

      {success ? (
        <p className="rounded border border-success bg-bg-secondary px-4 py-3 text-success">
          Rutina asignada correctamente
        </p>
      ) : (
        <form onSubmit={handleAssign} className="card space-y-4">
          {members.length === 0 ? (
            <p className="text-text-secondary">No hay miembros creados todavía.</p>
          ) : (
            <div>
              <label className="mb-1 block text-sm text-text-secondary">Seleccionar Miembro</label>
              <select
                className="input-field"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ?? m.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={submitting || members.length === 0}
          >
            {submitting ? "Asignando..." : "Asignar"}
          </button>
        </form>
      )}
    </div>
  );
}
