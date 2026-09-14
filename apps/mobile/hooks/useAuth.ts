import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { clearGymSession } from "@/utils/storage";
import { forgetLogin, isSessionExpired, rememberLogin } from "@/utils/sessionExpiry";

// Tracks the current Supabase auth session on device. `loading` stays true
// until the initial session lookup finishes, so screens can show a splash
// instead of flashing a login redirect.
//
// Ademas caduca las sesiones viejas al abrir la app: supabase-js renueva el
// token solo, asi que sin este chequeo la sesion del celular no vence nunca.
// Mismo limite y misma regla que en la web (utils/sessionExpiry.ts).
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();

      if (await isSessionExpired(data.session)) {
        await supabase.auth.signOut();
        // El contexto de gym cacheado se va con la sesion: si no, el
        // proximo login arranca con la org del usuario anterior.
        await clearGymSession();
        await forgetLogin();

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
      if (event === "SIGNED_IN") void rememberLogin(newSession);
      if (event === "SIGNED_OUT") void forgetLogin();

      setSession(newSession);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
