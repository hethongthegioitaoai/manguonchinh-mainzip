import { useEffect, useRef, useState } from "react";

export type HealthStatus = "ok" | "degraded" | "unknown";

export interface HealthData {
  status: HealthStatus;
  uptime?: number;
  db?: { status: "ok" | "error"; latencyMs?: number | null; error?: string };
  timestamp?: string;
}

const POLL_INTERVAL_MS = 30_000;
const TIMEOUT_MS = 5_000;

export function useHealthCheck() {
  const [health, setHealth] = useState<HealthData>({ status: "unknown" });
  const prevStatus = useRef<HealthStatus>("unknown");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function check() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const res = await fetch("/api/healthz", { signal: controller.signal });
        clearTimeout(timeout);
        const data: HealthData = await res.json();
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth({ status: "degraded" });
      } finally {
        if (!cancelled) timer = setTimeout(check, POLL_INTERVAL_MS);
      }
    }

    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const statusChanged =
    prevStatus.current !== "unknown" && prevStatus.current !== health.status;
  prevStatus.current = health.status;

  return { health, statusChanged };
}
