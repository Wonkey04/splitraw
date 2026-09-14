"use client";

import { useEffect, useState } from "react";
import { useRoutineExercises } from "@/lib/hooks/useRoutineExercises";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { Button, Input, Select } from "@/components/ui";

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
        className="fixed z-50 w-72 rounded border border-border bg-bgPrimary p-4"
        style={{ left, top }}
      >
        <div className="flex flex-col gap-4">
          <Select
            label="1. Grupo muscular"
            value={groupId}
            onChange={(e) => handleGroupChange(e.target.value)}
            autoFocus
            placeholder="Elegí un grupo"
            options={muscleGroups.map((g) => ({ value: String(g.id), label: g.name }))}
          />

          <Select
            label="2. Ejercicio"
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
            disabled={groupId === ""}
            placeholder={groupId === "" ? "Elegí un grupo primero" : "Elegí un ejercicio"}
            options={exercises.map((ex) => ({ value: ex.id, label: ex.name }))}
          />

          <div className="flex flex-col gap-1">
            <span className="text-label text-textSecondary">3. Volumen</span>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                min={1}
                max={10}
                placeholder="Sets"
                aria-label="Sets"
                className="font-mono"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
              />
              <Input
                type="number"
                min={1}
                max={50}
                placeholder="Reps"
                aria-label="Reps"
                className="font-mono"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
              <Input
                type="number"
                min={1}
                max={999}
                step="0.5"
                placeholder="Kg"
                aria-label="Peso en kilogramos"
                className="font-mono"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>

          <Select
            label="4. Día"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            options={DAYS_OF_WEEK.map((d) => ({ value: String(d.value), label: d.label }))}
          />

          {error && <p className="text-small text-error">{error}</p>}

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleAdd} disabled={groupId === "" || !catalogId}>
              Agregar
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
