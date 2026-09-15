"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import { landingPathForCurrentUser } from "@/lib/roleRedirect";
import { Button, Card, Input } from "@/components/ui";

// Login page. Signs the user in via Supabase Auth (email/password) y lo
// manda al panel que le corresponde por rol: /dashboard el GYM_OWNER,
// /trainer el TRAINER.
export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      landingPathForCurrentUser().then((path) => router.replace(path));
    }
  }, [loading, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Completá email y password.");
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setSubmitting(false);

    if (signInError) {
      setError("Email o password incorrectos.");
      return;
    }

    router.push(await landingPathForCurrentUser());
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-textSecondary">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bgSecondary p-4">
      <Card className="w-full max-w-[400px]">
        <h1 className="mb-2 text-h2">SplitRaw Admin</h1>
        <p className="mb-6 text-body text-textSecondary">Ingresá con tu cuenta de gimnasio.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@gym.com"
          />

          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error && <p className="text-small text-error">{error}</p>}

          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        <p className="mt-6 text-center text-body text-textSecondary">
          ¿No tenés gimnasio?{" "}
          <Link href="/signup" className="rounded text-accent hover:text-accentHover">
            Creá tu gimnasio
          </Link>
        </p>
      </Card>
    </div>
  );
}
