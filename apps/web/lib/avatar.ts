import { supabase } from "@/lib/supabase";

/**
 * Foto de perfil: subida al bucket `avatars` y URL pública resultante.
 *
 * La convención de path NO es libre: las policies de 0012 comparan la
 * primera carpeta del path contra el uid del que sube
 * (`avatars/<auth.uid()>/<archivo>`). Cambiar esto acá sin cambiar la
 * migración hace que Storage rechace la subida.
 *
 * apps/mobile tiene su propia copia de esta lógica (utils/avatar.ts): web y
 * mobile no comparten código hoy — `packages/shared` está vacío y React DOM
 * y React Native no comparten componentes — así que se mantienen en espejo,
 * igual que types.ts.
 */
export const AVATAR_BUCKET = "avatars";

/** 5 MB: una foto de perfil no necesita más, y el límite evita subir un RAW. */
const MAX_BYTES = 5 * 1024 * 1024;

export interface UploadAvatarResult {
  url: string | null;
  error: string | null;
}

export async function uploadAvatar(userId: string, file: File): Promise<UploadAvatarResult> {
  if (!file.type.startsWith("image/")) {
    return { url: null, error: "El archivo tiene que ser una imagen." };
  }
  if (file.size > MAX_BYTES) {
    return { url: null, error: "La imagen no puede pesar más de 5 MB." };
  }

  // El nombre lleva timestamp en vez de ser fijo ("avatar.jpg") para no
  // pelear con el cache del CDN: la URL pública de un archivo pisado sigue
  // devolviendo la foto vieja hasta que el cache expira.
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

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
