import { SelectHTMLAttributes, forwardRef, useId } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options, placeholder, className = "", id, ...props },
  ref
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-label text-textSecondary">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={
          "w-full appearance-none rounded border bg-bgPrimary px-4 py-2 text-body text-textPrimary outline-none " +
          "transition-colors focus:outline focus:outline-2 focus:-outline-offset-2 " +
          (error ? "border-error focus:outline-error " : "border-border focus:border-accent focus:outline-accent ") +
          "disabled:cursor-not-allowed disabled:bg-bgTertiary disabled:text-textSecondary " +
          className
        }
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={errorId} className="text-small text-error">
          {error}
        </span>
      )}
    </div>
  );
});

export default Select;
