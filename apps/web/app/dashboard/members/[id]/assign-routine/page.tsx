"use client";

import AssignRoutineToMember from "@/components/AssignRoutineToMember";

export default function AssignRoutinePage() {
  return (
    <AssignRoutineToMember
      backHref="/dashboard/members"
      createRoutineHref="/dashboard/routines/create"
    />
  );
}
