"use client";

import CreateRoutineForm from "@/components/CreateRoutineForm";

// El form entero vive en components/CreateRoutineForm para que el TRAINER
// use exactamente el mismo desde /trainer/routines/create.
export default function CreateRoutinePage() {
  return <CreateRoutineForm basePath="/dashboard/routines" />;
}
