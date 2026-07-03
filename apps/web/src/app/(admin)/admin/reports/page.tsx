"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { BanActionDialog } from "@/components/BanActionDialog";
import { ReportQueue } from "@/components/ReportQueue";
import { api } from "@/lib/api/client";
import { loadAdminSession } from "@/lib/session";
import type { Report } from "@/lib/types";

export default function ReportsPage() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== "undefined" && !loadAdminSession()) {
      router.replace("/admin/login");
    }
  }, [router]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.admin.reports(),
  });

  const [filter, setFilter] = useState<"all" | "open" | "resolved" | "dismissed">("open");
  const [banTarget, setBanTarget] = useState<Report | null>(null);

  const filtered = (data ?? []).filter((r) => filter === "all" || r.status === filter);

  return (
    <AdminShell>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Review reported content and take action.</p>
        </div>
        <div className="flex gap-1">
          {(["open", "resolved", "dismissed", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "rounded-md border px-2.5 py-1.5 text-xs capitalize " +
                (filter === f
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent")
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-lg border border-border" />
        ) : (
          <ReportQueue
            reports={filtered}
            onResolve={async (id) => {
              await api.admin.resolveReport(id);
              toast.success("Resolved");
              refetch();
            }}
            onDismiss={async (id) => {
              await api.admin.dismissReport(id);
              toast.success("Dismissed");
              refetch();
            }}
            onBan={(r) => setBanTarget(r)}
          />
        )}
      </div>

      <BanActionDialog
        open={!!banTarget}
        onClose={() => setBanTarget(null)}
        target={banTarget?.context?.displayName ?? banTarget?.targetId ?? "user"}
        onSubmit={async (b) => {
          if (!banTarget) return;
          await api.admin.banUser({
            userId: banTarget.reportedUserId ?? banTarget.targetId,
            kind: b.kind,
            reason: b.reason,
            expiresAt: b.expiresAt,
          });
          toast.success("Ban applied");
          refetch();
        }}
      />
    </AdminShell>
  );
}
