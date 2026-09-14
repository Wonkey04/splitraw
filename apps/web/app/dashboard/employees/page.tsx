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

/** Una fila tal como la devuelve list_org_employees() (0011). */
interface EmployeeRow {
  user_id: string;
  name: string | null;
  surname: string | null;
  email: string | null;
  role: string;
  branch_id: string | null;
  branch_name: string | null;
  created_at: string | null;
}

// El rol se guarda en mayusculas y en ingles; la pantalla lo muestra como lo
// dice el owner.
const roleLabel: Record<string, string> = {
  GYM_OWNER: "Dueño",
  ADMIN: "Administrador",
  TRAINER: "Entrenador",
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Panel de EMPLEADOS del gimnasio: quienes trabajan hoy (nombre, rol,
// sucursal, fecha de alta) y, en la misma pantalla, las invitaciones ya
// mandadas con su estado. Antes esto era solo la pantalla de invitaciones:
// el owner no tenia ninguna vista de su propio equipo.
//
// Es de SOLO LECTURA (mas el form de invitar, que ya existia): no hay
// edicion de empleados todavia, a proposito.
//
// El listado sale de la RPC list_org_employees y no de un .select() sobre
// user_profiles porque el EMAIL vive en auth.users, que no es accesible
// desde el cliente. La funcion valida GYM_OWNER/ADMIN adentro; el layout de
// /dashboard ademas ya cierra la sesion de cualquier rol que no sea
// GYM_OWNER.
export default function EmployeesPage() {
  const { profile, loading: profileLoading } = useUserProfile();

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

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
        const [employeesRes, branchesRes, invitationsRes] = await Promise.all([
          supabase.rpc("list_org_employees"),
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

        // El error del equipo se muestra aparte: que no se pueda leer
        // user_profiles no deberia tapar la lista de invitaciones, ni al
        // reves.
        if (employeesRes.error) {
          setEmployeesError("No se pudo cargar el equipo.");
        } else {
          setEmployees((employeesRes.data as EmployeeRow[]) ?? []);
        }

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
        setLoadError("No se pudieron cargar los datos de empleados.");
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

  const pendingCount = invitations.filter((i) => statusOf(i) === "pendiente").length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-h1">Empleados</h1>
        <p className="mt-1 text-body text-textSecondary">
          Quiénes trabajan hoy en el gimnasio y las invitaciones que mandaste.
        </p>
      </div>

      {/* --------------------------------------------------------- equipo */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h3">Equipo</h2>
          <span className="text-small text-textSecondary">Todas las sucursales</span>
        </div>

        {loading && <p className="text-body text-textSecondary">Cargando...</p>}
        {employeesError && <p className="text-body text-error">{employeesError}</p>}

        {!loading && !employeesError && employees.length === 0 && (
          <p className="text-body text-textSecondary">
            Todavía no hay nadie más en el equipo. Invitá a un entrenador abajo.
          </p>
        )}

        {!loading && employees.length > 0 && (
          <Table>
            <TableHead>
              <TableRow hoverable={false}>
                <TableHeaderCell className="py-1">Nombre</TableHeaderCell>
                <TableHeaderCell className="py-1">Email</TableHeaderCell>
                <TableHeaderCell className="py-1">Rol</TableHeaderCell>
                <TableHeaderCell className="py-1">Sucursal</TableHeaderCell>
                <TableHeaderCell className="py-1">Alta</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((employee) => {
                const fullName = `${employee.name ?? ""} ${employee.surname ?? ""}`.trim();

                return (
                  <TableRow key={employee.user_id}>
                    <TableCell className="py-1 text-textPrimary">
                      {fullName || "-"}
                      {employee.user_id === profile?.id && (
                        <span className="ml-2 text-small text-textSecondary">(vos)</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1 text-textSecondary">
                      {employee.email ?? "-"}
                    </TableCell>
                    <TableCell className="py-1">
                      <Badge variant={employee.role === "TRAINER" ? "neutral" : "success"}>
                        {roleLabel[employee.role] ?? employee.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1 text-textSecondary">
                      {employee.branch_name ?? "-"}
                    </TableCell>
                    <TableCell className="py-1 text-textSecondary">
                      {formatDate(employee.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {/* -------------------------------------------------- invitaciones */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h3">Invitaciones</h2>
          {pendingCount > 0 && (
            <span className="text-small text-textSecondary">
              {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
            </span>
          )}
        </div>

        <Card className="mb-4">
          <h3 className="mb-4 text-body font-medium text-textPrimary">Invitar entrenador</h3>

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

        {loading && <p className="text-body text-textSecondary">Cargando...</p>}
        {loadError && <p className="text-body text-error">{loadError}</p>}

        {!loading && !loadError && invitations.length === 0 && (
          <p className="text-body text-textSecondary">Todavía no invitaste a ningún entrenador.</p>
        )}

        {!loading && invitations.length > 0 && (
          <Table>
            <TableHead>
              <TableRow hoverable={false}>
                <TableHeaderCell className="py-1">Nombre</TableHeaderCell>
                <TableHeaderCell className="py-1">Email</TableHeaderCell>
                <TableHeaderCell className="py-1">Sucursal</TableHeaderCell>
                <TableHeaderCell className="py-1">Enviada</TableHeaderCell>
                <TableHeaderCell className="py-1">Estado</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invitations.map((invitation) => {
                const status = statusOf(invitation);
                return (
                  <TableRow key={invitation.id}>
                    <TableCell className="py-1">{invitation.name}</TableCell>
                    <TableCell className="py-1 text-textSecondary">{invitation.email}</TableCell>
                    <TableCell className="py-1 text-textSecondary">
                      {branches.find((b) => b.id === invitation.branch_id)?.name ?? "-"}
                    </TableCell>
                    <TableCell className="py-1 text-textSecondary">
                      {formatDate(invitation.created_at ?? null)}
                    </TableCell>
                    <TableCell className="py-1">
                      <Badge variant={badgeVariant[status]}>{status}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
