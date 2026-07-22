"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import { createGymInvitationCode } from "@/lib/invitationCode";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pagina "Crear Gimnasio". Un owner nuevo se registra y en el mismo paso
// crea su organizacion + sucursal por defecto + su user_profile (GYM_OWNER).
// Al final queda logueado y va directo al dashboard.
export default function CreateGymPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gymName, setGymName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Solo redirige si ya habia sesion ANTES de tocar el formulario. Una vez
  // que se intenta enviar el form, `hasSubmitted` queda en true para
  // siempre: signUp() crea la sesion antes de terminar de crear
  // organizacion/branch/profile, y si algun insert falla despues no
  // queremos que este efecto tape el error mandando igual al dashboard.
  useEffect(() => {
    if (!loading && session && !hasSubmitted) {
      router.replace("/dashboard");
    }
  }, [loading, session, hasSubmitted, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password || !confirmPassword || !firstName || !lastName || !gymName) {
      setError("Completá todos los campos.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError("El email no es válido.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setHasSubmitted(true);
    setSubmitting(true);

    // 1. Crea el usuario en Supabase Auth.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setSubmitting(false);
      setError(signUpError.message);
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      setSubmitting(false);
      setError("No se pudo crear la cuenta. Intentá de nuevo.");
      return;
    }

    // 2. Crea la organizacion (el gimnasio).
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: gymName })
      .select()
      .single();

    if (orgError || !org) {
      setSubmitting(false);
      setError("No se pudo crear el gimnasio: " + (orgError?.message ?? "error desconocido"));
      return;
    }

    // 3. Crea la sucursal por defecto de esa organizacion.
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .insert({ organization_id: org.id, name: "Sucursal Principal" })
      .select()
      .single();

    if (branchError || !branch) {
      setSubmitting(false);
      setError("No se pudo crear la sucursal: " + (branchError?.message ?? "error desconocido"));
      return;
    }

    // 4. Crea el perfil del owner, ligado a la org y sucursal recien creadas.
    // `phone` es NOT NULL en la base pero este form no lo pide, va en 0.
    const { error: profileError } = await supabase.from("user_profiles").insert({
      id: userId,
      organization_id: org.id,
      branch_id: branch.id,
      role: "GYM_OWNER",
      name: firstName,
      surname: lastName,
      phone: 0,
    });

    if (profileError) {
      setSubmitting(false);
      setError("No se pudo crear tu perfil: " + profileError.message);
      return;
    }

    // 5. Auto-genera el codigo de invitacion permanente del gimnasio.
    // Si falla (ej. RLS), NO bloqueamos el signup: el owner ya quedo creado
    // y en /members hay un boton de respaldo para generarlo a mano. Solo lo
    // dejamos registrado en consola para poder debuggear.
    const { error: codeError } = await createGymInvitationCode(org.id);
    if (codeError) {
      console.error("No se pudo auto-generar el código de invitación:", codeError);
    }

    setSubmitting(false);
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
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="card w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">SplitRaw Admin</h1>
        <p className="mb-6 text-sm text-text-secondary">Creá tu gimnasio.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">Nombre del gimnasio</label>
            <input
              type="text"
              className="input-field"
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              placeholder="Gym Fenix"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-text-secondary">Nombre</label>
              <input
                type="text"
                className="input-field"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Juan"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-secondary">Apellido</label>
              <input
                type="text"
                className="input-field"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez"
              />
            </div>
          </div>

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

          <div>
            <label className="mb-1 block text-sm text-text-secondary">Confirmar Password</label>
            <input
              type="password"
              className="input-field"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Creando gimnasio..." : "Crear Gimnasio"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          ¿Ya tenés cuenta?{" "}
          <Link href="/" className="text-primary">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
