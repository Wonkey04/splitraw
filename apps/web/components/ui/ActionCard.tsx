import Link from "next/link";
import { ReactNode } from "react";

export interface ActionCardProps {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  variant?: "primary" | "secondary";
}

// Card de "acción rápida" del home del dueño: ícono en círculo arriba,
// título y descripción abajo. La primaria (fondo accent) es para la acción
// principal de la pantalla; las secundarias comparten el mismo molde con
// fondo blanco y el ícono en un círculo de color.
export function ActionCard({ href, icon, title, description, variant = "secondary" }: ActionCardProps) {
  const isPrimary = variant === "primary";

  return (
    <Link
      href={href}
      className={`flex flex-col rounded border p-4 transition-colors ${
        isPrimary
          ? "border-transparent bg-accent hover:bg-accentHover"
          : "border-border bg-bgPrimary hover:border-accent"
      }`}
    >
      <span
        className={`mb-3 flex h-[38px] w-[38px] items-center justify-center rounded-full ${
          isPrimary ? "bg-white/15 text-white" : "bg-[#EFF4FF] text-accent"
        }`}
      >
        {icon}
      </span>
      <span className={`text-[15px] font-bold ${isPrimary ? "text-white" : "text-textPrimary"}`}>
        {title}
      </span>
      <span className={`mt-1 text-[12.5px] ${isPrimary ? "text-white/85" : "text-textSecondary"}`}>
        {description}
      </span>
    </Link>
  );
}

export default ActionCard;
