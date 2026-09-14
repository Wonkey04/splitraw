"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import { UserProfileProvider, useUserProfile } from "@/lib/context/UserProfileContext";
import { Button } from "@/components/ui";

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

// Mismo criterio que el RoleGuard de /dashboard: si el perfil no es TRAINER
// se cierra la sesion antes de mandarlo al login, para no dejarlo rebotando
// entre "/" (que redirige a /dashboard apenas hay sesion) y esta ruta.
function TrainerGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, loading } = useUserProfile();

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role !== "TRAINER") {
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

  if (!profile || profile.role !== "TRAINER") {
    return null;
  }

  return <>{children}</>;
}

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
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
      <TrainerGuard>
        <div className="min-h-screen bg-bgPrimary">
          <nav className="border-b border-border bg-bgSecondary px-6 py-4">
            <div className="mx-auto flex max-w-5xl items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/trainer" className="rounded text-h3 text-textPrimary">
                  SplitRaw
                </Link>
                <NavLink href="/trainer">Panel</NavLink>
              </div>
              <div className="flex items-center gap-4">
                <NavLink href="/trainer/profile">Mi perfil</NavLink>
                <Button variant="secondary" onClick={handleLogout}>
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </nav>
          <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        </div>
      </TrainerGuard>
    </UserProfileProvider>
  );
}
