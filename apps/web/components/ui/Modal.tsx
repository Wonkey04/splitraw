"use client";

import { ReactNode, useEffect, useId, useRef } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Acciones al pie (botones). */
  footer?: ReactNode;
}

/**
 * branding.md: card centrada, ancho máximo 480px, overlay rgba(26, 32, 44, 0.4).
 */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--overlay)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="w-full max-w-[480px] rounded border border-border bg-bgPrimary p-6 outline-none"
      >
        {title && (
          <h2 id={titleId} className="mb-4 text-h3 text-textPrimary">
            {title}
          </h2>
        )}
        <div className="text-body text-textPrimary">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
