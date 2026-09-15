import { supabase } from "@/lib/supabase";

// Errores esperados del flujo de auth/vinculación. login.tsx y link-gym.tsx
// los muestran tal cual; cualquier excepción que NO sea GymAuthError se
// interpreta como falla de red ("Sin conexión").
export class GymAuthError extends Error {}

// Chequeo de email vía RPC: el caller todavía no tiene sesión, así que no
// puede depender de RLS. Devuelve solo un boolean, nunca datos del usuario.
//
// La función apunta a auth.users desde 0015. Antes consultaba `members`, o
// sea "¿este email ya está vinculado a un gimnasio?". Con el flujo nuevo ese
// estado —registrado pero sin vincular— es el NORMAL, y la app le decía
// "Email no registrado" a alguien que sí tenía cuenta.
export async function checkEmailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("email_is_registered", {
    check_email: email.trim(),
  });

  if (error) {
    throw new GymAuthError("No se pudo verificar el email.");
  }

  return Boolean(data);
}

export interface MemberLink {
  memberId: string;
  organizationId: string;
  organizationName: string;
  branchId: string | null;
  branchName: string | null;
  email: string | null;
  activationExpiresAt: string | null;
  isExpired: boolean;
}

// ¿Este usuario tiene un vínculo de socio? Es LA pregunta de la bifurcación
// de arranque: null -> pantalla de vinculación, objeto -> home.
//
// Se consulta contra la base y no contra AsyncStorage a propósito: el vínculo
// es un hecho del servidor, no un dato de sesión. Si viviera en el cliente,
// borrar los datos de la app o cambiar de teléfono te desvincularía, y un
// socio dado de baja seguiría entrando hasta que limpiara el cache.
export async function fetchMemberLink(): Promise<MemberLink | null> {
  const { data, error } = await supabase.rpc("my_member_link");

  if (error) {
    throw new GymAuthError("No se pudo verificar tu gimnasio.");
  }

  const row = data?.[0];
  if (!row) return null;

  return {
    memberId: row.member_id as string,
    organizationId: row.organization_id as string,
    organizationName: row.organization_name as string,
    branchId: (row.branch_id as string | null) ?? null,
    branchName: (row.branch_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    activationExpiresAt: (row.activation_expires_at as string | null) ?? null,
    isExpired: Boolean(row.is_expired),
  };
}

export type LinkStatus = "linked" | "already_linked" | "invalid" | "limit_reached";

export interface LinkResult {
  status: LinkStatus;
  organizationName: string | null;
  message: string | null;
}

// El evento de vinculación: pasa UNA vez en la vida del usuario. Toda la
// lógica (validar el código, chequear el cupo del plan, crear `members` y
// `user_profiles` con el rol forzado a MEMBER) vive en la RPC, en una sola
// transacción. Antes eran dos inserts sueltos desde el cliente: si el segundo
// fallaba quedaba un perfil sin socio, y el rol viajaba como parámetro.
export async function linkMemberByCode(code: string, name?: string | null): Promise<LinkResult> {
  const { data, error } = await supabase.rpc("link_member_by_code", {
    p_code: code.trim().toUpperCase(),
    p_name: name?.trim() || null,
  });

  if (error) {
    throw new GymAuthError("No se pudo verificar el código. Intentá de nuevo.");
  }

  const row = data?.[0];
  if (!row) {
    throw new GymAuthError("No se pudo verificar el código. Intentá de nuevo.");
  }

  return {
    status: row.status as LinkStatus,
    organizationName: (row.organization_name as string | null) ?? null,
    message: (row.message as string | null) ?? null,
  };
}
