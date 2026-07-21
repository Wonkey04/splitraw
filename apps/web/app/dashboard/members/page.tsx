"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { Member } from "@/lib/types";

// Lists all members of la organizacion del usuario logueado, con accion
// para asignarles una rutina.
export default function MembersListPage() {
  const { profile } = useUserProfile();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    async function loadMembers() {
      const { data, error: fetchError } = await supabase
        .from("members")
        .select("*")
        .eq("organization_id", profile!.organization_id);

      if (fetchError) {
        setError("No se pudieron cargar los miembros.");
      } else {
        setMembers(data as Member[]);
      }
      setLoading(false);
    }
    loadMembers();
  }, [profile]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Miembros</h1>

      {loading && <p className="text-text-secondary">Cargando...</p>}
      {error && <p className="text-error">{error}</p>}
      {!loading && !error && members.length === 0 && (
        <p className="text-text-secondary">No hay miembros aún.</p>
      )}

      {!loading && members.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-800 text-sm text-text-secondary">
              <th className="py-2">Email</th>
              <th className="py-2">Nombre</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-gray-800">
                <td className="py-2">{member.email}</td>
                <td className="py-2">{member.full_name ?? "-"}</td>
                <td className="py-2">
                  <Link
                    href={`/dashboard/members/${member.id}/assign-routine`}
                    className="text-sm text-primary hover:underline"
                  >
                    Asignar Rutina
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
