import { SVGProps } from "react";

// Íconos de línea propios (no stock), 20x20, heredan color por currentColor.
export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...props}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export function RoutineListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 5h9M4 10h12M4 15h7" />
      <circle cx="16.5" cy="5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="7.5" cy="7" r="2.5" />
      <path d="M2.5 16c0-2.76 2.24-4.5 5-4.5s5 1.74 5 4.5" />
      <circle cx="14.5" cy="7.5" r="2" />
      <path d="M13 11.7c1.98.4 3.5 1.9 3.5 4.3" />
    </svg>
  );
}

export function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M10 2.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L10 14.5l-4.7 2.45.9-5.23-3.8-3.7 5.25-.76z" />
    </svg>
  );
}
