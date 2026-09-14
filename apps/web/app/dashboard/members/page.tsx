"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import InvitationCodeCard from "@/components/InvitationCodeCard";
import MembersSection from "@/components/MembersSection";
import { createGymInvitationCode } from "@/lib/invitationCode";
import type { GymInvitationCode } from "@/lib/types";
import { Button, Card } from "@/components/ui";

// Miembros del gimnasio para el GYM_OWNER: arriba el codigo de invitacion
// permanente (gym_invitation_codes) y abajo el listado.
//
// El listado es el mismo componente que usa el trainer, con scope "org": el
// owner ve TODA la organizacion (sin filtro de sucursal) y por eso la tabla
// le agrega la columna Sucursal. El paginado, el buscador y el JOIN a
// user_profiles para el nombre viven en la RPC list_org_members (0010) —
// antes esta pantalla traia todos los members de una y pintaba "-" en la
// columna Nombre porque ese dato no esta en `members`.
export default function MembersListPage() {
  const { profile, loading: profileLoading } = useUserProfile();

  const [invitation, setInvitation] = useState<GymInvitationCode | null>(null);
  const [invitationLoading, setInvitationLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

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
      <h1 className="mb-6 text-h1">Miembros</h1>

      <div className="mb-6">
        {invitationLoading && (
          <p className="text-body text-textSecondary">Cargando código de invitación...</p>
        )}

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
          <Card>
            <h2 className="mb-2 text-h3">Código de invitación de tu gimnasio</h2>
            <p className="mb-4 text-body text-textSecondary">
              Tu gimnasio todavía no tiene un código. Generá uno para que tus alumnos se registren
              en la app.
            </p>
            <Button onClick={handleGenerate} disabled={regenerating}>
              {regenerating ? "Generando..." : "Generar código de invitación"}
            </Button>
          </Card>
        )}

        {invitationError && <p className="mt-2 text-small text-error">{invitationError}</p>}
      </div>

      <MembersSection
        scope="org"
        assignHrefBase="/dashboard/members"
        scopeLabel="Todas las sucursales"
      />
    </div>
  );
}
