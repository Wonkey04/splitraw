"use client";

import CreateRoutineForm from "@/components/CreateRoutineForm";

// Mismo form que usa el GYM_OWNER: la unica diferencia es a donde vuelve
// despues de guardar.
export default function TrainerCreateRoutinePage() {
  return <CreateRoutineForm basePath="/trainer/routines" />;
}
