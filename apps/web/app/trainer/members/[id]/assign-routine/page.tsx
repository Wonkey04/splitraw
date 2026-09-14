"use client";

import AssignRoutineToMember from "@/components/AssignRoutineToMember";

export default function TrainerAssignRoutinePage() {
  return (
    <AssignRoutineToMember backHref="/trainer" createRoutineHref="/trainer/routines/create" />
  );
}
