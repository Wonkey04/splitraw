"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import { useOrganization } from "@/lib/hooks/useOrganization";
import InvitationCodeCard from "@/components/InvitationCodeCard";
import { Card } from "@/components/ui";

// Home del dueño.
//
// El código de vinculación subió acá desde /dashboard/members, donde estaba
// abajo del listado: es lo primero que un gimnasio recién creado necesita
// (sin código no puede entrar ni un solo socio) y era justo lo que había que
// ir a buscar. El dashboard arranca vacío a propósito, sin datos de ejemplo.
export default function DashboardHome() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { organization, loading, error, setInvitationCode } = useOrganization();

  const name = profile
    ? `${profile.name ?? ""} ${profile.surname ?? ""}`.trim()
    : user?.email?.split("@")[0] ?? "Owner";

  return (
    <div>
      <h1 className="mb-1 text-h1">Hola, {name}</h1>
      {organization && (
        <p className="mb-8 text-body text-textSecondary">
          {organization.name}
          {organization.city ? ` · ${organization.city}` : ""}
          {organization.province ? `, ${organization.province}` : ""}
        </p>
      )}

      <div className="mb-8">
        {loading ? (
          <Card>
            <p className="text-body text-textSecondary">Cargando tu gimnasio...</p>
          </Card>
        ) : error ? (
          <Card>
            <p className="text-body text-error">{error}</p>
          </Card>
        ) : organization?.invitation_code ? (
          <InvitationCodeCard
            organizationId={organization.id}
            code={organization.invitation_code}
            plan={organization.plan}
            onCodeChange={setInvitationCode}
          />
        ) : (
          // No debería pasar: create_gym_with_owner() siempre genera uno y la
          // migración 0014 hizo backfill de los gimnasios viejos. Si igual
          // pasa, se dice qué hacer en vez de mostrar una card vacía.
          <Card>
            <h2 className="mb-2 text-h3">Sin código de vinculación</h2>
            <p className="text-body text-textSecondary">
              Tu gimnasio no tiene código y sin él tus alumnos no pueden
              registrarse. Escribinos para que lo generemos.
            </p>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ShortcutCard href="/dashboard/routines/create">Crear rutina</ShortcutCard>
        <ShortcutCard href="/dashboard/routines">Ver mis rutinas</ShortcutCard>
        <ShortcutCard href="/dashboard/members">Ver miembros</ShortcutCard>
      </div>
    </div>
  );
}

function ShortcutCard({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded border border-border bg-bgPrimary p-6 text-center text-body font-medium text-textPrimary transition-colors hover:border-accent hover:bg-bgTertiary"
    >
      {children}
    </Link>
  );
}
