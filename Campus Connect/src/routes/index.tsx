import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/")({
  component: Bootstrap,
});

function Bootstrap() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/rooms", replace: true });
    }
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <span className="text-sm font-medium tracking-tight">campus</span>
        </div>
        <p className="text-xs text-muted-foreground">preparing your anonymous session…</p>
      </div>
    </div>
  );
}
