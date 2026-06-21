import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  tradeRoutes, tradeRouteHistory,
  territories, territoryResources,
  worldHistory,
} from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

/* ─── Internal: tick trade routes for a world (called from worldSimulation) ─── */
export async function tickTradeRoutes(worldSlug: string, tick: number): Promise<void> {
  const routes = await db.select().from(tradeRoutes)
    .where(and(eq(tradeRoutes.worldSlug, worldSlug), eq(tradeRoutes.active, true)));

  if (routes.length === 0) return;

  const terrs = await db.select({
    id: territories.id,
    security: territories.security,
    prosperity: territories.prosperity,
  }).from(territories).where(eq(territories.worldSlug, worldSlug));

  const terrMap = new Map(terrs.map(t => [t.id, t]));

  for (const route of routes) {
    const src  = terrMap.get(route.sourceTerritoryId);
    const dest = terrMap.get(route.destinationTerritoryId);
    if (!src || !dest) continue;

    const srcSecurity  = src.security  ?? 50;
    const destSecurity = dest.security ?? 50;
    const isDisrupted  = srcSecurity < 20 || destSecurity < 20;

    if (isDisrupted && !route.disrupted) {
      await db.update(tradeRoutes)
        .set({ disrupted: true, updatedAt: new Date() })
        .where(eq(tradeRoutes.id, route.id));
      await db.insert(tradeRouteHistory).values({
        tradeRouteId: route.id,
        worldSlug,
        eventType: "route_disrupted",
        description: `Tuyến thương mại bị gián đoạn — an ninh nguồn: ${srcSecurity}, đích: ${destSecurity}`,
        tick,
      });
      continue;
    }

    if (!isDisrupted && route.disrupted) {
      await db.update(tradeRoutes)
        .set({ disrupted: false, updatedAt: new Date() })
        .where(eq(tradeRoutes.id, route.id));
      await db.insert(tradeRouteHistory).values({
        tradeRouteId: route.id,
        worldSlug,
        eventType: "route_restored",
        description: `Tuyến thương mại khôi phục — an ninh nguồn: ${srcSecurity}, đích: ${destSecurity}`,
        tick,
      });
    }

    if (isDisrupted) continue;

    const transferAmount = route.amount;

    /* Decrease source supply */
    const [srcRes] = await db.select().from(territoryResources)
      .where(and(eq(territoryResources.territoryId, route.sourceTerritoryId), eq(territoryResources.resourceType, route.item)));
    if (srcRes) {
      const newAmt = Math.max(0, srcRes.amount - transferAmount);
      await db.update(territoryResources)
        .set({ amount: newAmt, updatedAt: new Date() })
        .where(eq(territoryResources.id, srcRes.id));
    }

    /* Increase destination supply */
    const [destRes] = await db.select().from(territoryResources)
      .where(and(eq(territoryResources.territoryId, route.destinationTerritoryId), eq(territoryResources.resourceType, route.item)));
    if (destRes) {
      const newAmt = Math.min(9999, destRes.amount + transferAmount);
      await db.update(territoryResources)
        .set({ amount: newAmt, updatedAt: new Date() })
        .where(eq(territoryResources.id, destRes.id));
    } else {
      await db.insert(territoryResources).values({
        territoryId: route.destinationTerritoryId,
        resourceType: route.item,
        amount: transferAmount,
      });
    }

    /* Update stats */
    await db.update(tradeRoutes)
      .set({
        totalTicksActive: route.totalTicksActive + 1,
        totalTransferred: route.totalTransferred + transferAmount,
        updatedAt: new Date(),
      })
      .where(eq(tradeRoutes.id, route.id));
  }
}

/* ════════════════════════════════════════
   GET /api/trade-routes/:worldSlug
   All routes for a world with source/dest info
════════════════════════════════════════ */
router.get("/trade-routes/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const routes = await db.select().from(tradeRoutes)
      .where(eq(tradeRoutes.worldSlug, worldSlug))
      .orderBy(desc(tradeRoutes.createdAt));

    const terrs = await db.select({ id: territories.id, name: territories.name, x: territories.x, y: territories.y, type: territories.type, prosperity: territories.prosperity, security: territories.security })
      .from(territories).where(eq(territories.worldSlug, worldSlug));
    const terrMap = new Map(terrs.map(t => [t.id, t]));

    const enriched = routes.map(r => ({
      ...r,
      source: terrMap.get(r.sourceTerritoryId) ?? null,
      destination: terrMap.get(r.destinationTerritoryId) ?? null,
    }));

    return res.json({ routes: enriched, territories: terrs });
  } catch (err: any) {
    console.error("[trade-routes] GET error:", err);
    return res.status(500).json({ error: "Lỗi tải tuyến thương mại" });
  }
});

/* ════════════════════════════════════════
   POST /api/trade-routes/:worldSlug
   Create a new trade route (requires prosperity > 60)
════════════════════════════════════════ */
router.post("/trade-routes/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const { sourceTerritoryId, destinationTerritoryId, item, amount } = req.body as {
      sourceTerritoryId: string;
      destinationTerritoryId: string;
      item: string;
      amount: number;
    };

    if (!sourceTerritoryId || !destinationTerritoryId || !item) {
      return res.status(400).json({ error: "Thiếu thông tin tuyến thương mại" });
    }
    if (sourceTerritoryId === destinationTerritoryId) {
      return res.status(400).json({ error: "Nguồn và đích không thể là cùng một lãnh thổ" });
    }

    const [srcTerr] = await db.select().from(territories)
      .where(and(eq(territories.id, sourceTerritoryId), eq(territories.worldSlug, worldSlug)));

    if (!srcTerr) return res.status(404).json({ error: "Lãnh thổ nguồn không tồn tại" });

    if (srcTerr.prosperity < 60) {
      return res.status(400).json({
        error: `Lãnh thổ nguồn cần thịnh vượng > 60 để mở tuyến thương mại (hiện tại: ${srcTerr.prosperity})`,
      });
    }

    const [destTerr] = await db.select().from(territories)
      .where(and(eq(territories.id, destinationTerritoryId), eq(territories.worldSlug, worldSlug)));
    if (!destTerr) return res.status(404).json({ error: "Lãnh thổ đích không tồn tại" });

    const transferAmount = clamp(Number(amount) || 10, 1, 200);
    const [route] = await db.insert(tradeRoutes).values({
      worldSlug,
      sourceTerritoryId,
      destinationTerritoryId,
      item,
      amount: transferAmount,
      active: true,
      disrupted: srcTerr.security < 20 || destTerr.security < 20,
    }).returning();

    await db.insert(tradeRouteHistory).values({
      tradeRouteId: route.id,
      worldSlug,
      eventType: "trade_route_created",
      description: `Tuyến thương mại "${item}" (${transferAmount}/tick) từ ${srcTerr.name} đến ${destTerr.name} được thiết lập.`,
      tick: 0,
    });

    await db.insert(worldHistory).values({
      worldSlug,
      tick: 0,
      eventType: "trade_route_created",
      title: `Tuyến Thương Mại Mới: ${srcTerr.name} → ${destTerr.name}`,
      description: `Thương nhân thiết lập tuyến vận chuyển "${item}" (${transferAmount}/tick) từ ${srcTerr.name} đến ${destTerr.name}.`,
      actors: { territories: [sourceTerritoryId, destinationTerritoryId] },
    });

    return res.json({ route, message: "Tuyến thương mại đã được tạo thành công" });
  } catch (err: any) {
    console.error("[trade-routes] POST error:", err);
    return res.status(500).json({ error: "Lỗi tạo tuyến thương mại" });
  }
});

/* ════════════════════════════════════════
   DELETE /api/trade-routes/:id
   Destroy a trade route
════════════════════════════════════════ */
router.delete("/trade-routes/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const [route] = await db.select().from(tradeRoutes).where(eq(tradeRoutes.id, id));
    if (!route) return res.status(404).json({ error: "Tuyến thương mại không tồn tại" });

    const [src]  = await db.select({ name: territories.name }).from(territories).where(eq(territories.id, route.sourceTerritoryId));
    const [dest] = await db.select({ name: territories.name }).from(territories).where(eq(territories.id, route.destinationTerritoryId));

    await db.insert(tradeRouteHistory).values({
      tradeRouteId: route.id,
      worldSlug: route.worldSlug,
      eventType: "trade_route_destroyed",
      description: `Tuyến thương mại "${route.item}" từ ${src?.name ?? "?"} đến ${dest?.name ?? "?"} bị giải tán sau ${route.totalTicksActive} tick, tổng vận chuyển: ${route.totalTransferred}.`,
      tick: 0,
    });

    await db.insert(worldHistory).values({
      worldSlug: route.worldSlug,
      tick: 0,
      eventType: "trade_route_destroyed",
      title: `Tuyến Thương Mại Giải Tán: ${src?.name ?? "?"} → ${dest?.name ?? "?"}`,
      description: `Tuyến "${route.item}" bị giải tán sau ${route.totalTicksActive} tick, tổng vận chuyển ${route.totalTransferred} đơn vị.`,
      actors: { territories: [route.sourceTerritoryId, route.destinationTerritoryId] },
    });

    await db.delete(tradeRoutes).where(eq(tradeRoutes.id, id));
    return res.json({ message: "Tuyến thương mại đã bị giải tán" });
  } catch (err: any) {
    console.error("[trade-routes] DELETE error:", err);
    return res.status(500).json({ error: "Lỗi xóa tuyến thương mại" });
  }
});

/* ════════════════════════════════════════
   GET /api/trade-routes/:worldSlug/history
   Trade route event history
════════════════════════════════════════ */
router.get("/trade-routes/:worldSlug/history", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const history = await db.select().from(tradeRouteHistory)
      .where(eq(tradeRouteHistory.worldSlug, worldSlug))
      .orderBy(desc(tradeRouteHistory.createdAt))
      .limit(limit);
    return res.json({ history });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════
   POST /api/trade-routes/:worldSlug/tick
   Manual tick (for stress test)
════════════════════════════════════════ */
router.post("/trade-routes/:worldSlug/tick", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const tick = Number(req.body?.tick) || 0;
    await tickTradeRoutes(worldSlug, tick);
    return res.json({ ok: true, tick });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════
   POST /api/trade-routes/:worldSlug/stress-test
   Run 1000 ticks and return report
════════════════════════════════════════ */
router.post("/trade-routes/:worldSlug/stress-test", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const ticks = Math.min(Number(req.body?.ticks) || 1000, 1000);

    const before = await db.select().from(tradeRoutes).where(eq(tradeRoutes.worldSlug, worldSlug));
    const t0 = Date.now();
    let disruptions = 0;
    let restorations = 0;

    for (let i = 1; i <= ticks; i++) {
      /* Simulate random security fluctuations for stress testing */
      const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
      for (const t of terrs) {
        const delta = Math.floor(Math.random() * 11) - 5;
        await db.update(territories)
          .set({ security: clamp(t.security + delta, 0, 100), updatedAt: new Date() })
          .where(eq(territories.id, t.id));
      }

      const countBefore = (await db.select({ d: tradeRoutes.disrupted }).from(tradeRoutes)
        .where(and(eq(tradeRoutes.worldSlug, worldSlug), eq(tradeRoutes.active, true)))).filter(r => r.d).length;

      await tickTradeRoutes(worldSlug, i);

      const countAfter = (await db.select({ d: tradeRoutes.disrupted }).from(tradeRoutes)
        .where(and(eq(tradeRoutes.worldSlug, worldSlug), eq(tradeRoutes.active, true)))).filter(r => r.d).length;

      if (countAfter > countBefore) disruptions++;
      if (countAfter < countBefore) restorations++;
    }

    const elapsed = Date.now() - t0;
    const after = await db.select().from(tradeRoutes).where(eq(tradeRoutes.worldSlug, worldSlug));
    const histCount = await db.select({ count: sql<number>`count(*)` }).from(tradeRouteHistory).where(eq(tradeRouteHistory.worldSlug, worldSlug));

    return res.json({
      ticks,
      elapsedMs: elapsed,
      routesBefore: before.length,
      routesAfter: after.length,
      disruptionEvents: disruptions,
      restorationEvents: restorations,
      historyEvents: Number(histCount[0]?.count ?? 0),
      avgMsPerTick: Math.round(elapsed / ticks),
      routes: after,
    });
  } catch (err: any) {
    console.error("[trade-routes] stress-test error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
