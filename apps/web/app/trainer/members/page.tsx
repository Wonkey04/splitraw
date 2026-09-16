"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import MembersSection from "@/components/MembersSection";
import { Badge, Card } from "@/components/ui";

// Miembros del trainer (su sucursal) + el placeholder de "Gestión de
// planes", que vivía en /trainer y se mudó acá porque es lo que más se le
// parece: es sobre socios y sus planes, no sobre rutinas. Sigue siendo
// SOLO el placeholder (Feature 4 no se construye todavía): mismo dashed
// border, mismo peso visual bajo, ningún dato de cobros inventado.
function TrainerMembersContent() {
  const { profile, loading: profileLoading } = useUserProfile();
  const searchParams = useSearchParams();

  // Los links del home (Feature 1) llegan con ?routine=none o ?status=soon
  // para abrir la lista ya filtrada, en vez de que el trainer tenga que
  // volver a aplicar el filtro a mano.
  const routineParam = searchParams?.get("routine") ?? null;
  const statusParam = searchParams?.get("status") ?? null;

  const [branchName, setBranchName] = useState<string | null>(null);

  useEffect(() => {
    if (profileLoading || !profile) return;

    supabase
      .from("branches")
      .select("name")
      .eq("id", profile.branch_id)
      .maybeSingle()
      .then(({ data }) => setBranchName((data as { name: string } | null)?.name ?? null));
  }, [profile, profileLoading]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1">Miembros</h1>

      <section>
        <h2 className="mb-2 text-h3">Gestión de planes</h2>
        <Card className="flex items-center justify-between gap-4 border-dashed py-4 opacity-70">
          <p className="text-body text-textSecondary">
            Altas, vencimientos y cobros de planes van a vivir acá.
          </p>
          <Badge variant="neutral">Pronto</Badge>
        </Card>
      </section>

      <MembersSection
        scope="branch"
        assignHrefBase="/trainer/members"
        scopeLabel={`Solo de tu sucursal${branchName ? ` (${branchName})` : ""}`}
        initialRoutineFilter={routineParam === "none" ? "without" : ""}
        initialStatusFilter={statusParam === "soon" ? "soon" : ""}
        detailHrefBase="/trainer/members"
      />
    </div>
  );
}

export default function TrainerMembersPage() {
  return (
    <Suspense fallback={<p className="text-body text-textSecondary">Cargando...</p>}>
      <TrainerMembersContent />
    </Suspense>
  );
}
