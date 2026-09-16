"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import { useOrganization } from "@/lib/hooks/useOrganization";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import InvitationCodeCard from "@/components/InvitationCodeCard";
import ProUpsellCard from "@/components/ProUpsellCard";
import { Card, ActionCard, MetricCard } from "@/components/ui";
import { PlusIcon, RoutineListIcon, UsersIcon } from "@/components/icons";

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
  const { metrics, loading: metricsLoading } = useDashboardMetrics(organization?.id ?? null);

  const name = profile
    ? `${profile.name ?? ""} ${profile.surname ?? ""}`.trim()
    : user?.email?.split("@")[0] ?? "Owner";

  const isFree = organization?.plan === "free";

  return (
    <div>
      <h1 className="mb-1 text-[30px] font-extrabold text-textPrimary">Hola, {name}</h1>
      {organization && (
        <p className="mb-8 text-[14px] text-textSecondary">
          {organization.name}
          {organization.city ? ` · ${organization.city}` : ""}
        </p>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Alumnos activos" value={metricsLoading ? "—" : metrics?.activeMembers ?? 0} />
        <MetricCard label="Rutinas creadas" value={metricsLoading ? "—" : metrics?.routineTemplates ?? 0} />
        <MetricCard
          label="Asignadas esta semana"
          value={metricsLoading ? "—" : metrics?.assignedThisWeek ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-4 text-h3">Acciones rápidas</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ActionCard
              href="/dashboard/routines/create"
              variant="primary"
              icon={<PlusIcon className="h-5 w-5" />}
              title="Crear rutina"
              description="Armá una rutina nueva para un alumno"
            />
            <ActionCard
              href="/dashboard/routines"
              icon={<RoutineListIcon className="h-5 w-5" />}
              title="Ver mis rutinas"
              description="Revisá y editá las rutinas existentes"
            />
            <ActionCard
              href="/dashboard/members"
              icon={<UsersIcon className="h-5 w-5" />}
              title="Ver miembros"
              description="Gestioná altas, bajas y estados de tus alumnos"
            />
          </div>
        </section>

        <aside className="flex flex-col gap-5">
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

          {!loading && isFree && <ProUpsellCard />}
        </aside>
      </div>
    </div>
  );
}
