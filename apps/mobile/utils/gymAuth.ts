import { supabase } from "@/lib/supabase";

// Errores esperados del flujo de login/signup (código inválido, email ya
// registrado, etc). login.tsx los muestra tal cual; cualquier excepción que
// NO sea GymAuthError se interpreta como falla de red ("Sin conexión").
export class GymAuthError extends Error {}

interface GymCodeResolution {
  organizationId: string;
  branchId: string;
}

// Resuelve un gym_code a su organización + sucursal por defecto vía RPC
// (supabase/migrations/0005_gym_signup_rpc.sql). Corre ANTES de cualquier
// signIn/signUp -> el caller todavía no tiene sesión, así que esto no puede
// depender de RLS sobre las tablas: la función SECURITY DEFINER es la que
// hace el lookup con privilegios propios y devuelve solo lo necesario.
export async function resolveGymCode(code: string): Promise<GymCodeResolution> {
  const { data, error } = await supabase.rpc("resolve_gym_code", {
    p_code: code.trim(),
  });

  if (error) {
    throw new GymAuthError("No se pudo verificar el código de gimnasio.");
  }

  const row = data?.[0];
  if (!row || !row.organization_id) {
    throw new GymAuthError("Código de gimnasio no válido.");
  }
  if (row.is_expired) {
    throw new GymAuthError("Código inválido (expirado).");
  }

  return { organizationId: row.organization_id as string, branchId: row.branch_id as string };
}

// También vía RPC (mismo motivo: sin sesión todavía en login, y en signup
// no queremos abrir SELECT anónimo sobre members). Devuelve solo un
// boolean, nunca los datos del member.
export async function checkEmailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("email_is_registered", {
    check_email: email.trim(),
  });

  if (error) {
    throw new GymAuthError("No se pudo verificar el email.");
  }

  return Boolean(data);
}

interface CreateMemberProfileParams {
  userId: string;
  organizationId: string;
  branchId: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
}

// Crea el user_profiles (role: MEMBER) + members del nuevo usuario. Se
// llama recién después de un signUp exitoso (ya autenticado), así que acá
// sí aplican las RLS normales de self-insert (user_id/id = auth.uid()).
export async function createMemberProfile({
  userId,
  organizationId,
  branchId,
  email,
  name,
  surname,
  phone,
}: CreateMemberProfileParams): Promise<void> {
  const { error: profileError } = await supabase.from("user_profiles").insert({
    id: userId,
    organization_id: organizationId,
    branch_id: branchId,
    role: "MEMBER",
    name,
    surname,
    phone: Number(phone),
  });

  if (profileError) {
    throw new GymAuthError("No se pudo completar el registro. Intentá de nuevo.");
  }

  const { error: memberError } = await supabase.from("members").insert({
    user_id: userId,
    organization_id: organizationId,
    branch_id: branchId,
    email,
  });

  if (memberError) {
    throw new GymAuthError("No se pudo completar el registro. Intentá de nuevo.");
  }
}
