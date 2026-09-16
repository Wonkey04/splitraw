import { supabase } from "@/lib/supabase";

/**
 * A donde manda el login a cada rol. Hasta que existio el TRAINER esto era
 * siempre "/dashboard"; ahora /dashboard tiene un guard que cierra la sesion
 * de cualquiera que no sea GYM_OWNER, asi que mandar ahi a un trainer lo
 * dejaba afuera apenas se logueaba.
 *
 * Sin fila en user_profiles: la cuenta de auth existe pero create_gym_with_
 * owner() nunca corrió (el dueño cerró /create-gym a mitad de camino). No es
 * un rol más, es una cuenta incompleta — organization_id recién existe
 * cuando esa RPC termina — así que el destino es terminar el registro, no
 * el dashboard (que antes quedaba en blanco esperando un profile que nunca
 * iba a llegar).
 *
 * Con fila pero organization_id NULL: desde delete_organization_cascade()
 * (baja de gimnasio) organization_id/branch_id dejan de ser NOT NULL a
 * propósito — cuando un dueño da de baja su gimnasio, sus entrenadores NO
 * se borran, quedan con la cuenta viva pero sin organización. Mismo
 * destino que "sin perfil" no corresponde (el perfil existe, con rol y
 * todo), así que va a una pantalla propia.
 */
export async function landingPathForCurrentUser(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return "/";

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return "/create-gym";
  if (!profile.organization_id) return "/no-organization";
  return profile.role === "TRAINER" ? "/trainer" : "/dashboard";
}
