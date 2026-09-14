import type { Session } from "@supabase/supabase-js";

/**
 * Máximo que puede durar una sesión sin volver a loguearse.
 *
 * Supabase renueva el access token solo cada hora, así que sin esto una
 * sesión queda viva indefinidamente mientras se siga abriendo la app — en
 * una compu del gimnasio eso es una cuenta abierta para siempre.
 *
 * Es UNA constante a propósito: si mañana el número cambia, se cambia acá
 * (y en apps/mobile/utils/sessionExpiry.ts, que es su espejo).
 */
export const SESSION_MAX_AGE_HOURS = 12;

const MAX_AGE_MS = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;

/**
 * Respaldo de `user.last_sign_in_at`, por si viniera vacío.
 *
 * Por qué no se usa el `iat` del JWT: el access token se refresca solo cada
 * hora, así que su `iat` se renueva y nunca llegaría al límite. Lo que hace
 * falta es el momento del LOGIN, que no se mueve con el refresh.
 */
const LOGIN_AT_KEY = "splitraw_login_at";

function readStoredLoginAt(): number | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LOGIN_AT_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    // localStorage puede tirar (modo privado, storage bloqueado). Sin dato
    // se cae al camino de "no puedo probar la edad" de abajo.
    return null;
  }
}

export function rememberLogin(session: Session | null): void {
  if (typeof window === "undefined" || !session) return;

  try {
    const signedInAt = session.user?.last_sign_in_at;
    const at = signedInAt ? new Date(signedInAt).getTime() : Date.now();
    window.localStorage.setItem(LOGIN_AT_KEY, String(Number.isFinite(at) ? at : Date.now()));
  } catch {
    // Ídem: no poder guardar esto no puede romper el login.
  }
}

export function forgetLogin(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(LOGIN_AT_KEY);
  } catch {
    // Nada que hacer.
  }
}

/**
 * true solo cuando se puede PROBAR que la sesión es vieja.
 *
 * Si no hay forma de saber cuándo fue el login (sin last_sign_in_at y sin
 * dato guardado), devuelve false: echar a alguien por las dudas es peor que
 * dejar una sesión de más, y en el próximo login ya queda el timestamp.
 */
export function isSessionExpired(session: Session | null): boolean {
  if (!session) return false;

  const signedInAt = session.user?.last_sign_in_at;
  const loginAt = signedInAt ? new Date(signedInAt).getTime() : readStoredLoginAt();

  if (loginAt === null || !Number.isFinite(loginAt)) return false;

  return Date.now() - loginAt > MAX_AGE_MS;
}
