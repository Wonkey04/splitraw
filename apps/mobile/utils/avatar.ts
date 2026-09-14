import { supabase } from "@/lib/supabase";

/**
 * Foto de perfil, espejo de apps/web/lib/avatar.ts.
 *
 * Por qué duplicado y no compartido: `packages/shared` está vacío y React
 * Native no comparte componentes con React DOM — lo mismo que ya pasa con
 * types.ts. Lo que SÍ tiene que quedar idéntico es la convención de path:
 * las policies de 0012 comparan la primera carpeta contra el uid del que
 * sube (`avatars/<auth.uid()>/<archivo>`), así que cambiarla acá rompe la
 * subida.
 *
 * La diferencia real con la web: acá no hay `File`. ImagePicker devuelve un
 * uri local y su base64, y Storage necesita bytes — de ahí la conversión de
 * abajo.
 */
export const AVATAR_BUCKET = "avatars";

const MAX_BYTES = 5 * 1024 * 1024;

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * base64 -> bytes, a mano.
 *
 * React Native no trae `atob` ni `Buffer`, y el camino habitual
 * (`fetch(uri).arrayBuffer()`) no es confiable con uris `file://` en RN. Son
 * 15 líneas; no vale una dependencia más.
 */
function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array((clean.length * 3) / 4);

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const chunk =
      (BASE64_ALPHABET.indexOf(clean[i]) << 18) |
      (BASE64_ALPHABET.indexOf(clean[i + 1]) << 12) |
      ((clean[i + 2] ? BASE64_ALPHABET.indexOf(clean[i + 2]) : 0) << 6) |
      (clean[i + 3] ? BASE64_ALPHABET.indexOf(clean[i + 3]) : 0);

    bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (clean[i + 2]) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (clean[i + 3]) bytes[byteIndex++] = chunk & 0xff;
  }

  return bytes.subarray(0, byteIndex);
}

export interface UploadAvatarResult {
  url: string | null;
  error: string | null;
}

export async function uploadAvatar(
  userId: string,
  base64: string,
  mimeType: string
): Promise<UploadAvatarResult> {
  const bytes = base64ToBytes(base64);

  if (bytes.byteLength > MAX_BYTES) {
    return { url: null, error: "La imagen no puede pesar más de 5 MB." };
  }

  // Timestamp en el nombre, igual que en web: pisar el archivo deja el CDN
  // devolviendo la foto vieja.
  const extension = mimeType.split("/")[1] || "jpg";
  const path = `${userId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: true });

  if (uploadError) {
    return { url: null, error: "No se pudo subir la foto: " + uploadError.message };
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  return { url: data.publicUrl, error: null };
}

/** Iniciales para el avatar cuando todavía no hay foto. */
export function initialsOf(name?: string | null, surname?: string | null, fallback?: string | null) {
  const first = (name ?? "").trim()[0] ?? "";
  const second = (surname ?? "").trim()[0] ?? "";
  const initials = `${first}${second}`.toUpperCase();

  if (initials) return initials;
  return ((fallback ?? "").trim()[0] ?? "?").toUpperCase();
}
