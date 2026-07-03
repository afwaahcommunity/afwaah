import { MapPin } from "lucide-react";
import type { WriteAccessState } from "@/lib/types";

export function LocationStatus({ state }: { state: WriteAccessState }) {
  const map = {
    allowed: { label: "On campus", color: "var(--success)" },
    off_campus: { label: "Off campus", color: "var(--warning)" },
    unverified: { label: "Unverified", color: "var(--muted-foreground)" },
    denied: { label: "Permission denied", color: "var(--warning)" },
    loading: { label: "Checking…", color: "var(--muted-foreground)" },
    error: { label: "Error", color: "var(--destructive)" },
  } as const;
  const m = map[state.kind];
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
      <MapPin className="h-3.5 w-3.5" style={{ color: m.color }} />
      <span style={{ color: m.color }}>{m.label}</span>
    </div>
  );
}
