import { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className = "", ...props }: CardProps) {
  return <div className={`rounded border border-border bg-bgPrimary p-6 ${className}`} {...props} />;
}

export default Card;
