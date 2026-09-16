"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import { UserProfileProvider, useUserProfile } from "@/lib/context/UserProfileContext";
import { Button } from "@/components/ui";

// Link de navegación con estado activo. Es solo presentación: no cambia el ruteo.
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || Boolean(pathname?.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded text-body ${active ? "text-accent" : "text-textSecondary hover:text-textPrimary"}`}
    >
      {children}
    </Link>
  );
}

// "/" redirige según landingPathForCurrentUser() apenas hay sesión (ver
// apps/web/app/page.tsx). Si solo redirigiéramos de vuelta a "/" acá,
// un user_profiles con role != GYM_OWNER (ej. un member de la app mobile)
// quedaría en un loop infinito. Por eso este guard cierra la sesión antes
// de mandarlo de vuelta al login.
//
// Caso aparte, sin signOut: hay sesión de auth pero NO hay fila en
// user_profiles todavía. No es "otro rol" — es un dueño que hizo signUp
// pero nunca terminó create_gym_with_owner() (cerró la pestaña, se le
// cortó la conexión, etc.). Antes esto caía en el mismo bucket que
// "rol equivocado" y como profile es null la condición de abajo ni
// evaluaba profile.role, así que no pasaba nada: la pantalla quedaba en
// blanco para siempre. La cuenta no está completa hasta que existe
// organization_id, así que el destino es completar el registro, no el
// login.
function RoleGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, loading } = useUserProfile();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/create-gym");
      return;
    }
    if (profile.role !== "GYM_OWNER") {
      supabase.auth.signOut().then(() => router.replace("/"));
    }
  }, [loading, profile, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-textSecondary">
        Cargando...
      </div>
    );
  }

  if (!profile || profile.role !== "GYM_OWNER") {
    return null;
  }

  return <>{children}</>;
}

// Wraps every /dashboard/* page: redirects unauthenticated users back to
// login, and renders the shared nav bar + logout button.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-textSecondary">
        Cargando...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <UserProfileProvider>
      <RoleGuard>
        <div className="min-h-screen bg-bgSecondary">
          <nav className="border-b border-border bg-bgPrimary px-6 py-4">
            <div className="mx-auto flex max-w-5xl items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/dashboard" className="rounded text-h3 text-textPrimary">
                  SplitRaw Admin
                </Link>
                <NavLink href="/dashboard/routines">Rutinas</NavLink>
                <NavLink href="/dashboard/members">Miembros</NavLink>
                <NavLink href="/dashboard/employees">Empleados</NavLink>
              </div>
              <div className="flex items-center gap-4">
                <NavLink href="/dashboard/profile">Mi perfil</NavLink>
                <Button variant="secondary" onClick={handleLogout}>
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </nav>
          <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        </div>
      </RoleGuard>
    </UserProfileProvider>
  );
}
