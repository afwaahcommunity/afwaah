"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, MapPin, Save } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api/client";
import { loadAdminSession } from "@/lib/session";
import { timeAgo } from "@/lib/time";
import type { GeofenceSettings } from "@/lib/types";

const RADIUS_PRESETS = [
  { label: "Campus", value: 5 },
  { label: "City", value: 50 },
  { label: "State", value: 500 },
  { label: "Vacation", value: 2500 },
] as const;

export default function AdminSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [radius, setRadius] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !loadAdminSession()) {
      router.replace("/admin/login");
    }
  }, [router]);

  const { data, error, isLoading } = useQuery({
    queryKey: ["admin-geofence"],
    queryFn: () => api.admin.geofence(),
  });

  useEffect(() => {
    if (data) setRadius(formatRadius(data.radiusKm));
  }, [data]);

  const radiusValue = Number(radius);
  const validRadius =
    Number.isFinite(radiusValue) && radiusValue >= 0.1 && radiusValue <= 50000;
  const invalidRadius = radius.length > 0 && !validRadius;
  const changed = Boolean(
    data && validRadius && Math.abs(radiusValue - data.radiusKm) >= 0.01,
  );

  const updateRadius = useMutation({
    mutationFn: (value: number) => api.admin.updateGeofenceRadius(value),
    onSuccess: (settings) => {
      queryClient.setQueryData(["admin-geofence"], settings);
      setRadius(formatRadius(settings.radiusKm));
      toast.success("Radius updated");
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validRadius) {
      toast.error("Enter a radius between 0.1 and 50,000 km");
      return;
    }
    updateRadius.mutate(radiusValue);
  };

  const errorText = useMemo(() => {
    if (!error) return null;
    return error instanceof Error ? error.message : "Failed to load settings";
  }, [error]);

  return (
    <AdminShell>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Campus access controls.
          </p>
        </div>
        {data && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            {formatRadius(data.radiusKm)} km active
          </span>
        )}
      </div>

      <section className="mt-5 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-muted-foreground">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-medium">Location radius</h2>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : (data?.name ?? "Default geofence")}
              </p>
            </div>
          </div>
          {data && (
            <span className="text-xs text-muted-foreground">
              Updated {timeAgo(data.updatedAt)}
            </span>
          )}
        </div>

        <form onSubmit={submit} className="space-y-5 p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_16rem]">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Radius in kilometers
              </span>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="number"
                  min="0.1"
                  max="50000"
                  step="0.1"
                  value={radius}
                  onChange={(event) => setRadius(event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  placeholder="5"
                />
                <button
                  type="submit"
                  disabled={!changed || updateRadius.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {updateRadius.isPending ? "Saving" : "Save"}
                </button>
              </div>
            </label>

            <div className="grid grid-cols-2 gap-2">
              {RADIUS_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setRadius(String(preset.value))}
                  className="rounded-md border border-border px-3 py-2 text-left text-xs hover:bg-accent"
                >
                  <span className="block font-medium">{preset.label}</span>
                  <span className="text-muted-foreground">
                    {preset.value} km
                  </span>
                </button>
              ))}
            </div>
          </div>

          {data && <GeofenceMeta settings={data} />}

          {(errorText || updateRadius.error || invalidRadius) && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {updateRadius.error instanceof Error
                  ? updateRadius.error.message
                  : (errorText ??
                    "Radius must stay between 0.1 and 50,000 km.")}
              </span>
            </div>
          )}
        </form>
      </section>
    </AdminShell>
  );
}

function GeofenceMeta({ settings }: { settings: GeofenceSettings }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
      <MetaItem
        label="Center latitude"
        value={settings.centerLatitude.toFixed(6)}
      />
      <MetaItem
        label="Center longitude"
        value={settings.centerLongitude.toFixed(6)}
      />
      <MetaItem
        label="Current radius"
        value={`${formatRadius(settings.radiusKm)} km`}
      />
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function formatRadius(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}
