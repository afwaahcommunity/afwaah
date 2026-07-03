import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { useSession } from "@/hooks/useSession";

export function AppShell({ children, maxWidth = "max-w-3xl" }: { children: ReactNode; maxWidth?: string }) {
  const { session } = useSession();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar session={session} />
      <main className={`mx-auto w-full ${maxWidth} px-4 py-6 sm:py-8`}>{children}</main>
    </div>
  );
}
