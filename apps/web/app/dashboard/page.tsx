"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserProfile } from "@/lib/context/UserProfileContext";

// Dashboard home: greets the owner y linkea a los tres flujos principales.
// El codigo de invitacion del gimnasio vive en /dashboard/members.
export default function DashboardHome() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const name = profile ? `${profile.name} ${profile.surname ?? ""}`.trim() : user?.email?.split("@")[0] ?? "Owner";

  return (
    <div>
      <h1 className="mb-8 text-h1">Bienvenido, {name}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ShortcutCard href="/dashboard/routines/create">Crear rutina</ShortcutCard>
        <ShortcutCard href="/dashboard/routines">Ver mis rutinas</ShortcutCard>
        <ShortcutCard href="/dashboard/members">Ver miembros</ShortcutCard>
      </div>
    </div>
  );
}

function ShortcutCard({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded border border-border bg-bgPrimary p-6 text-center text-body font-medium text-textPrimary transition-colors hover:border-accent hover:bg-bgTertiary"
    >
      {children}
    </Link>
  );
}
