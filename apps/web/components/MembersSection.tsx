"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Badge,
  Button,
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Una fila tal como la devuelven list_branch_members() (trainer) y
 * list_org_members() (owner). La unica diferencia entre las dos es
 * `branch_name`, que solo trae la del owner: el trainer ya sabe que todo lo
 * que ve es de su sucursal.
 */
interface MemberRow {
  member_id: string;
  email: string;
  display_name: string | null;
  branch_name?: string | null;
  activation_expires_at: string | null;
  current_routine_id: string | null;
  current_routine_name: string | null;
  assigned_at: string | null;
  /** Fecha (date, sin hora) del último exercise_log del socio. Null = nunca registró. */
  last_log_at: string | null;
  total_count: number;
}

const ADHERENCE_WARN_DAYS = 7;

// "Última carga: hace N días" bajo el nombre (Feature 3). No reemplaza el
// badge Con/Sin rutina: una cosa es si el trainer le asignó algo, otra si
// el socio efectivamente está yendo. Acá no hay "vencido" — es una señal a
// seguir, no un error, por eso el color es warning y no error incluso
// cuando nunca registró nada.
function adherenceLabel(lastLogAt: string | null): { text: string; stale: boolean } {
  if (!lastLogAt) return { text: "Sin registros", stale: true };

  const days = Math.floor((Date.now() - new Date(lastLogAt).getTime()) / (24 * 60 * 60 * 1000));
  const stale = days >= ADHERENCE_WARN_DAYS;

  if (days <= 0) return { text: "Última carga: hoy", stale };
  if (days === 1) return { text: "Última carga: hace 1 día", stale };
  return { text: `Última carga: hace ${days} días`, stale };
}

// Estado del socio: se CALCULA desde members.activation_expires_at, no es un
// booleano que alguien togglea. Un flag manual es un recordatorio que nadie
// cumple, y a la semana la lista miente; una fecha es un dato objetivo.
//
// "sin datos" (fecha NULL) NO es "vencido": el gimnasio cobra por fuera de
// SplitRaw, así que un socio del que todavía no se cargó vencimiento no tiene
// por qué figurar como moroso.
type PlanStatus = "activo" | "por vencer" | "vencido" | "sin datos";

// El filtro que se le manda a la RPC. Se resuelve en Postgres y no en el
// cliente por la misma razón que la búsqueda: con el paginado de 25, filtrar
// después de traer la página daría páginas de tamaño variable y un total mal
// contado.
type StatusFilter = "" | "expired" | "active" | "soon";

// Mismo criterio que StatusFilter: el filtro se resuelve en la RPC
// (p_has_routine, 0018), no trayendo la página y descartando filas.
type RoutineFilter = "" | "with" | "without";

const RENEW_DAYS = 30;

const planVariant: Record<PlanStatus, "success" | "warning" | "error" | "neutral"> = {
  activo: "success",
  "por vencer": "warning",
  vencido: "error",
  "sin datos": "neutral",
};

const DAYS_TO_WARN = 7;

function planStatusOf(expiresAtIso: string | null): PlanStatus {
  if (!expiresAtIso) return "sin datos";

  const expiresAt = new Date(expiresAtIso).getTime();
  const now = Date.now();

  if (expiresAt < now) return "vencido";
  if (expiresAt - now < DAYS_TO_WARN * 24 * 60 * 60 * 1000) return "por vencer";
  return "activo";
}

interface PendingChange {
  memberId: string;
  memberName: string;
  routineName: string;
}

export interface MembersSectionProps {
  /**
   * "branch" -> list_branch_members: solo la sucursal del trainer.
   * "org"    -> list_org_members: toda la organizacion, con columna de
   *             sucursal. El alcance lo decide la RPC, no el cliente.
   */
  scope: "branch" | "org";
  /** Base de la ruta de asignar: `${assignHrefBase}/<id>/assign-routine`. */
  assignHrefBase: string;
  /** Aclaracion de alcance a la derecha del titulo. */
  scopeLabel?: string | null;
  /** Preseleccionan un filtro al montar (ej. link desde el home del trainer). */
  initialStatusFilter?: StatusFilter;
  initialRoutineFilter?: RoutineFilter;
  /**
   * Si se pasa, el nombre del socio linkea a `${detailHrefBase}/<id>`
   * (drill-down, Feature 2). Sin esto la fila no es clickeable — hoy solo
   * lo usa el panel del trainer.
   */
  detailHrefBase?: string;
}

// Seccion "Miembros", compartida entre el panel del TRAINER y el del
// GYM_OWNER: la unica diferencia real es que RPC se llama y si se pinta la
// columna de sucursal. Todo el peso esta en la funcion de Postgres: pagina,
// busca y trae la rutina actual de cada socio en una sola consulta. Ver 0009
// (trainer) y 0010 (owner) para por que no es un .select() directo.
export default function MembersSection({
  scope,
  assignHrefBase,
  scopeLabel,
  initialStatusFilter = "",
  initialRoutineFilter = "",
  detailHrefBase,
}: MembersSectionProps) {
  const router = useRouter();

  const [rows, setRows] = useState<MemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatusFilter);
  const [routineFilter, setRoutineFilter] = useState<RoutineFilter>(initialRoutineFilter);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const showBranch = scope === "org";
  // Renovar es del dueño: renew_member() (0017) exige GYM_OWNER/ADMIN. El
  // trainer ve el estado pero no lo cambia — quién está al día es una
  // decisión de quien cobra.
  const canRenew = scope === "org";

  // El input se debouncea para no disparar una query por tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rpcName = scope === "org" ? "list_org_members" : "list_branch_members";

      const { data, error: rpcError } = await supabase.rpc(rpcName, {
        p_search: search || null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_status: statusFilter || null,
        p_has_routine: routineFilter === "with" ? true : routineFilter === "without" ? false : null,
      });

      if (rpcError) {
        setError("No se pudieron cargar los miembros.");
        setRows([]);
        setTotal(0);
        return;
      }

      const list = (data as MemberRow[]) ?? [];
      setRows(list);
      // total_count viene repetido en cada fila (count(*) OVER ()). Si la
      // pagina vino vacia no hay de donde sacarlo: es 0.
      setTotal(list.length > 0 ? Number(list[0].total_count) : 0);
    } catch {
      setError("No se pudieron cargar los miembros.");
    } finally {
      setLoading(false);
    }
  }, [scope, search, page, statusFilter, routineFilter]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  function assignHref(memberId: string) {
    return `${assignHrefBase}/${memberId}/assign-routine`;
  }

  async function handleRenew(row: MemberRow) {
    setRenewingId(row.member_id);
    setError(null);

    const { error: rpcError } = await supabase.rpc("renew_member", {
      p_member_id: row.member_id,
      p_days: RENEW_DAYS,
    });

    setRenewingId(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    // Se recarga la página actual en vez de parchear la fila: la RPC decide
    // la fecha final (extiende desde el vencimiento si todavía estaba al día,
    // arranca de hoy si ya estaba vencido) y el cliente no debería recalcular
    // esa regla por su cuenta.
    await loadMembers();
  }

  function handleChangeRoutine(row: MemberRow) {
    setPendingChange({
      memberId: row.member_id,
      memberName: row.display_name ?? row.email,
      routineName: row.current_routine_name ?? "sin nombre",
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastShown = Math.min(total, page * PAGE_SIZE + rows.length);

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3">Miembros</h2>
        {scopeLabel && <span className="text-small text-textSecondary">{scopeLabel}</span>}
      </div>

      <div className="mb-2 flex flex-wrap items-end gap-2">
        <div className="max-w-sm flex-1">
          <Input
            aria-label="Buscar miembro por nombre o email"
            placeholder="Buscar por nombre o email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="Filtrar por estado del plan">
          {(
            [
              ["", "Todos"],
              ["expired", "Vencidos"],
              ["soon", "Vencen esta semana"],
              ["active", "Al día"],
            ] as [StatusFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value || "todos"}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => {
                setStatusFilter(value);
                setPage(0);
              }}
              className={
                "rounded border px-4 py-2 text-body transition-colors " +
                (statusFilter === value
                  ? "border-accent bg-bgTertiary text-textPrimary"
                  : "border-border text-textSecondary hover:bg-bgTertiary")
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label="Filtrar por rutina asignada">
          {(
            [
              ["", "Con y sin rutina"],
              ["without", "Sin rutina"],
              ["with", "Con rutina"],
            ] as [RoutineFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value || "todas"}
              type="button"
              aria-pressed={routineFilter === value}
              onClick={() => {
                setRoutineFilter(value);
                setPage(0);
              }}
              className={
                "rounded border px-4 py-2 text-body transition-colors " +
                (routineFilter === value
                  ? "border-accent bg-bgTertiary text-textPrimary"
                  : "border-border text-textSecondary hover:bg-bgTertiary")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-body text-error">{error}</p>}

      {loading && rows.length === 0 && <p className="text-body text-textSecondary">Cargando...</p>}

      {!loading && rows.length === 0 && (
        <p className="text-body text-textSecondary">
          {search
            ? `No hay miembros que coincidan con "${search}".`
            : statusFilter === "expired"
              ? "Ningún miembro está vencido."
              : statusFilter === "soon"
                ? "Ningún miembro vence esta semana."
                : statusFilter === "active"
                  ? "Ningún miembro tiene el plan al día."
                  : routineFilter === "without"
                    ? "Todos los miembros tienen una rutina asignada."
                    : routineFilter === "with"
                      ? "Ningún miembro tiene una rutina asignada todavía."
                      : scope === "org"
                        ? "Todavía no hay miembros en el gimnasio."
                        : "No hay miembros en tu sucursal."}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <Table>
            <TableHead>
              <TableRow hoverable={false}>
                <TableHeaderCell className="py-1">Miembro</TableHeaderCell>
                {showBranch && <TableHeaderCell className="py-1">Sucursal</TableHeaderCell>}
                <TableHeaderCell className="py-1">Rutina</TableHeaderCell>
                <TableHeaderCell className="py-1">Plan</TableHeaderCell>
                <TableHeaderCell className="w-56 py-1 text-right">Acciones</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const hasRoutine = Boolean(row.current_routine_id);
                const name = row.display_name ?? row.email;
                const planStatus = planStatusOf(row.activation_expires_at);
                const adherence = adherenceLabel(row.last_log_at);

                return (
                  <TableRow key={row.member_id}>
                    <TableCell className="py-1">
                      <div>
                        {detailHrefBase ? (
                          <Link
                            href={`${detailHrefBase}/${row.member_id}`}
                            className="text-textPrimary hover:text-accent"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className="text-textPrimary">{name}</span>
                        )}
                        {row.display_name && (
                          <span className="ml-2 text-small text-textSecondary">{row.email}</span>
                        )}
                      </div>
                      <p className={`text-small ${adherence.stale ? "text-warning" : "text-textSecondary"}`}>
                        {adherence.text}
                      </p>
                    </TableCell>
                    {showBranch && (
                      <TableCell className="py-1 text-textSecondary">
                        {row.branch_name ?? "-"}
                      </TableCell>
                    )}
                    <TableCell className="py-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={hasRoutine ? "success" : "neutral"}>
                          {hasRoutine ? "Con rutina" : "Sin rutina"}
                        </Badge>
                        {hasRoutine && (
                          <span className="text-small text-textSecondary">
                            {row.current_routine_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1">
                      <Badge variant={planVariant[planStatus]}>{planStatus}</Badge>
                    </TableCell>
                    <TableCell className="py-1 text-right">
                      {canRenew && (
                        <button
                          onClick={() => handleRenew(row)}
                          disabled={renewingId === row.member_id}
                          className="mr-4 rounded text-body text-accent hover:text-accentHover disabled:text-textSecondary"
                        >
                          {renewingId === row.member_id
                            ? "Renovando..."
                            : `Renovar ${RENEW_DAYS} días`}
                        </button>
                      )}
                      {hasRoutine ? (
                        <button
                          onClick={() => handleChangeRoutine(row)}
                          className="rounded text-body text-accent hover:text-accentHover"
                        >
                          Cambiar rutina
                        </button>
                      ) : (
                        <Link
                          href={assignHref(row.member_id)}
                          className="rounded text-body text-accent hover:text-accentHover"
                        >
                          Asignar rutina
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="text-small text-textSecondary">
              {firstShown}-{lastShown} de {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-small text-textSecondary">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page + 1 >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Nadie deberia pisar una rutina activa sin enterarse de cual era: el
          modal dice el nombre de la que ya tiene. */}
      <Modal
        open={pendingChange !== null}
        onClose={() => setPendingChange(null)}
        title="Ya tiene una rutina asignada"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingChange(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (pendingChange) router.push(assignHref(pendingChange.memberId));
              }}
            >
              Sí, cambiar
            </Button>
          </>
        }
      >
        {pendingChange && (
          <p>
            {pendingChange.memberName} ya tiene asignada{" "}
            <span className="font-medium">{pendingChange.routineName}</span>. ¿Desea cambiarla?
          </p>
        )}
      </Modal>
    </section>
  );
}
