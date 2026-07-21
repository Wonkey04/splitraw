"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";

// Login page. Signs the gym owner in via Supabase Auth (email/password)
// and redirects to the dashboard on success.
export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      router.replace("/dashboard");
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

    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-secondary">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">SplitRaw Admin</h1>
        <p className="mb-6 text-sm text-text-secondary">Ingresá con tu cuenta de gimnasio.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">Email</label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@gym.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">Password</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Ingresando..." : "Login"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          ¿No tenés gimnasio?{" "}
          <Link href="/create-gym" className="text-primary">
            Creá tu gimnasio
          </Link>
        </p>
      </div>
    </div>
  );
}
