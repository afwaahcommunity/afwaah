import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api/client";
import {
  clearSession,
  loadSession,
  saveSession,
  SESSION_CHANGED_EVENT,
} from "@/lib/session";
import {
  canUseGeolocationSilently,
  getReliableBrowserPosition,
  isGeolocationPositionError,
  VERIFY_REQUEST_TIMEOUT_MS,
  withTimeout,
} from "@/lib/location";
import type { AnonSession, WriteAccessState } from "@/lib/types";

const LOCATION_REFRESH_LEAD_MS = 2 * 60 * 1000;
const AUTO_REFRESH_COOLDOWN_MS = 15 * 1000;

let autoRefreshPromise: Promise<WriteAccessState | null> | null = null;
let lastAutoRefreshAt = 0;

export function useSession() {
  const [session, setSession] = useState<AnonSession | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<AnonSession | null>(null);

  const commitSession = useCallback((next: AnonSession | null) => {
    sessionRef.current = next;
    if (next) {
      saveSession(next);
    } else {
      clearSession();
    }
    setSession(next);
  }, []);

  useEffect(() => {
    const existing = loadSession();
    sessionRef.current = existing;
    if (existing) {
      setSession(existing);
      setLoading(false);
    }
    api.session.bootstrap(existing).then((s) => {
      commitSession(s);
      setLoading(false);
    });
  }, [commitSession]);

  useEffect(() => {
    const syncSession = () => {
      const next = loadSession();
      sessionRef.current = next;
      setSession(next);
    };

    window.addEventListener(SESSION_CHANGED_EVENT, syncSession);
    window.addEventListener("storage", syncSession);

    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  const update = useCallback((patch: Partial<AnonSession>) => {
    const current = sessionRef.current;
    if (!current) return;

    commitSession({ ...current, ...patch });
  }, [commitSession]);

  const setWriteAccess = useCallback((w: WriteAccessState) => {
    update({ writeAccess: w });
  }, [update]);

  useEffect(() => {
    if (!session) return;
    if (session.ban?.kind === "hard") return;

    const delayMs = getLocationRefreshDelay(session.writeAccess);
    if (delayMs === null) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const refreshed = await refreshLocationIfAllowed();
      if (cancelled || !refreshed) return;

      const current = sessionRef.current;
      if (!current || current.token !== session.token) return;

      commitSession({ ...current, writeAccess: refreshed });
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    session,
    session?.ban?.kind,
    session?.token,
    session?.writeAccess.kind,
    session?.writeAccess.kind === "allowed"
      ? session.writeAccess.validUntil
      : undefined,
  ]);

  const reset = useCallback(() => {
    commitSession(null);
  }, [commitSession]);

  return { session, loading, update, setWriteAccess, reset };
}

function getLocationRefreshDelay(writeAccess: WriteAccessState): number | null {
  if (writeAccess.kind === "unverified") return 0;
  if (writeAccess.kind !== "allowed") return null;
  if (!writeAccess.validUntil) return 0;

  const refreshAt =
    new Date(writeAccess.validUntil).getTime() - LOCATION_REFRESH_LEAD_MS;
  const delayMs = refreshAt - Date.now();

  return Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0;
}

async function refreshLocationIfAllowed(): Promise<WriteAccessState | null> {
  if (autoRefreshPromise) return autoRefreshPromise;
  if (Date.now() - lastAutoRefreshAt < AUTO_REFRESH_COOLDOWN_MS) return null;

  autoRefreshPromise = refreshLocation();

  try {
    return await autoRefreshPromise;
  } finally {
    autoRefreshPromise = null;
    lastAutoRefreshAt = Date.now();
  }
}

async function refreshLocation(): Promise<WriteAccessState | null> {
  const canRefresh = await canUseGeolocationSilently();
  if (!canRefresh) {
    return api.session.checkLocationStatus();
  }

  try {
    const position = await getReliableBrowserPosition();
    return await withTimeout(
      api.session.verifyLocation({
        accuracyMeters: position.coords.accuracy,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      VERIFY_REQUEST_TIMEOUT_MS,
      "Location refresh took too long.",
    );
  } catch (error) {
    if (
      isGeolocationPositionError(error) &&
      error.code === error.PERMISSION_DENIED
    ) {
      return { kind: "denied" };
    }

    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "Location could not be refreshed.",
    };
  }
}
