"use client";

import { Suspense } from "react";
import CreateRoutineForm from "@/components/CreateRoutineForm";

// Mismo form que usa el GYM_OWNER: lo unico que cambia es a donde vuelve
// despues de guardar. El Suspense lo exige useSearchParams()
// (?assignToMemberId) adentro del form.
export default function TrainerCreateRoutinePage() {
  return (
    <Suspense fallback={<p className="text-body text-textSecondary">Cargando...</p>}>
      <CreateRoutineForm
        basePath="/trainer/routines"
        membersPath="/trainer"
        assignHrefBase="/trainer/members"
      />
    </Suspense>
  );
}
