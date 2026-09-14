"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { Branch, TrainerInvitation } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";

type InvitationStatus = "pendiente" | "usada" | "vencida";

function statusOf(invitation: TrainerInvitation): InvitationStatus {
  if (invitation.used_at) return "usada";
  if (new Date(invitation.expires_at).getTime() < Date.now()) return "vencida";
  return "pendiente";
}

const badgeVariant: Record<InvitationStatus, "success" | "neutral" | "warning"> = {
  pendiente: "warning",
  usada: "success",
  vencida: "neutral",
};

// Gestion de entrenadores del gimnasio: invitar a un TRAINER por mail y ver
// el estado de las invitaciones ya mandadas. El alta real (crear la fila en
// user_profiles con role TRAINER) la hace el propio trainer al aceptar el
// link, ver /accept-invite.
export default function EmployeesPage() {
  const { profile, loading: profileLoading } = useUserProfile();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [invitations, setInvitations] = useState<TrainerInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [branchId, setBranchId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (profileLoading) return;

    if (!profile) {
      setLoadError("No se encontró tu perfil. Volvé a loguearte.");
      setLoading(false);
      return;
    }

    async function loadData() {
      try {
        const [branchesRes, invitationsRes] = await Promise.all([
          supabase
            .from("branches")
            .select("*")
            .eq("organization_id", profile!.organization_id)
            .order("created_at", { ascending: true }),
          supabase
            .from("trainer_invitations")
            .select("*")
            .eq("organization_id", profile!.organization_id)
            .order("created_at", { ascending: false }),
        ]);

        if (branchesRes.error) {
          setLoadError("No se pudieron cargar las sucursales.");
        } else {
          const list = (branchesRes.data as Branch[]) ?? [];
          setBranches(list);
          setBranchId((current) => current || profile!.branch_id || list[0]?.id || "");
        }

        if (!invitationsRes.error) {
          setInvitations((invitationsRes.data as TrainerInvitation[]) ?? []);
        }
      } catch {
        setLoadError("No se pudieron cargar los datos de entrenadores.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile, profileLoading]);

  async function refreshInvitations() {
    if (!profile) return;
    const { data } = await supabase
      .from("trainer_invitations")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });
    setInvitations((data as TrainerInvitation[]) ?? []);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);

    if (!name.trim()) {
      setFormError("El nombre del entrenador es obligatorio.");
      return;
    }
    if (!email.trim()) {
      setFormError("El email es obligatorio.");
      return;
    }
    if (!branchId) {
      setFormError("Elegí una sucursal.");
      return;
    }

    setSubmitting(true);

    try {
      // El envío del mail necesita la API key de Resend, que es del server:
      // por eso esto pasa por /api/trainer-invitations y no por supabase
      // directo como el resto de la app.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setFormError("Tu sesión expiró, volvé a loguearte.");
        return;
      }

      const response = await fetch("/api/trainer-invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), branchId }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(body?.error ?? "No se pudo enviar la invitación.");
        return;
      }

      setSuccess(`Invitación enviada a ${email.trim()}. El link vence en 30 minutos.`);
      setName("");
      setEmail("");
      await refreshInvitations();
    } catch {
      setFormError("No se pudo enviar la invitación. Revisá tu conexión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-h1">Entrenadores</h1>

      <Card className="mb-6">
        <h2 className="mb-4 text-h3">Invitar entrenador</h2>

        <form onSubmit={handleInvite} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Pérez"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="entrenador@gimnasio.com"
            />
            <Select
              label="Sucursal"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              placeholder={branches.length === 0 ? "Sin sucursales" : "Elegí una sucursal"}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
          </div>

          {formError && <p className="text-small text-error">{formError}</p>}
          {success && <Badge variant="success">{success}</Badge>}

          <div>
            <Button type="submit" disabled={submitting || branches.length === 0}>
              {submitting ? "Enviando..." : "Invitar entrenador"}
            </Button>
          </div>
        </form>
      </Card>

      <h2 className="mb-4 text-h3">Invitaciones enviadas</h2>

      {loading && <p className="text-body text-textSecondary">Cargando...</p>}
      {loadError && <p className="text-body text-error">{loadError}</p>}

      {!loading && !loadError && invitations.length === 0 && (
        <p className="text-body text-textSecondary">Todavía no invitaste a ningún entrenador.</p>
      )}

      {!loading && invitations.length > 0 && (
        <Table>
          <TableHead>
            <TableRow hoverable={false}>
              <TableHeaderCell>Nombre</TableHeaderCell>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell>Sucursal</TableHeaderCell>
              <TableHeaderCell>Estado</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invitations.map((invitation) => {
              const status = statusOf(invitation);
              return (
                <TableRow key={invitation.id}>
                  <TableCell>{invitation.name}</TableCell>
                  <TableCell className="text-textSecondary">{invitation.email}</TableCell>
                  <TableCell className="text-textSecondary">
                    {branches.find((b) => b.id === invitation.branch_id)?.name ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant[status]}>{status}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
