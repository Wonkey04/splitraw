import { supabase } from "@/lib/supabase";
import type { GymInvitationCode } from "@/lib/types";

// Charset sin caracteres ambiguos: sacamos O/0 y I/1 para que nadie se
// confunda al tipear el codigo en la app mobile.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_INSERT_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "23505"; // Postgres: violacion de constraint UNIQUE.

// Genera un codigo aleatorio de 6 caracteres, alfanumerico y en mayusculas.
export function generateInvitationCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}

// Resultado uniforme para que el que llama pueda mostrar el error real
// (no tragarlo, que fue justamente el bug original).
export interface CreateInvitationResult {
  invitation: GymInvitationCode | null;
  error: string | null;
}

// Crea el codigo de invitacion permanente de una organizacion:
//   1. Inserta una fila en gym_invitation_codes { organization_id, code }.
//      Si choca con el UNIQUE de `code`, reintenta con otro codigo (hasta 5).
//   2. Apunta organizations.invitation_code_id a la fila recien creada.
// Usa supabase-js del lado cliente con la sesion del owner (RLS decide si
// puede insertar en su propia organizacion).
export async function createGymInvitationCode(
  organizationId: string
): Promise<CreateInvitationResult> {
  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
    const code = generateInvitationCode();

    const { data: inserted, error: insertError } = await supabase
      .from("gym_invitation_codes")
      .insert({ organization_id: organizationId, code })
      .select()
      .single();

    // Colision de codigo: probamos con otro sin devolver error todavia.
    if (insertError?.code === UNIQUE_VIOLATION) {
      continue;
    }

    // Cualquier otro error (ej. RLS bloqueando el insert) se devuelve para
    // que la UI lo muestre, en vez de quedar en silencio.
    if (insertError || !inserted) {
      return {
        invitation: null,
        error: insertError?.message ?? "No se pudo generar el código.",
      };
    }

    const invitation = inserted as GymInvitationCode;

    // Dejamos organizations.invitation_code_id apuntando al codigo activo.
    await supabase
      .from("organizations")
      .update({ invitation_code_id: invitation.id })
      .eq("id", organizationId);

    return { invitation, error: null };
  }

  // Agotamos los reintentos: todos los codigos generados chocaron.
  return {
    invitation: null,
    error: "No se pudo generar un código único, probá de nuevo.",
  };
}
