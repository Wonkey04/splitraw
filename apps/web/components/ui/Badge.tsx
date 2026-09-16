import { HTMLAttributes } from "react";

export type BadgeVariant = "success" | "error" | "warning" | "neutral" | "primary";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/**
 * branding.md: fondo del color funcional al 10%, borde 1px del color al 30%,
 * texto del color pleno. El color sale siempre de la variable, nunca de un hex.
 */
const tokenVar: Record<BadgeVariant, string> = {
  success: "var(--success)",
  error: "var(--error)",
  warning: "var(--warning)",
  neutral: "var(--text-secondary)",
  primary: "var(--accent)",
};

export function Badge({ variant = "neutral", className = "", style, ...props }: BadgeProps) {
  const color = tokenVar[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-small ${className}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
        color,
        ...style,
      }}
      {...props}
    />
  );
}

export default Badge;
