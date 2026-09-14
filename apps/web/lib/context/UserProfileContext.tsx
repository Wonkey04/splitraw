"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import type { UserProfile } from "@/lib/types";

interface UserProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  /**
   * Vuelve a leer el perfil de la base. Lo usa la pantalla de Perfil despues
   * de guardar: sin esto, el nav y el resto de las pantallas siguen
   * mostrando el nombre viejo hasta que el usuario recarga.
   */
  refresh: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextValue>({
  profile: null,
  loading: true,
  refresh: async () => {},
});

// Trae el user_profiles del usuario logueado una sola vez y lo comparte
// con todas las paginas de /dashboard. Asi cada pagina sabe su
// organization_id/branch_id real, sin constantes hardcodeadas.
export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    try {
      const { data } = await supabase.from("user_profiles").select("*").eq("id", user.id).single();
      setProfile(data as UserProfile | null);
    } catch {
      // Ver el comentario del efecto de abajo: una refresh fallida no puede
      // borrar el perfil que ya estaba cargado.
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        const { data } = await supabase.from("user_profiles").select("*").eq("id", user!.id).single();
        if (!cancelled) setProfile(data as UserProfile | null);
      } catch {
        // Si el fetch rechaza (ej. red caida) igual hay que bajar loading:
        // si no, profileLoading queda en true para siempre y las paginas
        // que dependen de el (members, routines) quedan trabadas en
        // "Cargando..." de por vida.
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return (
    <UserProfileContext.Provider value={{ profile, loading: authLoading || loading, refresh }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
