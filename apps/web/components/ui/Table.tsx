import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * branding.md: header con fondo --bg-secondary y texto Label, filas separadas por
 * borde inferior de 1px, hover de fila --bg-tertiary, sin bordes verticales.
 */
export function Table({ className = "", ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded border border-border">
      <table className={`w-full border-collapse text-body text-textPrimary ${className}`} {...props} />
    </div>
  );
}

export function TableHead({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`bg-bgSecondary ${className}`} {...props} />;
}

export function TableBody({ className = "", ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Desactiva el hover en filas no interactivas (por ejemplo la del header). */
  hoverable?: boolean;
}

export function TableRow({ className = "", hoverable = true, ...props }: TableRowProps) {
  return (
    <tr
      className={`border-b border-border last:border-b-0 ${hoverable ? "hover:bg-bgTertiary" : ""} ${className}`}
      {...props}
    />
  );
}

export function TableHeaderCell({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-4 py-2 text-left text-label text-textSecondary ${className}`} {...props} />;
}

export function TableCell({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-2 text-left align-middle ${className}`} {...props} />;
}

export default Table;
