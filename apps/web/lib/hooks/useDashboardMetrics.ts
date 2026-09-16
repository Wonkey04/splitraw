"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface DashboardMetrics {
  activeMembers: number;
  routineTemplates: number;
  assignedThisWeek: number;
}

// Lunes 00:00 hora local: arranque de la semana en curso.
function startOfWeekIso(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  return monday.toISOString();
}

// Las tres métricas del home del dueño. Alumnos activos se apoya en
// list_org_members (misma fuente que la lista de miembros: activo =
// activation_expires_at cargado y no vencido), las otras dos son counts
// directos scopeados por organization_id, igual que /dashboard/routines.
export function useDashboardMetrics(organizationId: string | null) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setMetrics(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [activeRes, templatesRes, assignedRes] = await Promise.all([
          supabase.rpc("list_org_members", { p_status: "active", p_limit: 1, p_offset: 0 }),
          supabase
            .from("routine_templates")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId),
          supabase
            .from("routines")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .gte("created_at", startOfWeekIso()),
        ]);

        if (cancelled) return;

        if (activeRes.error || templatesRes.error || assignedRes.error) {
          setError("No se pudieron cargar las métricas.");
          setMetrics(null);
          return;
        }

        const activeRows = (activeRes.data as { total_count: number }[]) ?? [];

        setMetrics({
          activeMembers: activeRows[0]?.total_count ?? 0,
          routineTemplates: templatesRes.count ?? 0,
          assignedThisWeek: assignedRes.count ?? 0,
        });
      } catch {
        if (!cancelled) {
          setError("No se pudieron cargar las métricas.");
          setMetrics(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return { metrics, loading, error };
}
