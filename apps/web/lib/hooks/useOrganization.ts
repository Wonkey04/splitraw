"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { Organization } from "@/lib/types";

// La organización del usuario logueado: nombre, plan y código de vinculación.
//
// Tres pantallas la necesitan (el home del dueño para mostrar el código, el
// listado de rutinas para el header, y la card del código para saber si el
// plan permite editarlo). Se centraliza acá para no repetir el select ni el
// manejo de error en cada una.
//
// El filtro por id es la segunda barrera, no la única: tras 0013 la policy
// organizations_select_own ya no deja ver ninguna organización ajena.
export function useOrganization() {
  const { profile, loading: profileLoading } = useUserProfile();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const organizationId = profile?.organization_id ?? null;

  const load = useCallback(async () => {
    if (!organizationId) {
      setOrganization(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("organizations")
      .select("id, name, plan, invitation_code, city, province")
      .eq("id", organizationId)
      .maybeSingle();

    if (fetchError) {
      setError("No se pudo cargar los datos del gimnasio.");
      setOrganization(null);
    } else {
      setError(null);
      setOrganization(data as Organization | null);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (profileLoading) return;
    void load();
  }, [profileLoading, load]);

  // Para que la card del código pueda reflejar una edición sin recargar todo.
  const setInvitationCode = useCallback((code: string) => {
    setOrganization((prev) => (prev ? { ...prev, invitation_code: code } : prev));
  }, []);

  return { organization, loading: loading || profileLoading, error, refresh: load, setInvitationCode };
}
