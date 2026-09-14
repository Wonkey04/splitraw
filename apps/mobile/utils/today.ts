/**
 * Fecha calendario local en formato YYYY-MM-DD, que es lo que espera una
 * columna `date` de Postgres. No se usa toISOString(): eso convierte a UTC
 * y en Argentina (UTC-3) adelantaría el día para cualquier registro hecho
 * después de las 21:00.
 */
export function todayISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}
