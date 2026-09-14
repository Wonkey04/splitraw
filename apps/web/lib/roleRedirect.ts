import { supabase } from "@/lib/supabase";

/**
 * A donde manda el login a cada rol. Hasta que existio el TRAINER esto era
 * siempre "/dashboard"; ahora /dashboard tiene un guard que cierra la sesion
 * de cualquiera que no sea GYM_OWNER, asi que mandar ahi a un trainer lo
 * dejaba afuera apenas se logueaba.
 */
export async function landingPathForCurrentUser(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return "/";

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return profile?.role === "TRAINER" ? "/trainer" : "/dashboard";
}
