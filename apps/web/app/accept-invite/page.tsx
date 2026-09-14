"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button, Card, Input } from "@/components/ui";

type InviteStatus = "valid" | "expired" | "used" | "not_found";

interface ResolvedInvitation {
  status: InviteStatus;
  email: string | null;
  invited_name: string | null;
  organization_name: string | null;
  expires_at: string | null;
}

const errorCopy: Record<Exclude<InviteStatus, "valid">, string> = {
  not_found: "Invitación inválida.",
  expired: "Invitación expirada, pedile al gimnasio que te reenvíe la invitación.",
  used: "Esta invitación ya fue usada.",
};

// Pantalla publica (sin sesion): el trainer abre el link del mail, se valida
// el token contra resolve_trainer_invitation() y, si esta vigente, elige
// contrasena. El alta del perfil TRAINER la hace accept_trainer_invitation()
// del lado del server, con la org/sucursal que venian en el token.
function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [invitation, setInvitation] = useState<ResolvedInvitation | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInvitation({
        status: "not_found",
        email: null,
        invited_name: null,
        organization_name: null,
        expires_at: null,
      });
      setChecking(false);
      return;
    }

    async function resolveToken() {
      try {
        const { data, error } = await supabase.rpc("resolve_trainer_invitation", {
          p_token: token,
        });

        if (error) {
          setCheckError("No se pudo validar la invitación. Probá de nuevo en un momento.");
          return;
        }

        const row = Array.isArray(data) ? data[0] : data;
        setInvitation(
          (row as ResolvedInvitation) ?? {
            status: "not_found",
            email: null,
            invited_name: null,
            organization_name: null,
            expires_at: null,
          }
        );
      } catch {
        setCheckError("No se pudo validar la invitación. Probá de nuevo en un momento.");
      } finally {
        setChecking(false);
      }
    }
    resolveToken();
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (password.length < 6) {
      setFormError("La contraseña tiene que tener al menos 6 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }
    if (!invitation?.email) {
      setFormError("Invitación inválida.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Cuenta en Supabase Auth con el email que vino en el token (el
      //    trainer no lo edita).
      const { error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
      });

      if (signUpError) {
        setFormError(signUpError.message);
        return;
      }

      // signUp deja sesion iniciada salvo que el proyecto pida confirmar el
      // mail. Si no hay sesion, el RPC de abajo no puede correr.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: invitation.email,
          password,
        });
        if (signInError) {
          setFormError(
            "Tu cuenta se creó pero falta confirmar el email. Revisá tu casilla y volvé a entrar."
          );
          return;
        }
      }

      // 2. Perfil TRAINER + quemar la invitacion, en una sola transaccion.
      const { error: acceptError } = await supabase.rpc("accept_trainer_invitation", {
        p_token: token,
      });

      if (acceptError) {
        setFormError(acceptError.message);
        return;
      }

      router.push("/trainer");
    } catch {
      setFormError("No se pudo completar el alta. Probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-textSecondary">
        Validando invitación...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <h1 className="mb-2 text-h2">Sumate como entrenador</h1>

        {checkError && <p className="text-body text-error">{checkError}</p>}

        {!checkError && invitation && invitation.status !== "valid" && (
          <p className="text-body text-error">{errorCopy[invitation.status]}</p>
        )}

        {!checkError && invitation?.status === "valid" && (
          <>
            <p className="mb-6 text-body text-textSecondary">
              {invitation.organization_name ?? "Tu gimnasio"} te invitó como entrenador. Creá tu
              contraseña para entrar con <span className="text-textPrimary">{invitation.email}</span>.
            </p>

            <form onSubmit={handleAccept} className="flex flex-col gap-4">
              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
              <Input
                label="Repetir contraseña"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
              />

              {formError && <p className="text-small text-error">{formError}</p>}

              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? "Creando cuenta..." : "Crear cuenta"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-body text-textSecondary">
          Cargando...
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
