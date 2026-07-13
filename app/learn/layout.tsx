import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { ProgressProvider } from "@/components/providers/progress-provider";
import { source } from "@/lib/source";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      tabs={false}
      nav={{
        title: "Dash Academy",
        url: "/learn/create-a-dash-identity",
        transparentMode: "none",
      }}
    >
      <ProgressProvider>{children}</ProgressProvider>
    </DocsLayout>
  );
}
