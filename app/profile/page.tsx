import type { Metadata } from "next";
import Link from "next/link";
import { HardHat } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "My Profile",
};

export default function ProfilePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-var(--header-height))] max-w-[1360px] items-center justify-center px-4 py-16 sm:px-8">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <span className="flex size-16 items-center justify-center rounded-3xl bg-foreground/4 text-foreground/48">
          <HardHat size={28} aria-hidden="true" />
        </span>

        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Under construction</h1>
          <p className="text-base font-medium text-foreground/64">
            Your profile will collect the lessons you have finished, the testnet work you have
            verified, and the Exp you have earned. It is not built yet.
          </p>
          <p className="text-sm font-medium text-foreground/48">
            Your progress is still being recorded while you learn, so nothing is lost in the
            meantime.
          </p>
        </div>

        <Link href="/learn/what-is-a-blockchain" className={buttonVariants({ className: "rounded-xl" })}>
          Back to lessons
        </Link>
      </div>
    </main>
  );
}
