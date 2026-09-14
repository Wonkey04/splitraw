import { InputHTMLAttributes, forwardRef, useId } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = "", id, disabled, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-label text-textSecondary">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={
          "w-full rounded border bg-bgPrimary px-4 py-2 text-body text-textPrimary outline-none " +
          "placeholder:text-textSecondary transition-colors " +
          // Foco: marco de 2px del color de acento, sin sombra (branding.md).
          "focus:outline focus:outline-2 focus:-outline-offset-2 " +
          (error
            ? "border-error focus:outline-error "
            : "border-border focus:border-accent focus:outline-accent ") +
          "disabled:cursor-not-allowed disabled:bg-bgTertiary disabled:text-textSecondary " +
          className
        }
        {...props}
      />
      {error && (
        <span id={errorId} className="text-small text-error">
          {error}
        </span>
      )}
    </div>
  );
});

export default Input;
