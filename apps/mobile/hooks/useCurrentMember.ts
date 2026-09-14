import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Member } from "@/types";

// Resolves the `members` row for the logged-in auth user (members.user_id
// == auth user id), same relationship apps/web relies on for user_profiles.
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
          .single();

        if (cancelled) return;

        if (fetchError) {
          setError("No se encontró tu perfil de miembro.");
        } else {
          setMember(data as Member);
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
