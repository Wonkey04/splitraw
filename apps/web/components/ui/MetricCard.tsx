import Link from "next/link";

export interface MetricCardProps {
  label: string;
  value: number | string;
  /** Link opcional bajo el valor (ej. "Ver miembros →"). Sin link si se omite. */
  href?: string;
  linkLabel?: string;
}

export function MetricCard({ label, value, href, linkLabel }: MetricCardProps) {
  return (
    <div className="rounded border border-border bg-bgPrimary p-4">
      <p className="text-[12px] font-medium uppercase tracking-wide text-textSecondary">{label}</p>
      <p className="mt-2 text-[26px] font-bold text-textPrimary">{value}</p>
      {href && linkLabel && (
        <Link href={href} className="mt-2 inline-block text-small font-medium text-accent hover:text-accentHover">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export default MetricCard;
