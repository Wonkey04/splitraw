"use client";

import { useState } from "react";

export interface ValueEditorResult {
  sets: number;
  reps: number;
  weight: number;
}

interface ValueEditorProps {
  anchor: { x: number; y: number };
  title: string;
  initial: ValueEditorResult | null;
  onClose: () => void;
  onSave: (values: ValueEditorResult) => void;
  onRemove: () => void;
}

// Popover liviano: solo Sets/Reps/Peso, sin cascada. Se usa para una celda
// de una fila que YA tiene ejercicio asignado (agregar ese mismo ejercicio
// a otro dia, o editar/quitar los valores de un dia ya cargado).
export default function ValueEditor({ anchor, title, initial, onClose, onSave, onRemove }: ValueEditorProps) {
  const [sets, setSets] = useState(initial ? String(initial.sets) : "");
  const [reps, setReps] = useState(initial ? String(initial.reps) : "");
  const [weight, setWeight] = useState(initial ? String(initial.weight) : "");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);

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

    onSave({ sets: setsNum, reps: repsNum, weight: weightNum });
  }

  const left = Math.min(anchor.x, (typeof window !== "undefined" ? window.innerWidth : 1280) - 260);
  const top = Math.min(anchor.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 260);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-64 rounded-lg border border-gray-800 bg-bg-secondary p-4 shadow-lg"
        style={{ left, top }}
      >
        <h3 className="mb-3 text-sm font-semibold">{title}</h3>

        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            min={1}
            max={10}
            placeholder="Sets"
            className="input-field font-mono"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            autoFocus
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

        {error && <p className="mt-2 text-xs text-error">{error}</p>}

        <div className="mt-3 flex gap-2">
          <button className="btn-primary flex-1" onClick={handleSave}>
            Guardar
          </button>
          {initial && (
            <button
              className="flex-1 rounded border border-gray-700 text-sm text-text-secondary hover:border-error hover:text-error"
              onClick={onRemove}
            >
              Quitar
            </button>
          )}
        </div>
        <button className="mt-2 w-full text-xs text-text-secondary hover:text-text-primary" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </>
  );
}
