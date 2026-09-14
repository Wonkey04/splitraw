"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { Member } from "@/lib/types";
import { Badge, Button, Card, Select } from "@/components/ui";

// Asigna esta rutina (ya creada) a un miembro elegido de un dropdown.
// Inserta en `routines`. Redirige a la rutina al terminar.
//
// Compartido owner/trainer. Para el trainer el dropdown ya viene filtrado
// por sucursal: la policy members_select_trainer_branch (0008) no le
// devuelve members de otras branches aunque la query pida toda la org.
export interface AssignMemberToRoutineProps {
  /** Base de la ruta de rutinas de quien la usa. */
  basePath: string;
}

export default function AssignMemberToRoutine({ basePath }: AssignMemberToRoutineProps) {
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
    setTimeout(() => router.push(`${basePath}/${templateId}`), 1200);
  }

  if (loading) return <p className="text-body text-textSecondary">Cargando...</p>;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-h1">Asignar a miembro</h1>

      {success ? (
        <Badge variant="success">Rutina asignada correctamente</Badge>
      ) : (
        <Card>
          <form onSubmit={handleAssign} className="flex flex-col gap-4">
            {members.length === 0 ? (
              <p className="text-body text-textSecondary">No hay miembros creados todavía.</p>
            ) : (
              <Select
                label="Seleccionar miembro"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                options={members.map((m) => ({ value: m.id, label: m.full_name ?? m.email }))}
              />
            )}

            {error && <p className="text-small text-error">{error}</p>}

            <Button type="submit" fullWidth disabled={submitting || members.length === 0}>
              {submitting ? "Asignando..." : "Asignar"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
