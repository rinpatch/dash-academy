import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div className={`flex flex-col gap-4 rounded-3xl bg-card p-4 ${className}`} {...props} />
  );
}
