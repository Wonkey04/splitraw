"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface StaleMember {
  memberId: string;
  name: string;
  /** null = nunca registró una sesión. */
  lastLogAt: string | null;
}

export interface TrainerHomeOverview {
  membersWithoutRoutine: number;
  expiringThisWeek: number;
  routinesCreatedThisWeek: number;
  /** Máx 5, ordenados del más desactualizado al menos. Vacío si no hay ninguno. */
  staleMembers: StaleMember[];
}

const STALE_DAYS = 7;
const STALE_LIST_MAX = 5;

/** Lunes 00:00 de la semana en curso, hora local. */
function startOfWeekIso(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  return monday.toISOString();
}

function displayName(name: string | null | undefined, surname: string | null | undefined, email: string) {
  const full = `${name ?? ""} ${surname ?? ""}`.trim();
  return full || email;
}

// Las tres tarjetas de estado + la lista de "sin registrar hace 7+ días" del
// home del trainer (Feature 1). Todo scopeado a la sucursal del trainer:
// las mismas barreras que ya usa MembersSection (RLS + filtro explícito).
export function useTrainerHomeOverview(branchId: string | null, organizationId: string | null) {
  const [overview, setOverview] = useState<TrainerHomeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId || !organizationId) {
      setOverview(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const weekStart = startOfWeekIso();

        const [withoutRoutineRes, expiringRes, templatesRes, membersRes] = await Promise.all([
          supabase.rpc("list_branch_members", { p_has_routine: false, p_limit: 1, p_offset: 0 }),
          supabase.rpc("list_branch_members", { p_status: "soon", p_limit: 1, p_offset: 0 }),
          supabase
            .from("routine_templates")
            .select("id", { count: "exact", head: true })
            .eq("branch_id", branchId)
            .gte("created_at", weekStart),
          supabase.from("members").select("id, user_id, email").eq("branch_id", branchId),
        ]);

        if (cancelled) return;

        if (withoutRoutineRes.error || expiringRes.error || templatesRes.error || membersRes.error) {
          setError("No se pudo cargar el resumen.");
          setOverview(null);
          return;
        }

        const withoutRoutineRows = (withoutRoutineRes.data as { total_count: number }[]) ?? [];
        const expiringRows = (expiringRes.data as { total_count: number }[]) ?? [];
        const members = (membersRes.data as { id: string; user_id: string; email: string }[]) ?? [];

        let staleMembers: StaleMember[] = [];

        if (members.length > 0) {
          const userIds = members.map((m) => m.user_id).filter(Boolean);

          const [profilesRes, logsRes] = await Promise.all([
            supabase.from("user_profiles").select("id, name, surname").in("id", userIds),
            supabase
              .from("exercise_log")
              .select("member_id, fecha")
              .in("member_id", userIds)
              .order("fecha", { ascending: false }),
          ]);

          if (cancelled) return;

          const profileById = new Map(
            ((profilesRes.data as { id: string; name: string | null; surname: string | null }[]) ?? []).map(
              (p) => [p.id, p]
            )
          );

          // exercise_log viene ordenado por fecha desc: la primera fila de
          // cada member_id ya es la más reciente.
          const lastLogByUserId = new Map<string, string>();
          for (const row of (logsRes.data as { member_id: string; fecha: string }[]) ?? []) {
            if (!lastLogByUserId.has(row.member_id)) lastLogByUserId.set(row.member_id, row.fecha);
          }

          const now = Date.now();
          const staleDaysMs = STALE_DAYS * 24 * 60 * 60 * 1000;

          staleMembers = members
            .map((m) => {
              const profile = profileById.get(m.user_id);
              const lastLogAt = lastLogByUserId.get(m.user_id) ?? null;
              return {
                memberId: m.id,
                name: displayName(profile?.name, profile?.surname, m.email),
                lastLogAt,
              };
            })
            .filter((m) => m.lastLogAt === null || now - new Date(m.lastLogAt).getTime() >= staleDaysMs)
            // Nunca registró (null) va primero, después el más viejo.
            .sort((a, b) => {
              if (a.lastLogAt === null && b.lastLogAt === null) return 0;
              if (a.lastLogAt === null) return -1;
              if (b.lastLogAt === null) return 1;
              return new Date(a.lastLogAt).getTime() - new Date(b.lastLogAt).getTime();
            })
            .slice(0, STALE_LIST_MAX);
        }

        setOverview({
          membersWithoutRoutine: withoutRoutineRows[0]?.total_count ?? 0,
          expiringThisWeek: expiringRows[0]?.total_count ?? 0,
          routinesCreatedThisWeek: templatesRes.count ?? 0,
          staleMembers,
        });
      } catch {
        if (!cancelled) {
          setError("No se pudo cargar el resumen.");
          setOverview(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [branchId, organizationId]);

  return { overview, loading, error };
}
