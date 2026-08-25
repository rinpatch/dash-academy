import * as React from "react";

import { cn } from "@/lib/utils";

const variants = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/85 active:bg-primary/75",
  ghost:
    "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80",
  outline:
    "border border-foreground/24 text-foreground/64 hover:bg-foreground/5 hover:text-foreground active:bg-foreground/10",
  link: "h-auto rounded-sm p-0 text-current underline underline-offset-4 hover:text-current",
} as const;

const sizes = {
  default: "h-10 px-4",
  sm: "h-8 px-3 text-xs",
  icon: "size-10 p-0",
  "icon-sm": "size-8 p-0",
} as const;

type ButtonVariant = keyof typeof variants;
type ButtonSize = keyof typeof sizes;

type ButtonVariantProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: ButtonVariantProps & { className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    sizes[size],
    variants[variant],
    className,
  );
}

function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: React.ComponentProps<"button"> & ButtonVariantProps) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={type}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonSize, ButtonVariant, ButtonVariantProps };
