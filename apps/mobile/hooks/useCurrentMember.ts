import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Member } from "@/types";

// La fila de `members` del usuario logueado (members.user_id == auth uid).
//
// maybeSingle() y no single(): con single(), "este usuario todavía no se
// vinculó a ningún gimnasio" y "la query falló" caían en el mismo error
// genérico, y no había forma de distinguirlos desde afuera. Ahora `member`
// en null con `error` en null significa exactamente "no vinculado" —que es
// un estado normal, no una falla— y la app lo manda a /link-gym.
export function useCurrentMember(userId: string | null | undefined) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setMember(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const { data, error: fetchError } = await supabase
          .from("members")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (cancelled) return;

        if (fetchError) {
          setError("No se pudo cargar tu perfil de miembro.");
        } else {
          setMember((data as Member | null) ?? null);
        }
      } catch {
        // fetch rechaza (en vez de resolver con error) cuando no hay red.
        if (!cancelled) setError("Sin conexión.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { member, loading, error };
}
