import type { Exercise } from "@/types";

/**
 * La tabla `exercises` no guarda tiempo de descanso ni tempo, así que la
 * duración de una rutina se ESTIMA a partir de las series.
 *
 * Modelo: por cada serie, el tiempo de trabajo efectivo más el descanso
 * posterior. Son los dos únicos valores a tocar si más adelante se agrega
 * el dato real por ejercicio (columna `rest_seconds`) — en ese caso este
 * archivo pasa a leer la columna y deja de estimar.
 */
export const SECONDS_PER_SET_WORK = 40;
export const SECONDS_PER_SET_REST = 90;

/** Minutos estimados de una lista de ejercicios, redondeados a múltiplos de 5. */
export function estimateDurationMinutes(exercises: Exercise[]): number {
  const totalSets = exercises.reduce((acc, ex) => acc + (ex.target_sets ?? 0), 0);
  if (totalSets === 0) return 0;

  const seconds = totalSets * (SECONDS_PER_SET_WORK + SECONDS_PER_SET_REST);
  const minutes = Math.round(seconds / 60 / 5) * 5;
  return Math.max(minutes, 5);
}
