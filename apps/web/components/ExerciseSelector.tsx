"use client";

import { useEffect, useState } from "react";
import { useRoutineExercises } from "@/lib/hooks/useRoutineExercises";
import { DAYS_OF_WEEK } from "@/lib/constants";

export interface ExerciseSelectorResult {
  catalogId: string;
  catalogName: string;
  muscleGroupName: string;
  day: number;
  sets: number;
  reps: number;
  weight: number;
}

interface ExerciseSelectorProps {
  anchor: { x: number; y: number };
  defaultDay: number;
  onClose: () => void;
  onAdd: (result: ExerciseSelectorResult) => void;
}

// Popover cascada: Grupo Muscular -> Ejercicio -> Sets/Reps/Peso -> Dia.
// Se usa para agregar un ejercicio NUEVO (una fila nueva) a la tabla de
// rutina. Los grupos se traen al montar, los ejercicios de cada grupo
// recien cuando se elige ese grupo (useRoutineExercises hace el cache).
export default function ExerciseSelector({ anchor, defaultDay, onClose, onAdd }: ExerciseSelectorProps) {
  const { muscleGroups, exercisesByGroup, fetchExercises } = useRoutineExercises();

  const [groupId, setGroupId] = useState<number | "">("");
  const [catalogId, setCatalogId] = useState("");
  const [day, setDay] = useState(defaultDay);
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (groupId !== "") fetchExercises(groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const exercises = groupId === "" ? [] : exercisesByGroup.get(groupId) ?? [];

  function handleGroupChange(value: string) {
    setGroupId(value === "" ? "" : Number(value));
    setCatalogId("");
  }

  function handleAdd() {
    setError(null);

    if (groupId === "" || !catalogId) {
      setError("Elegí grupo muscular y ejercicio.");
      return;
    }

    const setsNum = Number(sets);
    const repsNum = Number(reps);
    const weightNum = Number(weight);

    if (!Number.isInteger(setsNum) || setsNum <= 0 || setsNum > 10) {
      setError("Sets: número entero entre 1 y 10.");
      return;
    }
    if (!Number.isInteger(repsNum) || repsNum <= 0 || repsNum > 50) {
      setError("Reps: número entero entre 1 y 50.");
      return;
    }
    if (Number.isNaN(weightNum) || weightNum <= 0 || weightNum > 999) {
      setError("Peso: número entre 1 y 999 kg.");
      return;
    }

    const group = muscleGroups.find((g) => g.id === groupId);
    const catalogItem = exercises.find((e) => e.id === catalogId);
    if (!group || !catalogItem) {
      setError("Ejercicio inválido.");
      return;
    }

    onAdd({
      catalogId: catalogItem.id,
      catalogName: catalogItem.name,
      muscleGroupName: group.name,
      day,
      sets: setsNum,
      reps: repsNum,
      weight: weightNum,
    });
  }

  // Clamp simple para que el popover no se salga de la pantalla.
  const left = Math.min(anchor.x, (typeof window !== "undefined" ? window.innerWidth : 1280) - 300);
  const top = Math.min(anchor.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 420);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-72 rounded-lg border border-gray-800 bg-bg-secondary p-4 shadow-lg"
        style={{ left, top }}
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-text-secondary">
              1. Grupo Muscular
            </label>
            <select
              className="input-field"
              value={groupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              autoFocus
            >
              <option value="">Elegí un grupo</option>
              {muscleGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-text-secondary">
              2. Ejercicio
            </label>
            <select
              className="input-field disabled:cursor-not-allowed disabled:opacity-50"
              value={catalogId}
              onChange={(e) => setCatalogId(e.target.value)}
              disabled={groupId === ""}
            >
              <option value="">{groupId === "" ? "Elegí un grupo primero" : "Elegí un ejercicio"}</option>
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-text-secondary">
              3. Volumen
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                min={1}
                max={10}
                placeholder="Sets"
                className="input-field font-mono"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
              />
              <input
                type="number"
                min={1}
                max={50}
                placeholder="Reps"
                className="input-field font-mono"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
              <input
                type="number"
                min={1}
                max={999}
                step="0.5"
                placeholder="Kg"
                className="input-field font-mono"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-text-secondary">
              4. Día
            </label>
            <select className="input-field" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {DAYS_OF_WEEK.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-error">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              className="flex-1 rounded bg-gray-700 py-2 text-sm text-white hover:bg-gray-600"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleAdd}
              disabled={groupId === "" || !catalogId}
            >
              Agregar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
