"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/hooks/useAuth";
import { UserProfileProvider } from "@/lib/context/UserProfileContext";

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
      <div className="flex min-h-screen items-center justify-center text-text-secondary">
        Cargando...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <UserProfileProvider>
      <div className="min-h-screen">
        <nav className="border-b border-gray-800 bg-bg-secondary px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="font-semibold">
                SplitRaw Admin
              </Link>
              <Link href="/dashboard/routines" className="text-sm text-text-secondary hover:text-text-primary">
                Rutinas
              </Link>
              <Link href="/dashboard/members" className="text-sm text-text-secondary hover:text-text-primary">
                Miembros
              </Link>
            </div>
            <button onClick={handleLogout} className="text-sm text-text-secondary hover:text-error">
              Cerrar sesión
            </button>
          </div>
        </nav>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </div>
    </UserProfileProvider>
  );
}
