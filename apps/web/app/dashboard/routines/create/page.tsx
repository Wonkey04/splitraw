"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import ExerciseSelector, { type ExerciseSelectorResult } from "@/components/ExerciseSelector";
import ValueEditor, { type ValueEditorResult } from "@/components/ValueEditor";

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

// Pagina unica para crear una rutina: nombre + descripcion arriba, tabla
// ejercicio x dia en el medio. Las filas se crean via cascada Grupo
// Muscular -> Ejercicio (ExerciseSelector); las celdas de una fila que ya
// tiene ejercicio se cargan/editan con un popover liviano (ValueEditor).
// Todo se guarda junto recien al click en "Guardar Rutina".
export default function CreateRoutinePage() {
  const router = useRouter();
  const { profile } = useUserProfile();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [popover, setPopover] = useState<PopoverState>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

    router.push(`/dashboard/routines/${template.id}`);
  }

  const editingRow = popover?.type === "edit" ? rows.find((r) => r.rowId === popover.rowId) : null;
  const editingCell = editingRow && popover?.type === "edit" ? editingRow.cells[popover.day] ?? null : null;

  return (
    <div>
      <div className="card mb-6 space-y-4">
        <h1 className="text-2xl font-semibold">Crear Rutina</h1>

        <div>
          <label className="mb-1 block text-sm text-text-secondary">Nombre rutina</label>
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fullbody para Principiantes"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-text-secondary">Descripción</label>
          <textarea
            className="input-field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="4 días, ideal para comenzar"
            rows={2}
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button className="btn-primary w-full" onClick={handleSaveRoutine} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Rutina"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <thead>
            <tr className="bg-bg-secondary">
              <th className="border-b border-gray-800 px-2 py-2 text-sm text-text-secondary">Ejercicio</th>
              {DAYS_OF_WEEK.map((d) => (
                <th key={d.value} className="border-b border-gray-800 px-2 py-2 text-center text-sm text-text-secondary">
                  {d.label.slice(0, 3).toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.rowId} className={i % 2 === 0 ? "" : "bg-bg-secondary/40"}>
                <td className="border-b border-gray-800 px-2 py-2 text-sm">
                  {row.catalogName} <span className="text-text-secondary">({row.muscleGroupName})</span>
                  <button
                    className="ml-2 text-xs text-text-secondary hover:text-error"
                    onClick={() => removeRow(row.rowId)}
                    title="Quitar fila"
                  >
                    ✕
                  </button>
                </td>
                {DAYS_OF_WEEK.map((d) => {
                  const cell = row.cells[d.value];
                  return (
                    <td key={d.value} className="border-b border-gray-800 px-2 py-2 text-center">
                      <button
                        onClick={(e) => openEditPopover(row.rowId, d.value, e)}
                        className={
                          "w-full rounded border px-2 py-1 text-sm hover:border-primary " +
                          (cell ? "border-primary text-text-primary" : "border-gray-700 text-text-secondary")
                        }
                      >
                        {cell ? `${cell.sets}x${cell.reps}` : "-"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr>
              <td className="border-b border-gray-800 px-2 py-2 text-sm text-text-secondary">+ Agregar ejercicio</td>
              {DAYS_OF_WEEK.map((d) => (
                <td key={d.value} className="border-b border-gray-800 px-2 py-2 text-center">
                  <button
                    onClick={(e) => openNewPopover(d.value, e)}
                    className="w-full rounded border border-dashed border-gray-700 px-2 py-1 text-sm text-text-secondary hover:border-primary hover:text-primary"
                  >
                    +
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

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
