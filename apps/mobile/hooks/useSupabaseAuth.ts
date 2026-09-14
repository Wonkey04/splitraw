import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { checkEmailExists, createMemberProfile, GymAuthError, resolveGymCode } from "@/utils/gymAuth";
import { saveGymSession } from "@/utils/storage";

interface LoginParams {
  gymCode: string;
  email: string;
  password: string;
}

interface SignupParams extends LoginParams {
  name: string;
  surname: string;
  phone: string;
}

// Orquesta login/signup contra Supabase Auth + gym_code. Devuelve true/false
// en vez de tirar: login.tsx decide qué hacer (navegar a /home) sin tener
// que lidiar con try/catch de nuevo ahí.
export function useSupabaseAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login({ gymCode, email, password }: LoginParams): Promise<boolean> {
    setError(null);
    setLoading(true);
    try {
      const { organizationId, branchId } = await resolveGymCode(gymCode);
      const trimmedEmail = email.trim();

      const exists = await checkEmailExists(trimmedEmail);
      if (!exists) {
        setError("Email no registrado.");
        return false;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError || !data.user) {
        setError("Contraseña incorrecta.");
        return false;
      }

      await saveGymSession({
        userId: data.user.id,
        organizationId,
        branchId,
        gymCode: gymCode.trim().toUpperCase(),
      });

      return true;
    } catch (err) {
      setError(err instanceof GymAuthError ? err.message : "Sin conexión. Intenta de nuevo.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function signup({ gymCode, email, password, name, surname, phone }: SignupParams): Promise<boolean> {
    setError(null);
    setLoading(true);
    try {
      const { organizationId, branchId } = await resolveGymCode(gymCode);
      const trimmedEmail = email.trim();

      const exists = await checkEmailExists(trimmedEmail);
      if (exists) {
        setError("Email ya registrado.");
        return false;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (signUpError || !data.user || !data.session) {
        setError("No se pudo crear la cuenta. Intentá de nuevo.");
        return false;
      }

      await createMemberProfile({
        userId: data.user.id,
        organizationId,
        branchId,
        email: trimmedEmail,
        name,
        surname,
        phone,
      });

      await saveGymSession({
        userId: data.user.id,
        organizationId,
        branchId,
        gymCode: gymCode.trim().toUpperCase(),
      });

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
