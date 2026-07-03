import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api/client";
import { useSession } from "@/hooks/useSession";
import { MapPin, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/verify-location")({
  head: () => ({
    meta: [
      { title: "Verify location — campus" },
      { name: "description", content: "Verify your location to send messages." },
    ],
  }),
  component: VerifyLocation,
});

function VerifyLocation() {
  const { session, setWriteAccess } = useSession();
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "loading" | "allowed" | "off_campus" | "denied" | "error">(
    session?.writeAccess.kind === "allowed" ? "allowed"
    : session?.writeAccess.kind === "off_campus" ? "off_campus"
    : session?.writeAccess.kind === "denied" ? "denied"
    : "idle"
  );

  const verify = async () => {
    setState("loading");
    setWriteAccess({ kind: "loading" });
    try {
      if (!("geolocation" in navigator)) {
        setState("error");
        setWriteAccess({ kind: "error", message: "Geolocation unsupported" });
        return;
      }
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
      }).catch((err) => {
        if (err?.code === 1) {
          setState("denied");
          setWriteAccess({ kind: "denied" });
          throw err;
        }
        throw err;
      });
      const res = await api.session.verifyLocation();
      setState(res.kind === "allowed" ? "allowed" : res.kind === "off_campus" ? "off_campus" : "denied");
      setWriteAccess(res);
      if (res.kind === "allowed") toast.success("Location verified");
    } catch {
      // handled above
    }
  };

  const Icon =
    state === "allowed" ? CheckCircle2
    : state === "off_campus" || state === "denied" ? XCircle
    : state === "error" ? AlertCircle
    : MapPin;

  const iconColor =
    state === "allowed" ? "var(--success)"
    : state === "off_campus" || state === "denied" || state === "error" ? "var(--warning)"
    : "var(--muted-foreground)";

  const title =
    state === "allowed" ? "You're on campus"
    : state === "off_campus" ? "You're off campus"
    : state === "denied" ? "Location permission denied"
    : state === "error" ? "Couldn't check location"
    : state === "loading" ? "Checking location…"
    : "Verify your location";

  const body =
    state === "allowed" ? "You can send messages anywhere in campus chat."
    : state === "off_campus" ? "You can browse and read, but sending is disabled off campus."
    : state === "denied" ? "Enable location access in your browser to write."
    : state === "loading" ? "Hang tight for a moment."
    : "Location is only used to enable write access. Reading works from anywhere.";

  return (
    <AppShell maxWidth="max-w-lg">
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: `color-mix(in oklab, ${iconColor} 15%, transparent)` }}
        >
          <Icon className="h-6 w-6" style={{ color: iconColor }} />
        </div>
        <h1 className="mt-4 text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>

        <div className="mt-6 flex justify-center gap-2">
          {state === "allowed" ? (
            <button
              onClick={() => navigate({ to: "/rooms" })}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Continue
            </button>
          ) : (
            <button
              disabled={state === "loading"}
              onClick={verify}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {state === "loading" ? "Checking…" : state === "idle" ? "Verify now" : "Try again"}
            </button>
          )}
          <Link
            to="/rooms"
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
          >
            Skip for now
          </Link>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Location is only used to gate writing. It is not stored or shared.
        </p>
      </div>
    </AppShell>
  );
}
