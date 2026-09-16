"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import { useTrainerHomeOverview } from "@/lib/hooks/useTrainerHomeOverview";
import { Button, MetricCard } from "@/components/ui";

const STALE_DAYS = 7;

function formatLastLog(lastLogAt: string | null): string {
  if (!lastLogAt) return "Nunca registró";

  const days = Math.floor((Date.now() - new Date(lastLogAt).getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  return `Hace ${days} días`;
}

// Home del trainer (Feature 1): reemplaza la entrada directa a "Rutinas"
// como landing. Tres razones concretas para volver (miembros sin rutina,
// vencimientos de la semana, rutinas creadas) y una lista corta de a quién
// hay que prestarle atención — nada decorativo, todo con link a la acción.
export default function TrainerHomePage() {
  const { profile, loading: profileLoading } = useUserProfile();
  const [branchName, setBranchName] = useState<string | null>(null);

  const { overview, loading, error } = useTrainerHomeOverview(
    profile?.branch_id ?? null,
    profile?.organization_id ?? null
  );

  useEffect(() => {
    if (profileLoading || !profile) return;

    supabase
      .from("branches")
      .select("name")
      .eq("id", profile.branch_id)
      .maybeSingle()
      .then(({ data }) => setBranchName((data as { name: string } | null)?.name ?? null));
  }, [profile, profileLoading]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1">Panel</h1>
        {branchName && <p className="mt-1 text-body text-textSecondary">Sucursal {branchName}</p>}
      </div>

      {error && <p className="text-body text-error">{error}</p>}

      {(profileLoading || loading) && <p className="text-body text-textSecondary">Cargando...</p>}

      {!profileLoading && !loading && overview && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              label="Miembros sin rutina asignada"
              value={overview.membersWithoutRoutine}
              href="/trainer/members?routine=none"
              linkLabel="Ver miembros →"
            />
            <MetricCard
              label="Vencimientos esta semana"
              value={overview.expiringThisWeek}
              href="/trainer/members?status=soon"
              linkLabel="Ver miembros →"
            />
            <MetricCard label="Rutinas creadas esta semana" value={overview.routinesCreatedThisWeek} />
          </div>

          {/* Oculta si no hay nadie, no una card vacía con "0 resultados":
              un trainer con toda su sucursal al día no tiene por qué ver
              una sección que le diga que no hay nada que ver. */}
          {overview.staleMembers.length > 0 && (
            <section>
              <h2 className="mb-2 text-h3">
                Miembros sin registrar hace {STALE_DAYS}+ días
              </h2>
              <div className="rounded border border-border">
                {overview.staleMembers.map((member, index) => (
                  <div
                    key={member.memberId}
                    className={`flex items-center justify-between gap-4 px-4 py-3 ${
                      index < overview.staleMembers.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <div>
                      <p className="text-body font-medium text-textPrimary">{member.name}</p>
                      <p className="text-small text-warning">{formatLastLog(member.lastLogAt)}</p>
                    </div>
                    <Link href={`/trainer/members/${member.memberId}`}>
                      <Button variant="secondary">Ver</Button>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
