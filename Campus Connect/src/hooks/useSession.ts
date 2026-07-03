import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";
import { loadSession, saveSession, clearSession } from "@/lib/session";
import type { AnonSession, WriteAccessState } from "@/lib/types";

export function useSession() {
  const [session, setSession] = useState<AnonSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existing = loadSession();
    if (existing) {
      setSession(existing);
      setLoading(false);
    }
    api.session.bootstrap(existing).then((s) => {
      saveSession(s);
      setSession(s);
      setLoading(false);
    });
  }, []);

  const update = useCallback((patch: Partial<AnonSession>) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveSession(next);
      return next;
    });
  }, []);

  const setWriteAccess = useCallback((w: WriteAccessState) => {
    update({ writeAccess: w });
  }, [update]);

  const reset = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  return { session, loading, update, setWriteAccess, reset };
}
