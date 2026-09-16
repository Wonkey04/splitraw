"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Badge, Button, Card, Input, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui";

interface MemberDetail {
  id: string;
  email: string;
  phone: string | null;
  activation_expires_at: string | null;
  branch_name: string | null;
  display_name: string | null;
}

interface CurrentRoutine {
  id: string;
  template_name: string;
  assigned_at: string | null;
}

interface LogRow {
  id: string;
  exercise_id: string | null;
  exercise_name: string | null;
  weight_kg: number | null;
  reps: number | null;
  sets: number | null;
  logged_at: string;
}

interface EditDraft {
  weight_kg: string;
  reps: string;
  sets: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

// Drill-down de un miembro (Feature 2): datos, rutina actual, e historial
// de cargas por ejercicio editable.
//
// La fuente del historial es exercise_logs (plural) — es la única de las
// dos tablas de log con forma de peso/reps/sets (ver docs/decisions.md,
// "Dos tablas de log en paralelo"). exercise_log (singular) es la que usa
// hoy la app mobile, pero solo guarda "completado sí/no" por día, sin
// detalle por ejercicio: no hay forma de mostrar ni editar sets/reps desde
// ahí. exercise_logs tiene la forma correcta y ya tenía policies de
// SELECT/INSERT para staff (0013); esta pantalla suma la de UPDATE (0020).
//
// Como nada en la app escribe en exercise_logs todavía (el logging de peso
// desde mobile es una feature aparte, sin construir), esta tabla va a
// aparecer vacía para socios reales hasta que eso exista. Es un estado
// vacío honesto, no un bug.
export default function MemberDetailPage() {
  const params = useParams();
  const memberId = params?.id as string;

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [routine, setRoutine] = useState<CurrentRoutine | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ weight_kg: "", reps: "", sets: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: memberRow, error: memberError } = await supabase
        .from("members")
        .select("id, user_id, email, phone, activation_expires_at, branch_id")
        .eq("id", memberId)
        .maybeSingle();

      if (memberError) {
        setError("No se pudo cargar el miembro.");
        return;
      }
      if (!memberRow) {
        // RLS scopea por sucursal: esto es tanto "no existe" como "es de
        // otra sucursal". No se distingue por la misma razón que en
        // renew_member (0017): no confirmarle a nadie que un id ajeno existe.
        setError("No se encontró ese miembro en tu sucursal.");
        return;
      }

      const [profileRes, branchRes, routineRes, logsRes] = await Promise.all([
        supabase.from("user_profiles").select("name, surname").eq("id", memberRow.user_id).maybeSingle(),
        supabase.from("branches").select("name").eq("id", memberRow.branch_id).maybeSingle(),
        supabase
          .from("routines")
          .select("id, assigned_at, routine_templates(name)")
          .eq("member_id", memberId)
          .order("assigned_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("exercise_logs")
          .select("id, exercise_id, weight_kg, reps, sets, logged_at, exercises(name)")
          .eq("member_id", memberId)
          .order("logged_at", { ascending: false }),
      ]);

      const profile = profileRes.data as { name: string | null; surname: string | null } | null;
      const fullName = `${profile?.name ?? ""} ${profile?.surname ?? ""}`.trim();

      setMember({
        id: memberRow.id,
        email: memberRow.email,
        phone: memberRow.phone,
        activation_expires_at: memberRow.activation_expires_at,
        branch_name: (branchRes.data as { name: string } | null)?.name ?? null,
        display_name: fullName || null,
      });

      const routineData = routineRes.data as {
        id: string;
        assigned_at: string | null;
        routine_templates: { name: string } | null;
      } | null;

      setRoutine(
        routineData
          ? {
              id: routineData.id,
              template_name: routineData.routine_templates?.name ?? "Sin nombre",
              assigned_at: routineData.assigned_at,
            }
          : null
      );

      const logRows = (logsRes.data as
        | { id: string; exercise_id: string | null; weight_kg: number | null; reps: number | null; sets: number | null; logged_at: string; exercises: { name: string } | null }[]
        | null) ?? [];

      setLogs(
        logRows.map((row) => ({
          id: row.id,
          exercise_id: row.exercise_id,
          exercise_name: row.exercises?.name ?? null,
          weight_kg: row.weight_kg,
          reps: row.reps,
          sets: row.sets,
          logged_at: row.logged_at,
        }))
      );
    } catch {
      setError("No se pudo cargar el miembro.");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(row: LogRow) {
    setSaveError(null);
    setEditingId(row.id);
    setDraft({
      weight_kg: row.weight_kg?.toString() ?? "",
      reps: row.reps?.toString() ?? "",
      sets: row.sets?.toString() ?? "",
    });
  }

  async function saveEdit(rowId: string) {
    setSaving(true);
    setSaveError(null);

    const weight_kg = draft.weight_kg.trim() === "" ? null : Number(draft.weight_kg);
    const reps = draft.reps.trim() === "" ? null : Number(draft.reps);
    const sets = draft.sets.trim() === "" ? null : Number(draft.sets);

    if ([weight_kg, reps, sets].some((v) => v !== null && Number.isNaN(v))) {
      setSaveError("Los valores tienen que ser números.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("exercise_logs")
      .update({ weight_kg, reps, sets })
      .eq("id", rowId);

    setSaving(false);

    if (updateError) {
      setSaveError("No se pudo guardar: " + updateError.message);
      return;
    }

    setLogs((prev) => prev.map((row) => (row.id === rowId ? { ...row, weight_kg, reps, sets } : row)));
    setEditingId(null);
  }

  if (loading) return <p className="text-body text-textSecondary">Cargando...</p>;

  if (error || !member) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/trainer/members" className="text-body text-accent hover:text-accentHover">
          ← Volver a Miembros
        </Link>
        <p className="text-body text-error">{error ?? "No se encontró el miembro."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/trainer/members" className="text-body text-accent hover:text-accentHover">
          ← Volver a Miembros
        </Link>
        <h1 className="mt-2 text-h1">{member.display_name ?? member.email}</h1>
        <p className="text-body text-textSecondary">
          {member.email}
          {member.phone ? ` · ${member.phone}` : ""}
          {member.branch_name ? ` · ${member.branch_name}` : ""}
        </p>
      </div>

      <Card>
        <h2 className="mb-2 text-h3">Rutina asignada</h2>
        {routine ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body font-medium text-textPrimary">{routine.template_name}</p>
              {routine.assigned_at && (
                <p className="text-small text-textSecondary">Asignada el {formatDate(routine.assigned_at)}</p>
              )}
            </div>
            <Badge variant="success">Con rutina</Badge>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-body text-textSecondary">Sin rutina asignada.</p>
            <Link
              href={`/trainer/members/${member.id}/assign-routine`}
              className="text-body text-accent hover:text-accentHover"
            >
              Asignar rutina
            </Link>
          </div>
        )}
      </Card>

      <section>
        <h2 className="mb-2 text-h3">Historial de cargas</h2>

        {logs.length === 0 ? (
          <p className="text-body text-textSecondary">
            Todavía no hay cargas registradas para este socio.
          </p>
        ) : (
          <>
            {saveError && <p className="mb-2 text-small text-error">{saveError}</p>}
            <Table>
              <TableHead>
                <TableRow hoverable={false}>
                  <TableHeaderCell className="py-1">Fecha</TableHeaderCell>
                  <TableHeaderCell className="py-1">Ejercicio</TableHeaderCell>
                  <TableHeaderCell className="py-1 text-right">Peso (kg)</TableHeaderCell>
                  <TableHeaderCell className="py-1 text-right">Reps</TableHeaderCell>
                  <TableHeaderCell className="py-1 text-right">Sets</TableHeaderCell>
                  <TableHeaderCell className="w-32 py-1 text-right">Acciones</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((row) => {
                  const isEditing = editingId === row.id;

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="py-1 text-textSecondary">{formatDate(row.logged_at)}</TableCell>
                      <TableCell className="py-1">{row.exercise_name ?? "Ejercicio eliminado"}</TableCell>
                      <TableCell className="py-1 text-right">
                        {isEditing ? (
                          <Input
                            aria-label="Peso en kilogramos"
                            className="text-right"
                            value={draft.weight_kg}
                            onChange={(e) => setDraft((d) => ({ ...d, weight_kg: e.target.value }))}
                          />
                        ) : (
                          (row.weight_kg ?? "-")
                        )}
                      </TableCell>
                      <TableCell className="py-1 text-right">
                        {isEditing ? (
                          <Input
                            aria-label="Repeticiones"
                            className="text-right"
                            value={draft.reps}
                            onChange={(e) => setDraft((d) => ({ ...d, reps: e.target.value }))}
                          />
                        ) : (
                          (row.reps ?? "-")
                        )}
                      </TableCell>
                      <TableCell className="py-1 text-right">
                        {isEditing ? (
                          <Input
                            aria-label="Series"
                            className="text-right"
                            value={draft.sets}
                            onChange={(e) => setDraft((d) => ({ ...d, sets: e.target.value }))}
                          />
                        ) : (
                          (row.sets ?? "-")
                        )}
                      </TableCell>
                      <TableCell className="py-1 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              className="text-body text-accent hover:text-accentHover disabled:text-textSecondary"
                              disabled={saving}
                              onClick={() => saveEdit(row.id)}
                            >
                              {saving ? "Guardando..." : "Guardar"}
                            </button>
                            <button
                              className="text-body text-textSecondary hover:text-textPrimary"
                              disabled={saving}
                              onClick={() => setEditingId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            className="text-body text-accent hover:text-accentHover"
                            onClick={() => startEdit(row)}
                          >
                            Editar
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </section>
    </div>
  );
}
