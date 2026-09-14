import { supabase } from "@/lib/supabase";

/**
 * Nombre visible de un socio: "Nombre Apellido" si tiene perfil, y el email
 * si no.
 *
 * Vive acá y no adentro de una pantalla porque lo necesitan dos flujos
 * distintos (la pantalla de asignar rutina y el form de crear rutina cuando
 * viene con ?assignToMemberId), y en los dos el dato sale del mismo lugar:
 * `members` NO tiene columna de nombre — está en user_profiles, ligado por
 * members.user_id. Hay socios sin fila en user_profiles, por eso el fallback
 * al email no es defensivo de más.
 */
export async function fetchMemberName(memberId: string): Promise<string | null> {
  const { data: member } = await supabase
    .from("members")
    .select("user_id, email")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) return null;

  const { user_id: userId, email } = member as { user_id: string | null; email: string };

  if (!userId) return email;

  const { data: memberProfile } = await supabase
    .from("user_profiles")
    .select("name, surname")
    .eq("id", userId)
    .maybeSingle();

  const fullName = memberProfile
    ? `${memberProfile.name ?? ""} ${memberProfile.surname ?? ""}`.trim()
    : "";

  return fullName || email;
}
