import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/header";
import { ProgressProvider } from "@/components/providers/progress-provider";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <ProgressProvider>
      <div className="min-h-screen bg-background">
        <SiteHeader />
        {children}
      </div>
    </ProgressProvider>
  );
}
