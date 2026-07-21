"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import type { UserProfile } from "@/lib/types";

interface UserProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
}

const UserProfileContext = createContext<UserProfileContextValue>({
  profile: null,
  loading: true,
});

// Trae el user_profiles del usuario logueado una sola vez y lo comparte
// con todas las paginas de /dashboard. Asi cada pagina sabe su
// organization_id/branch_id real, sin constantes hardcodeadas.
export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setProfile(data as UserProfile | null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return (
    <UserProfileContext.Provider value={{ profile, loading: authLoading || loading }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
