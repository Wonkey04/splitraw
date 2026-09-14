"use client";

import { Suspense } from "react";
import CreateRoutineForm from "@/components/CreateRoutineForm";

// El form entero vive en components/CreateRoutineForm para que el TRAINER
// use exactamente el mismo desde /trainer/routines/create.
//
// El Suspense no es decorativo: el form lee ?assignToMemberId con
// useSearchParams(), y sin un boundary Next falla el build de esta ruta.
export default function CreateRoutinePage() {
  return (
    <Suspense fallback={<p className="text-body text-textSecondary">Cargando...</p>}>
      <CreateRoutineForm
        basePath="/dashboard/routines"
        membersPath="/dashboard/members"
        assignHrefBase="/dashboard/members"
      />
    </Suspense>
  );
}
