"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { RoutineTemplate, Exercise } from "@/lib/types";
import ExerciseSelector, { type ExerciseSelectorResult } from "@/components/ExerciseSelector";
import ValueEditor, { type ValueEditorResult } from "@/components/ValueEditor";
import {
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

interface Row {
  rowId: string;
  catalogId: string;
  catalogName: string;
  muscleGroupName: string;
  cells: Record<number, ValueEditorResult>;
}

// Que popover esta abierto: "new" es la cascada para una fila nueva
// (dispara desde el "+" de la fila de abajo), "edit" es el popover liviano
// de solo valores para una celda de una fila que ya tiene ejercicio.
type PopoverState =
  | { type: "new"; day: number; anchor: { x: number; y: number } }
  | { type: "edit"; rowId: string; day: number; anchor: { x: number; y: number } }
  | null;

// Form completo de "crear rutina": nombre + descripcion arriba, tabla
// ejercicio x dia en el medio. Las filas se crean via cascada Grupo
// Muscular -> Ejercicio (ExerciseSelector); las celdas de una fila que ya
// tiene ejercicio se cargan/editan con un popover liviano (ValueEditor).
// Todo se guarda junto recien al click en "Guardar Rutina".
//
// Vive en components/ y no en la page porque lo usan DOS roles con la misma
// logica: el GYM_OWNER desde /dashboard/routines/create y el TRAINER desde
// /trainer/routines/create.
export interface CreateRoutineFormProps {
  /**
   * Base de la ruta de rutinas de quien la usa: `/dashboard/routines` para el
   * GYM_OWNER, `/trainer/routines` para el TRAINER. Lo unico que cambia entre
   * los dos es a donde se redirige despues de guardar.
   */
  basePath: string;
}

export default function CreateRoutineForm({ basePath }: CreateRoutineFormProps) {
  const router = useRouter();
  const { profile } = useUserProfile();

  // Paso 0: "desde cero" salta directo al form vacío (comportamiento de
  // siempre); "existente" muestra el selector de rutinas del gimnasio y
  // precarga el form en el cliente al elegir una — el submit de abajo es
  // el mismo INSERT de siempre, sin ninguna rama nueva.
  const [startMode, setStartMode] = useState<"choose" | "form" | "existing">("choose");
  const [sourceTemplates, setSourceTemplates] = useState<RoutineTemplate[]>([]);
  const [sourceTemplatesLoading, setSourceTemplatesLoading] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [popover, setPopover] = useState<PopoverState>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (startMode !== "existing" || !profile || sourceTemplates.length > 0) return;

    setSourceTemplatesLoading(true);
    supabase
      .from("routine_templates")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (!fetchError) setSourceTemplates((data as RoutineTemplate[]) ?? []);
        setSourceTemplatesLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMode, profile]);

  async function handlePickSource(templateId: string) {
    setSourceId(templateId);
    setSourceError(null);

    if (!templateId) return;

    setSourceLoading(true);
    try {
      const [templateRes, exercisesRes] = await Promise.all([
        supabase.from("routine_templates").select("*").eq("id", templateId).single(),
        supabase
          .from("exercises")
          .select("*")
          .eq("routine_template_id", templateId)
          .order("day_of_week", { ascending: true }),
      ]);

      if (templateRes.error || exercisesRes.error || !templateRes.data) {
        setSourceError("No se pudo cargar la rutina elegida.");
        return;
      }

      const [catalogRes, muscleGroupsRes] = await Promise.all([
        supabase.from("exercise_catalog").select("id, name, muscle_group_id"),
        supabase.from("muscle_groups").select("id, name"),
      ]);

      const muscleGroupNameById = new Map<number, string>(
        (muscleGroupsRes.data ?? []).map((g: { id: number; name: string }) => [g.id, g.name])
      );
      const catalogByName = new Map<string, { id: string; muscleGroupName: string }>(
        (catalogRes.data ?? []).map((c: { id: string; name: string; muscle_group_id: number }) => [
          c.name,
          { id: c.id, muscleGroupName: muscleGroupNameById.get(c.muscle_group_id) ?? "" },
        ])
      );

      const rowsByName = new Map<string, Row>();
      for (const ex of (exercisesRes.data as Exercise[]) ?? []) {
        let row = rowsByName.get(ex.name);
        if (!row) {
          const catalogInfo = catalogByName.get(ex.name);
          row = {
            rowId: crypto.randomUUID(),
            catalogId: catalogInfo?.id ?? crypto.randomUUID(),
            catalogName: ex.name,
            muscleGroupName: catalogInfo?.muscleGroupName ?? "",
            cells: {},
          };
          rowsByName.set(ex.name, row);
        }
        row.cells[ex.day_of_week] = {
          sets: ex.target_sets,
          reps: ex.target_reps,
          weight: ex.target_weight_kg,
        };
      }

      setName(templateRes.data.name);
      setDescription(templateRes.data.description ?? "");
      setRows(Array.from(rowsByName.values()));
      setStartMode("form");
    } finally {
      setSourceLoading(false);
    }
  }

  function openNewPopover(day: number, e: React.MouseEvent) {
    setPopover({ type: "new", day, anchor: { x: e.clientX, y: e.clientY } });
  }

  function openEditPopover(rowId: string, day: number, e: React.MouseEvent) {
    setPopover({ type: "edit", rowId, day, anchor: { x: e.clientX, y: e.clientY } });
  }

  function closePopover() {
    setPopover(null);
  }

  // La cascada puede resolver a una fila que YA existe (mismo ejercicio en
  // otra celda) para no duplicar filas del mismo ejercicio.
  function handleCascadeAdd(result: ExerciseSelectorResult) {
    setRows((prev) => {
      const existing = prev.find((r) => r.catalogId === result.catalogId);
      if (existing) {
        return prev.map((r) =>
          r.rowId === existing.rowId
            ? { ...r, cells: { ...r.cells, [result.day]: { sets: result.sets, reps: result.reps, weight: result.weight } } }
            : r
        );
      }
      return [
        ...prev,
        {
          rowId: crypto.randomUUID(),
          catalogId: result.catalogId,
          catalogName: result.catalogName,
          muscleGroupName: result.muscleGroupName,
          cells: { [result.day]: { sets: result.sets, reps: result.reps, weight: result.weight } },
        },
      ];
    });
    closePopover();
  }

  function handleEditSave(rowId: string, day: number, values: ValueEditorResult) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, cells: { ...r.cells, [day]: values } } : r)));
    closePopover();
  }

  function handleEditRemove(rowId: string, day: number) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const nextCells = { ...r.cells };
        delete nextCells[day];
        return { ...r, cells: nextCells };
      })
    );
    closePopover();
  }

  function removeRow(rowId: string) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  async function handleSaveRoutine() {
    setError(null);

    if (!name.trim()) {
      setError("El nombre de la rutina es obligatorio.");
      return;
    }
    if (!profile) {
      setError("Tu perfil no cargó todavía, esperá un segundo.");
      return;
    }

    const usableRows = rows.filter((r) => Object.keys(r.cells).length > 0);
    if (usableRows.length === 0) {
      setError("Agregá al menos un ejercicio con algún día cargado.");
      return;
    }

    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      setError("Tu sesión expiró, volvé a loguearte.");
      return;
    }

    const { data: template, error: templateError } = await supabase
      .from("routine_templates")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        organization_id: profile.organization_id,
        branch_id: profile.branch_id,
        created_by: userId,
      })
      .select()
      .single();

    if (templateError || !template) {
      setSaving(false);
      setError("No se pudo crear la rutina: " + (templateError?.message ?? "error desconocido"));
      return;
    }

    const exerciseRows = usableRows.flatMap((row) =>
      Object.entries(row.cells).map(([day, cell]) => ({
        routine_template_id: template.id,
        name: row.catalogName,
        day_of_week: Number(day),
        target_sets: cell.sets,
        target_reps: cell.reps,
        target_weight_kg: cell.weight,
      }))
    );

    const { error: exercisesError } = await supabase.from("exercises").insert(exerciseRows);

    setSaving(false);

    if (exercisesError) {
      setError("La rutina se creó pero falló al guardar los ejercicios: " + exercisesError.message);
      return;
    }

    router.push(`${basePath}/${template.id}`);
  }

  const editingRow = popover?.type === "edit" ? rows.find((r) => r.rowId === popover.rowId) : null;
  const editingCell = editingRow && popover?.type === "edit" ? editingRow.cells[popover.day] ?? null : null;

  if (startMode === "choose" || startMode === "existing") {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="flex flex-col gap-4">
          <h1 className="text-h1">¿Cómo querés empezar?</h1>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStartMode("form")}
              className="rounded border border-border bg-bgPrimary p-4 text-left transition-colors hover:border-accent hover:bg-bgTertiary"
            >
              <p className="text-body font-medium text-textPrimary">Desde cero</p>
              <p className="mt-1 text-small text-textSecondary">Armás la rutina desde un formulario vacío.</p>
            </button>

            <button
              onClick={() => setStartMode("existing")}
              className={
                "rounded border p-4 text-left transition-colors hover:border-accent hover:bg-bgTertiary " +
                (startMode === "existing" ? "border-accent bg-bgTertiary" : "border-border bg-bgPrimary")
              }
            >
              <p className="text-body font-medium text-textPrimary">Traer de una rutina existente</p>
              <p className="mt-1 text-small text-textSecondary">
                Elegís una rutina ya creada y partís de sus ejercicios, sets, reps y peso.
              </p>
            </button>
          </div>

          {startMode === "existing" && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              {sourceTemplatesLoading && <p className="text-body text-textSecondary">Cargando rutinas...</p>}

              {!sourceTemplatesLoading && sourceTemplates.length === 0 && (
                <p className="text-body text-textSecondary">Todavía no hay rutinas creadas en este gimnasio.</p>
              )}

              {!sourceTemplatesLoading && sourceTemplates.length > 0 && (
                <Select
                  label="Rutina de partida"
                  value={sourceId}
                  onChange={(e) => handlePickSource(e.target.value)}
                  disabled={sourceLoading}
                  placeholder="Elegí una rutina"
                  options={sourceTemplates.map((t) => ({ value: t.id, label: t.name }))}
                />
              )}

              {sourceLoading && <p className="text-body text-textSecondary">Cargando ejercicios...</p>}
              {sourceError && <p className="text-small text-error">{sourceError}</p>}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Card className="mb-6 flex flex-col gap-4">
        <h1 className="text-h1">Crear rutina</h1>

        <Input
          label="Nombre de la rutina"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fullbody para principiantes"
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="routine-description" className="text-label text-textSecondary">
            Descripción
          </label>
          <textarea
            id="routine-description"
            className="w-full rounded border border-border bg-bgPrimary px-4 py-2 text-body text-textPrimary outline-none transition-colors placeholder:text-textSecondary focus:border-accent focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="4 días, ideal para comenzar"
            rows={2}
          />
        </div>

        {error && <p className="text-small text-error">{error}</p>}

        <Button fullWidth onClick={handleSaveRoutine} disabled={saving}>
          {saving ? "Guardando..." : "Guardar rutina"}
        </Button>
      </Card>

      <Table className="min-w-[700px]">
        <TableHead>
          <TableRow hoverable={false}>
            <TableHeaderCell>Ejercicio</TableHeaderCell>
            {DAYS_OF_WEEK.map((d) => (
              <TableHeaderCell key={d.value} className="text-center">
                {d.label.slice(0, 3)}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.rowId}>
              <TableCell>
                {row.catalogName}{" "}
                {/* El grupo muscular puede venir vacio: `exercises` guarda solo
                    el nombre en texto libre, sin FK al catalogo, asi que una
                    rutina precargada cuyo ejercicio no matchea el catalogo no
                    tiene grupo que mostrar. Antes se pintaba "Press banca ()". */}
                {row.muscleGroupName && (
                  <span className="text-textSecondary">({row.muscleGroupName})</span>
                )}
                <button
                  className="ml-2 rounded text-small text-textSecondary hover:text-error"
                  onClick={() => removeRow(row.rowId)}
                  title="Quitar fila"
                >
                  ✕
                </button>
              </TableCell>
              {DAYS_OF_WEEK.map((d) => {
                const cell = row.cells[d.value];
                return (
                  <TableCell key={d.value} className="text-center">
                    <button
                      onClick={(e) => openEditPopover(row.rowId, d.value, e)}
                      className={
                        "w-full rounded border px-2 py-1 text-body transition-colors hover:border-accent " +
                        (cell ? "border-accent text-textPrimary" : "border-border text-textSecondary")
                      }
                    >
                      {cell ? `${cell.sets}x${cell.reps}` : "-"}
                    </button>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}

          <TableRow hoverable={false}>
            <TableCell>
              {/* Antes era texto plano y no se leia como accion. Ahora es un
                  boton del sistema; la cascada se abre igual que con los "+"
                  de cada dia (el dia se elige adentro del popover). */}
              <Button variant="secondary" onClick={(e) => openNewPopover(1, e)}>
                + Agregar ejercicio
              </Button>
            </TableCell>
            {DAYS_OF_WEEK.map((d) => (
              <TableCell key={d.value} className="text-center">
                <button
                  onClick={(e) => openNewPopover(d.value, e)}
                  className="w-full rounded border border-dashed border-border px-2 py-1 text-body text-textSecondary transition-colors hover:border-accent hover:text-accent"
                >
                  +
                </button>
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>

      {popover?.type === "new" && (
        <ExerciseSelector anchor={popover.anchor} defaultDay={popover.day} onClose={closePopover} onAdd={handleCascadeAdd} />
      )}

      {popover?.type === "edit" && editingRow && (
        <ValueEditor
          anchor={popover.anchor}
          title={`${editingRow.catalogName} — ${DAYS_OF_WEEK.find((d) => d.value === popover.day)?.label}`}
          initial={editingCell}
          onClose={closePopover}
          onSave={(values) => handleEditSave(popover.rowId, popover.day, values)}
          onRemove={() => handleEditRemove(popover.rowId, popover.day)}
        />
      )}
    </div>
  );
}
