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
      <h1 className="mb-8 text-2xl font-semibold">Bienvenido, {name}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/dashboard/routines/create" className="card text-center hover:border-primary">
          <p className="font-medium">Crear Rutina</p>
        </Link>
        <Link href="/dashboard/routines" className="card text-center hover:border-primary">
          <p className="font-medium">Ver Mis Rutinas</p>
        </Link>
        <Link href="/dashboard/members" className="card text-center hover:border-primary">
          <p className="font-medium">Ver Miembros</p>
        </Link>
      </div>
    </div>
  );
}
