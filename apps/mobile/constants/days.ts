// Matches apps/web/lib/constants.ts: day_of_week is 1 (Lunes) .. 7 (Domingo).
export const DAYS_OF_WEEK = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

export function dayLabel(day: number): string {
  return DAYS_OF_WEEK.find((d) => d.value === day)?.label ?? "";
}

// JS Date#getDay() returns 0 (Sun) .. 6 (Sat); remap to 1 (Mon) .. 7 (Sun).
export function getTodayDayOfWeek(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function nextDay(day: number): number {
  return day === 7 ? 1 : day + 1;
}

export function previousDay(day: number): number {
  return day === 1 ? 7 : day - 1;
}
