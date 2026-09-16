"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button, Card } from "@/components/ui";

// Pantalla para una cuenta de staff (GYM_OWNER o TRAINER) cuyo gimnasio ya
// no existe: delete_organization_cascade() (baja de gimnasio, ver migración
// 0023) borra la organización pero preserva las cuentas de quienes
// trabajaban ahí — organization_id/branch_id quedan NULL en vez de borrar a
// gente que no pidió que la borren. Los guards de /dashboard y /trainer
// mandan acá en vez de dejarlos entrar a un panel que ya no tiene datos.
//
// Standalone (sin UserProfileProvider): esta pantalla es justamente el
// destino de alguien que ese contexto ya no puede resolver del todo.
export default function NoOrganizationPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [wasOwner, setWasOwner] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("role, organization_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      // Si en algún momento organization_id volviera a existir (por ej. se
      // creó un gimnasio nuevo con esta misma cuenta), esta pantalla no
      // corresponde más.
      if (data?.organization_id) {
        router.replace(data.role === "TRAINER" ? "/trainer" : "/dashboard");
        return;
      }

      setWasOwner(data?.role === "GYM_OWNER");
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, session, router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-textSecondary">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bgSecondary p-8">
      <Card className="w-full max-w-[440px] text-center">
        <h1 className="mb-2 text-h2">Tu gimnasio ya no existe</h1>
        <p className="mb-6 text-body text-textSecondary">
          {wasOwner
            ? "Diste de baja tu gimnasio. Tu cuenta sigue activa, pero no está vinculada a ninguna organización."
            : "El dueño dio de baja el gimnasio en el que trabajabas. Tu cuenta sigue activa, pero ya no está vinculada a ninguna organización."}
        </p>
        <p className="mb-6 text-small text-textSecondary">
          Si querés crear un gimnasio nuevo con esta misma cuenta, escribinos y te ayudamos.
        </p>
        <Button variant="secondary" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </Card>
    </div>
  );
}
