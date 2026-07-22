"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import InvitationCodeCard from "@/components/InvitationCodeCard";
import { createGymInvitationCode } from "@/lib/invitationCode";
import type { GymInvitationCode, Member } from "@/lib/types";

// Lists all members of la organizacion del usuario logueado, con accion
// para asignarles una rutina. Arriba de la tabla muestra el codigo de
// invitacion permanente del gimnasio (gym_invitation_codes).
export default function MembersListPage() {
  const { profile, loading: profileLoading } = useUserProfile();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [invitation, setInvitation] = useState<GymInvitationCode | null>(null);
  const [invitationLoading, setInvitationLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

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
        }
      } catch {
        setError("No se pudieron cargar los miembros.");
      } finally {
        setLoading(false);
      }
    }
    loadMembers();
  }, [profile, profileLoading]);

  useEffect(() => {
    if (profileLoading) return;

    if (!profile) {
      setInvitationLoading(false);
      return;
    }

    let cancelled = false;

    async function loadInvitation() {
      try {
        const { data, error: fetchError } = await supabase
          .from("gym_invitation_codes")
          .select("*")
          .eq("organization_id", profile!.organization_id)
          .is("deleted_at", null)
          .maybeSingle();

        if (!cancelled) {
          if (fetchError) {
            setInvitationError("No se pudo cargar el código de invitación.");
          } else {
            setInvitation(data as GymInvitationCode | null);
          }
        }
      } catch {
        if (!cancelled) setInvitationError("No se pudo cargar el código de invitación.");
      } finally {
        if (!cancelled) setInvitationLoading(false);
      }
    }
    loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [profile, profileLoading]);

  // Genera el codigo por primera vez (org que todavia no tiene ninguno).
  async function handleGenerate() {
    if (!profile) return;

    setRegenerating(true);
    setInvitationError(null);
    setCopied(false);

    const { invitation: created, error: createError } = await createGymInvitationCode(
      profile.organization_id
    );

    if (createError || !created) {
      setInvitationError(createError ?? "No se pudo generar el código.");
    } else {
      setInvitation(created);
    }
    setRegenerating(false);
  }

  // Regenera: da de baja (soft-delete) el codigo actual y crea uno nuevo.
  async function handleRegenerate() {
    if (!profile) return;

    setRegenerating(true);
    setInvitationError(null);
    setCopied(false);

    if (invitation) {
      await supabase
        .from("gym_invitation_codes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", invitation.id);
    }

    const { invitation: created, error: createError } = await createGymInvitationCode(
      profile.organization_id
    );

    if (createError || !created) {
      setInvitationError(createError ?? "No se pudo regenerar el código.");
    } else {
      setInvitation(created);
    }
    setRegenerating(false);
  }

  function handleCopy() {
    if (!invitation) return;
    navigator.clipboard.writeText(invitation.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Miembros</h1>

      <div className="mb-6">
        {invitationLoading && <p className="text-sm text-text-secondary">Cargando código de invitación...</p>}

        {/* Ya existe codigo: mostramos la tarjeta con copiar/regenerar. */}
        {!invitationLoading && invitation && (
          <InvitationCodeCard
            code={invitation.code}
            regenerating={regenerating}
            copied={copied}
            onCopy={handleCopy}
            onRegenerate={handleRegenerate}
          />
        )}

        {/* Gimnasio viejo sin codigo: boton de respaldo para generarlo. */}
        {!invitationLoading && !invitation && (
          <div className="card">
            <h2 className="mb-2 text-lg font-semibold">Código de invitación de tu gimnasio</h2>
            <p className="mb-4 text-sm text-text-secondary">
              Tu gimnasio todavía no tiene un código. Generá uno para que tus alumnos se
              registren en la app.
            </p>
            <button className="btn-primary" onClick={handleGenerate} disabled={regenerating}>
              {regenerating ? "Generando..." : "Generar código de invitación"}
            </button>
          </div>
        )}

        {invitationError && <p className="mt-2 text-sm text-error">{invitationError}</p>}
      </div>

      {loading && <p className="text-text-secondary">Cargando...</p>}
      {error && <p className="text-error">{error}</p>}
      {!loading && !error && members.length === 0 && (
        <p className="text-text-secondary">No hay miembros aún.</p>
      )}

      {!loading && members.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-800 text-sm text-text-secondary">
              <th className="py-2">Email</th>
              <th className="py-2">Nombre</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-gray-800">
                <td className="py-2">{member.email}</td>
                <td className="py-2">{member.full_name ?? "-"}</td>
                <td className="py-2">
                  <Link
                    href={`/dashboard/members/${member.id}/assign-routine`}
                    className="text-sm text-primary hover:underline"
                  >
                    Asignar Rutina
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
