"use client";

import { CircleCheckIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "system"}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-mint" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border-foreground/12 !bg-card !text-card-foreground !font-sans",
          description: "!text-foreground/64",
          actionButton: "!rounded-lg !bg-primary !text-primary-foreground !font-medium",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
