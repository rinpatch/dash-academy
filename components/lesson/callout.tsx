import type { ReactNode } from "react";

type CalloutType = "info" | "warn" | "warning" | "error" | "success" | "idea";

const ACCENT: Record<CalloutType, string> = {
  info: "border-primary bg-primary/12 text-primary",
  idea: "border-primary bg-primary/12 text-primary",
  warn: "border-warning bg-warning/15 text-warning",
  warning: "border-warning bg-warning/15 text-warning",
  error: "border-destructive bg-destructive/12 text-destructive",
  success: "border-mint bg-mint/20 text-mint-foreground",
};

export function Callout({
  type = "info",
  title,
  children,
}: {
  type?: CalloutType;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`not-prose my-6 flex gap-3 rounded-2xl border-l-4 bg-card p-4 ${ACCENT[type]}`}>
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-extrabold" aria-hidden="true">
        !
      </span>
      <div className="flex flex-col gap-1">
        {title && <p className="text-sm font-extrabold text-foreground">{title}</p>}
        <div className="text-sm font-medium leading-6 text-foreground/64 [&_p]:m-0">{children}</div>
      </div>
    </div>
  );
}
