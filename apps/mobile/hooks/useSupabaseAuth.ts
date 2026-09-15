import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { checkEmailExists, GymAuthError } from "@/utils/gymAuth";

interface LoginParams {
  email: string;
  password: string;
}

interface SignupParams extends LoginParams {
  name: string;
}

// Login y registro del socio. Devuelve true/false en vez de tirar: login.tsx
// decide a dónde navegar sin volver a lidiar con try/catch.
//
// EL CÓDIGO DE GIMNASIO YA NO SE PIDE ACÁ.
//
// Antes se resolvía en CADA login y en cada signup. Eso estaba mal por dos
// razones. La de diseño: el código es un evento de vinculación que pasa UNA
// vez en la vida del usuario, no un campo del login — al socio se le pedía
// cada vez un dato que no tiene por qué recordar. Y la de fondo: no validaba
// nada. El código se resolvía, se cacheaba en AsyncStorage y NUNCA se
// comparaba contra members.organization_id, así que loguearse con el código
// de otro gimnasio funcionaba igual.
//
// Ahora el vínculo vive en la base (tabla `members`) y se consulta con
// my_member_link() al arrancar la app. El signup crea sólo el usuario de
// auth; `members` y `user_profiles` los crea link_member_by_code() en una
// sola transacción, en vez de los dos inserts de cliente sin transacción que
// había antes (si el segundo fallaba, quedaba un perfil sin socio).
export function useSupabaseAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login({ email, password }: LoginParams): Promise<boolean> {
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError || !data.user) {
        // Un solo mensaje para "no existe" y "contraseña incorrecta": si se
        // distinguieran, el formulario serviría para averiguar qué emails
        // están registrados.
        setError("Email o contraseña incorrectos.");
        return false;
      }

      return true;
    } catch (err) {
      setError(err instanceof GymAuthError ? err.message : "Sin conexión. Intenta de nuevo.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function signup({ email, password, name }: SignupParams): Promise<boolean> {
    setError(null);
    setLoading(true);
    try {
      const trimmedEmail = email.trim();

      const exists = await checkEmailExists(trimmedEmail);
      if (exists) {
        setError("Ese email ya está registrado. Iniciá sesión.");
        return false;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        // El nombre viaja en el metadata del usuario de auth porque todavía
        // no hay dónde guardarlo: user_profiles.organization_id es NOT NULL,
        // así que esa fila no puede existir hasta que el socio se vincule.
        // La pantalla de vinculación lo lee de acá y se lo pasa a la RPC.
        options: { data: { name: name.trim() } },
      });

      if (signUpError || !data.user) {
        setError(signUpError?.message ?? "No se pudo crear la cuenta. Intentá de nuevo.");
        return false;
      }
      if (!data.session) {
        // Pasa si la confirmación por email está activada en Supabase.
        setError("Revisá tu email para confirmar la cuenta y después ingresá.");
        return false;
      }

      return true;
    } catch (err) {
      setError(err instanceof GymAuthError ? err.message : "Sin conexión. Intenta de nuevo.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, setError, login, signup };
}
