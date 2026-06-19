import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();
const startedAt = Date.now();

router.get("/healthz", async (_req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

  let dbStatus: "ok" | "error" = "ok";
  let dbLatencyMs: number | null = null;
  let dbError: string | null = null;

  try {
    const t0 = Date.now();
    await pool.query("SELECT 1");
    dbLatencyMs = Date.now() - t0;
  } catch (err: any) {
    dbStatus = "error";
    dbError = err?.message ?? "unknown";
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";

  res.status(dbStatus === "ok" ? 200 : 503).json({
    status,
    uptime: uptimeSeconds,
    db: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      ...(dbError ? { error: dbError } : {}),
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
