"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { useUserProfile } from "@/lib/context/UserProfileContext";
import type { ExerciseCatalog } from "@/lib/types";

interface CellData {
  sets: number;
  reps: number;
  weight: number;
}

interface Row {
  rowId: string;
  catalogId: string;
  cells: Record<number, CellData>;
}

function emptyRow(): Row {
  return { rowId: crypto.randomUUID(), catalogId: "", cells: {} };
}

// Pagina unica para crear una rutina: nombre + descripcion arriba, tabla
// ejercicio x dia en el medio. Filas se agregan a mano, cada celda se
// carga con un popup (sets/reps/peso). Todo se guarda junto al final.
export default function CreateRoutinePage() {
  const router = useRouter();
  const { profile } = useUserProfile();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [catalog, setCatalog] = useState<ExerciseCatalog[]>([]);

  const [modalCell, setModalCell] = useState<{ rowId: string; day: number } | null>(null);
  const [modalSets, setModalSets] = useState("");
  const [modalReps, setModalReps] = useState("");
  const [modalWeight, setModalWeight] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("exercise_catalog")
      .select("*")
      .order("muscle_group_id")
      .then(({ data }) => setCatalog((data as ExerciseCatalog[]) ?? []));
  }, []);

  function updateRowCatalog(rowId: string, catalogId: string) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, catalogId } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  function openModal(rowId: string, day: number) {
    const row = rows.find((r) => r.rowId === rowId);
    const existing = row?.cells[day];
    setModalCell({ rowId, day });
    setModalSets(existing ? String(existing.sets) : "");
    setModalReps(existing ? String(existing.reps) : "");
    setModalWeight(existing ? String(existing.weight) : "");
    setModalError(null);
  }

  function closeModal() {
    setModalCell(null);
  }

  function handleModalSave() {
    if (!modalCell) return;
    const row = rows.find((r) => r.rowId === modalCell.rowId);
    if (!row?.catalogId) {
      setModalError("Elegí un ejercicio para esta fila primero.");
      return;
    }

    const setsNum = Number(modalSets);
    const repsNum = Number(modalReps);
    const weightNum = Number(modalWeight);

    if (!Number.isInteger(setsNum) || setsNum <= 0) {
      setModalError("Sets debe ser un número entero positivo.");
      return;
    }
    if (!Number.isInteger(repsNum) || repsNum <= 0) {
      setModalError("Reps debe ser un número entero positivo.");
      return;
    }
    if (Number.isNaN(weightNum) || weightNum < 0) {
      setModalError("El peso debe ser un número válido.");
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        r.rowId === modalCell.rowId
          ? { ...r, cells: { ...r.cells, [modalCell.day]: { sets: setsNum, reps: repsNum, weight: weightNum } } }
          : r
      )
    );
    closeModal();
  }

  function handleModalRemove() {
    if (!modalCell) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== modalCell.rowId) return r;
        const nextCells = { ...r.cells };
        delete nextCells[modalCell.day];
        return { ...r, cells: nextCells };
      })
    );
    closeModal();
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

    const usableRows = rows.filter((r) => r.catalogId && Object.keys(r.cells).length > 0);
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

    const exerciseRows = usableRows.flatMap((row) => {
      const catalogItem = catalog.find((c) => c.id === row.catalogId);
      return Object.entries(row.cells).map(([day, cell]) => ({
        routine_template_id: template.id,
        name: catalogItem?.name ?? "Ejercicio",
        day_of_week: Number(day),
        target_sets: cell.sets,
        target_reps: cell.reps,
        target_weight_kg: cell.weight,
      }));
    });

    const { error: exercisesError } = await supabase.from("exercises").insert(exerciseRows);

    setSaving(false);

    if (exercisesError) {
      setError("La rutina se creó pero falló al guardar los ejercicios: " + exercisesError.message);
      return;
    }

    router.push(`/dashboard/routines/${template.id}`);
  }

  const modalRow = modalCell ? rows.find((r) => r.rowId === modalCell.rowId) : null;

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
              <th className="border-b border-gray-800 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.rowId} className={i % 2 === 0 ? "" : "bg-bg-secondary/40"}>
                <td className="border-b border-gray-800 px-2 py-2">
                  <select
                    className="input-field"
                    value={row.catalogId}
                    onChange={(e) => updateRowCatalog(row.rowId, e.target.value)}
                  >
                    <option value="">Elegí un ejercicio</option>
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                {DAYS_OF_WEEK.map((d) => {
                  const cell = row.cells[d.value];
                  return (
                    <td key={d.value} className="border-b border-gray-800 px-2 py-2 text-center">
                      <button
                        onClick={() => openModal(row.rowId, d.value)}
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
                <td className="border-b border-gray-800 px-2 py-2">
                  <button
                    className="text-sm text-text-secondary hover:text-error"
                    onClick={() => removeRow(row.rowId)}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="mt-4 text-sm text-primary hover:underline" onClick={addRow}>
        + Agregar ejercicio
      </button>

      {modalCell && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 px-4">
          <div className="card w-full max-w-sm">
            <h2 className="mb-4 font-semibold">
              {catalog.find((c) => c.id === modalRow?.catalogId)?.name ?? "Ejercicio"} —{" "}
              {DAYS_OF_WEEK.find((d) => d.value === modalCell.day)?.label}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Sets</label>
                  <input
                    type="number"
                    min={1}
                    className="input-field"
                    value={modalSets}
                    onChange={(e) => setModalSets(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Reps</label>
                  <input
                    type="number"
                    min={1}
                    className="input-field"
                    value={modalReps}
                    onChange={(e) => setModalReps(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Peso (kg)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    className="input-field"
                    value={modalWeight}
                    onChange={(e) => setModalWeight(e.target.value)}
                  />
                </div>
              </div>

              {modalError && <p className="text-sm text-error">{modalError}</p>}

              <div className="flex gap-3">
                <button className="btn-primary flex-1" onClick={handleModalSave}>
                  Guardar
                </button>
                <button
                  className="flex-1 rounded border border-gray-700 py-2 text-sm text-text-secondary hover:border-error hover:text-error"
                  onClick={handleModalRemove}
                >
                  Quitar
                </button>
              </div>
              <button className="w-full text-sm text-text-secondary hover:text-text-primary" onClick={closeModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
