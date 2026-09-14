"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { forgetLogin, isSessionExpired, rememberLogin } from "@/lib/sessionExpiry";

// Tracks the current Supabase auth session on the client. `loading` stays
// true until the initial session lookup finishes, so pages can show a
// spinner instead of flashing a login redirect.
//
// Ademas caduca las sesiones viejas: Supabase renueva el token solo, asi
// que sin este chequeo una sesion vive para siempre mientras se siga
// abriendo la app. El corte va aca y no en cada layout porque este hook es
// por donde pasan las dos superficies (/dashboard y /trainer) y el login.
// Ver lib/sessionExpiry.ts para el limite y de donde sale la fecha de login.
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();

      if (isSessionExpired(data.session)) {
        await supabase.auth.signOut();
        forgetLogin();
        if (!cancelled) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    }
    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // El timestamp se guarda al loguearse y se borra al salir: es el
      // respaldo para cuando last_sign_in_at viene vacio.
      if (event === "SIGNED_IN") rememberLogin(newSession);
      if (event === "SIGNED_OUT") forgetLogin();

      setSession(newSession);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
