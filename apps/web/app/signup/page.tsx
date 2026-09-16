"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button, Card, Input } from "@/components/ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

// Paso 1 de 2 del alta self-serve del dueño: crear la cuenta.
//
// Antes esto vivía adentro de /create-gym, mezclado con la creación de la
// organización en un solo formulario de seis campos y cinco escrituras. Se
// separó porque son dos cosas distintas que fallan distinto: si el signUp
// falla, no se creó nada; si falla la organización, la cuenta YA existe y el
// dueño tiene que poder volver y seguir desde ahí en vez de quedar trabado
// (reintentar con el mismo email fallaba en signUp y no había salida).
//
// El nombre se guarda en el metadata del usuario de auth y no en
// user_profiles: esa fila tiene organization_id NOT NULL, así que todavía no
// puede existir. Nace recién en create_gym_with_owner().
export default function SignupPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Quien ya tiene sesión no tiene nada que hacer acá: sigue al paso 2, que
  // a su vez lo manda al dashboard si ya tiene gimnasio.
  useEffect(() => {
    if (!loading && session && !submitting) {
      router.replace("/create-gym");
    }
  }, [loading, session, submitting, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password) {
      setError("Completá todos los campos.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError("El email no es válido.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña tiene que tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }

    setSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim(), surname: surname.trim() } },
    });

    if (signUpError) {
      setSubmitting(false);
      setError(signUpError.message);
      return;
    }
    if (!data.session) {
      // Pasa si la confirmación por email está activada en Supabase: la
      // cuenta existe pero no hay sesión, y sin sesión no se puede crear la
      // organización. Se dice en vez de mandarlo a una pantalla que va a
      // fallar con un error de permisos incomprensible.
      setSubmitting(false);
      setError("Revisá tu email para confirmar la cuenta y después iniciá sesión.");
      return;
    }

    router.push("/create-gym");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-textSecondary">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bgSecondary p-8">
      <Card className="w-full max-w-[400px]">
        <Link href="/" className="mb-4 inline-block text-body text-accent hover:text-accentHover">
          ← Atrás
        </Link>

        <h1 className="mb-2 text-h2">Creá tu cuenta</h1>
        <p className="mb-6 text-body text-textSecondary">
          Paso 1 de 2. Después vas a cargar los datos de tu gimnasio.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan"
              autoComplete="given-name"
            />
            <Input
              label="Apellido"
              type="text"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="Pérez"
              autoComplete="family-name"
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@gym.com"
            autoComplete="email"
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />

          {error && <p className="text-small text-error">{error}</p>}

          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? "Creando cuenta..." : "Continuar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-body text-textSecondary">
          ¿Ya tenés cuenta?{" "}
          <Link href="/" className="rounded text-accent hover:text-accentHover">
            Iniciá sesión
          </Link>
        </p>
      </Card>
    </div>
  );
}
