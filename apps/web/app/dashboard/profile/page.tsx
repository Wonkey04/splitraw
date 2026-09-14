"use client";

import ProfileForm from "@/components/ProfileForm";

// Mismo form que usa el TRAINER en /trainer/profile: los datos personales
// son los mismos, lo unico que cambia es el layout que lo envuelve.
export default function DashboardProfilePage() {
  return <ProfileForm />;
}
