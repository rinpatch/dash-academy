import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/header";
import { ProgressProvider } from "@/components/providers/progress-provider";
import { ProgressSyncProvider } from "@/components/providers/progress-sync-provider";
import { NotesProvider } from "@/components/providers/notes-provider";
import { Toaster } from "@/components/ui/sonner";

/** The header reads progress and notes state, so every page that shows it needs these providers. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <ProgressProvider>
      <ProgressSyncProvider>
        <NotesProvider>
          <div className="min-h-screen bg-background">
            <SiteHeader />
            {children}
          </div>
        </NotesProvider>
        <Toaster position="bottom-right" />
      </ProgressSyncProvider>
    </ProgressProvider>
  );
}
