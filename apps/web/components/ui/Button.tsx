import { ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-1 rounded border px-4 py-2 text-body font-medium transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-accent text-white hover:bg-accentHover",
  secondary: "border-border bg-transparent text-textPrimary hover:bg-bgTertiary",
  destructive: "border-transparent bg-error text-white hover:opacity-90",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", fullWidth = false, className = "", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
});

export default Button;
