import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";

/**
 * Espejo de apps/web/lib/sessionExpiry.ts — mismo límite, misma regla. Si
 * cambia el número, cambia en los dos: el brief pedía explícitamente que el
 * chequeo corra en las dos apps, no en una sola.
 *
 * La única diferencia es el almacenamiento: acá AsyncStorage (asíncrono) en
 * vez de localStorage.
 */
export const SESSION_MAX_AGE_HOURS = 12;

const MAX_AGE_MS = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;

/**
 * Respaldo de `user.last_sign_in_at`. No se usa el `iat` del JWT porque el
 * access token se refresca solo cada hora: su `iat` se renueva y nunca
 * llegaría al límite. Lo que hace falta es el momento del LOGIN.
 */
const LOGIN_AT_KEY = "splitraw_login_at";

export async function rememberLogin(session: Session | null): Promise<void> {
  if (!session) return;

  try {
    const signedInAt = session.user?.last_sign_in_at;
    const at = signedInAt ? new Date(signedInAt).getTime() : Date.now();
    await AsyncStorage.setItem(LOGIN_AT_KEY, String(Number.isFinite(at) ? at : Date.now()));
  } catch {
    // No poder guardar esto no puede romper el login.
  }
}

export async function forgetLogin(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOGIN_AT_KEY);
  } catch {
    // Nada que hacer.
  }
}

/**
 * true solo cuando se puede PROBAR que la sesión es vieja. Sin fecha de
 * login (ni en el user ni guardada) devuelve false: sacar a alguien por las
 * dudas es peor que dejar una sesión de más, y el próximo login ya deja el
 * timestamp.
 */
export async function isSessionExpired(session: Session | null): Promise<boolean> {
  if (!session) return false;

  const signedInAt = session.user?.last_sign_in_at;
  let loginAt: number | null = signedInAt ? new Date(signedInAt).getTime() : null;

  if (loginAt === null) {
    try {
      const raw = await AsyncStorage.getItem(LOGIN_AT_KEY);
      const parsed = raw === null ? NaN : Number(raw);
      loginAt = Number.isFinite(parsed) ? parsed : null;
    } catch {
      loginAt = null;
    }
  }

  if (loginAt === null || !Number.isFinite(loginAt)) return false;

  return Date.now() - loginAt > MAX_AGE_MS;
}
