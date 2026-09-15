import { supabase } from "@/lib/supabase";

// Charset sin caracteres ambiguos: se excluyen O/0 y I/1 porque el código se
// dicta en voz alta en el mostrador del gimnasio.
export const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// 8 caracteres es el formato nuevo. El rango 6-8 existe porque los códigos de
// 6 ya repartidos al gimnasio piloto siguen siendo válidos: invalidarlos de
// golpe dejaría afuera a los socios que todavía no se registraron.
export const CODE_LENGTH = 8;
export const INVITATION_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6,8}$/;

const UNIQUE_VIOLATION = "23505"; // Postgres: violación de constraint UNIQUE.

// LA GENERACIÓN YA NO VIVE ACÁ.
//
// Antes este módulo generaba el código con Math.random() en el browser y lo
// insertaba en gym_invitation_codes. Dos problemas: Math.random() es
// predecible, y el código es el único secreto que separa un gimnasio de otro;
// y el insert chocaba contra UNIQUE(organization_id) al "Regenerar", lo que
// dejaba al gimnasio sin código activo (el viejo ya estaba soft-deleted).
//
// Ahora el código lo genera generate_invitation_code() en Postgres, con
// gen_random_bytes, y lo asigna create_gym_with_owner() al crear el gimnasio.
// Acá queda sólo lo que es del cliente: validar el campo editable del plan Pro.

export function isValidInvitationCode(code: string): boolean {
  return INVITATION_CODE_RE.test(code.trim().toUpperCase());
}

// Mensaje único para el campo editable, así las dos pantallas que lo usen
// dicen lo mismo.
export function invitationCodeError(code: string): string | null {
  const value = code.trim().toUpperCase();
  if (!value) return "Ingresá un código.";
  if (value.length < 6 || value.length > 8) {
    return "El código tiene que tener entre 6 y 8 caracteres.";
  }
  if (!INVITATION_CODE_RE.test(value)) {
    return "Solo letras y números, sin las ambiguas (I, O, 0, 1).";
  }
  return null;
}

export interface UpdateInvitationCodeResult {
  code: string | null;
  error: string | null;
}

// Cambia el código del gimnasio. Disponible solo en plan Pro/Enterprise; el
// permiso real lo aplica la policy organizations_update_owner (0013), esto es
// la validación de formato y el mapeo del error a algo legible.
export async function updateInvitationCode(
  organizationId: string,
  rawCode: string
): Promise<UpdateInvitationCodeResult> {
  const code = rawCode.trim().toUpperCase();

  const formatError = invitationCodeError(code);
  if (formatError) return { code: null, error: formatError };

  const { data, error } = await supabase
    .from("organizations")
    .update({ invitation_code: code })
    .eq("id", organizationId)
    .select("invitation_code")
    .single();

  if (error) {
    // El UNIQUE es global: el código de un gimnasio no puede repetirse en
    // otro, porque es lo único que el socio tipea para elegir dónde entrar.
    if (error.code === UNIQUE_VIOLATION) {
      return { code: null, error: "Ese código ya está en uso. Probá con otro." };
    }
    return { code: null, error: error.message };
  }

  return { code: (data?.invitation_code as string) ?? code, error: null };
}
