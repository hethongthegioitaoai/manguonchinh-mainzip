import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldSimState, worldSimLog, customWorlds, worldFrameworks, worldDisasters, worldWeather } from "@workspace/db/schema";
import { eq, and, desc, lt, sql } from "drizzle-orm";
import { applyGovernmentPolicies } from "./npcGovernmentPolicy.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function geminiText(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch { return ""; }
}

/* ─── Event types ─── */
const EVENT_POOL = [
  { type: "economic_boom",       name: "Thịnh Vượng Kinh Tế",    dEconomy: +12, dMood: +8,  dStability: +5,  dPop: +30  },
  { type: "economic_recession",  name: "Suy Thoái Kinh Tế",       dEconomy: -10, dMood: -10, dStability: -8,  dPop: -20  },
  { type: "political_crisis",    name: "Khủng Hoảng Chính Trị",   dEconomy: -8,  dMood: -12, dStability: -15, dPop: 0    },
  { type: "rebellion",           name: "Nổi Loạn Dân Chúng",      dEconomy: -15, dMood: -5,  dStability: -20, dPop: -50  },
  { type: "natural_wonder",      name: "Kỳ Quan Thiên Nhiên",     dEconomy: +5,  dMood: +15, dStability: +3,  dPop: +10  },
  { type: "plague",              name: "Dịch Bệnh Hoành Hành",    dEconomy: -12, dMood: -18, dStability: -10, dPop: -80  },
  { type: "harvest_festival",    name: "Lễ Hội Thu Hoạch",        dEconomy: +8,  dMood: +20, dStability: +5,  dPop: +15  },
  { type: "mysterious_arrival",  name: "Khách Lạ Ghé Đến",        dEconomy: +3,  dMood: +5,  dStability: 0,   dPop: +5   },
  { type: "ancient_discovery",   name: "Khám Phá Cổ Đại",         dEconomy: +10, dMood: +12, dStability: +2,  dPop: 0    },
  { type: "trade_boom",          name: "Buôn Bán Phồn Thịnh",     dEconomy: +15, dMood: +10, dStability: +5,  dPop: +20  },
  { type: "inter_world_war",     name: "Xung Đột Liên Thế Giới",  dEconomy: -18, dMood: -15, dStability: -25, dPop: -100 },
  { type: "hero_born",           name: "Anh Hùng Xuất Hiện",      dEconomy: +2,  dMood: +18, dStability: +8,  dPop: 0    },
  { type: "villain_rises",       name: "Ma Đầu Trỗi Dậy",         dEconomy: -5,  dMood: -14, dStability: -12, dPop: -30  },
  { type: "peace_treaty",        name: "Hòa Ước Ký Kết",          dEconomy: +5,  dMood: +15, dStability: +18, dPop: 0    },
  { type: "migration_wave",      name: "Làn Sóng Di Dân",         dEconomy: +3,  dMood: -3,  dStability: -5,  dPop: +150 },
];

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function rand(min: number, max: number) { return Math.random() * (max - min) + min; }

/* ─── Core tick logic ─── */
export async function tickWorld(worldSlug: string): Promise<{ log: typeof worldSimLog.$inferSelect | null; state: typeof worldSimState.$inferSelect | null }> {
  try {
    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    if (!world) return { log: null, state: null };

    const [framework] = await db.select().from(worldFrameworks).where(eq(worldFrameworks.worldSlug, worldSlug));

    let [state] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, worldSlug));
    if (!state) {
      const [created] = await db.insert(worldSimState).values({
        worldSlug,
        worldName: world.name,
        theme: framework?.theme ?? "",
        population: 1000,
        economyScore: 50,
        avgMood: 60,
        stability: 70,
      }).returning();
      state = created;
    }

    const activeDisasters = await db.select().from(worldDisasters)
      .where(and(eq(worldDisasters.worldSlug, worldSlug), eq(worldDisasters.status, "active")));
    const [activeWeather] = await db.select().from(worldWeather)
      .where(and(eq(worldWeather.worldSlug, worldSlug), eq(worldWeather.isActive, true)));

    /* ─── Compute base deltas ─── */
    let dPop       = Math.round(rand(-5, 15));
    let dEconomy   = rand(-2, 3);
    let dMood      = rand(-3, 3);
    let dStability = rand(-2, 2);
    let eventName  = "Tick Bình Thường";
    let eventType  = "tick";
    let narrative  = "";

    /* Disaster modifier */
    for (const d of activeDisasters) {
      const eff = d.effect as any ?? {};
      if ((eff.expMult ?? 1) < 0.7) { dEconomy -= 8; dMood -= 10; dStability -= 8; dPop -= 30; }
      else if ((eff.expMult ?? 1) < 1.0) { dEconomy -= 3; dMood -= 5; dStability -= 3; }
      else { dEconomy += 5; dMood += 8; dPop += 10; }
    }

    /* Weather modifier */
    if (activeWeather?.effects) {
      const eff = activeWeather.effects as any;
      dEconomy += (eff.goldMult - 1) * 5;
      dMood    += (eff.expMult  - 1) * 6;
    }

    /* Mean reversion — pull toward baseline (50/60/70) */
    dEconomy   += (50 - state.economyScore) * 0.03;
    dMood      += (60 - state.avgMood)      * 0.03;
    dStability += (70 - state.stability)    * 0.03;

    /* ─── Random event roll (28% chance) ─── */
    let rolledEvent = null;
    if (Math.random() < 0.28) {
      rolledEvent = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
      dPop       += rolledEvent.dPop;
      dEconomy   += rolledEvent.dEconomy;
      dMood      += rolledEvent.dMood;
      dStability += rolledEvent.dStability;
      eventName   = rolledEvent.name;
      eventType   = rolledEvent.type;

      const worldTheme = framework?.theme ?? world.name;
      narrative = await geminiText(
        `Thế giới "${world.name}" (chủ đề: ${worldTheme}) vừa trải qua sự kiện "${rolledEvent.name}".
Viết 2-3 câu tiếng Việt mô tả sự kiện này theo lore thế giới đó. Ngắn gọn, sử thi, không giải thích.`
      );
    } else {
      const worldTheme = framework?.theme ?? world.name;
      narrative = await geminiText(
        `Thế giới "${world.name}" (chủ đề: ${worldTheme}) trải qua một giờ bình thường.
Viết 1 câu tiếng Việt mô tả nhịp sống thường ngày của thế giới này. Ngắn, có hồn.`
      );
    }

    /* ─── Apply updates ─── */
    const newPop       = Math.max(0,   state.population + dPop);
    const newEconomy   = clamp(state.economyScore + dEconomy, 0, 100);
    const newMood      = clamp(state.avgMood + dMood, 0, 100);
    const newStability = clamp(state.stability + dStability, 0, 100);
    const newTick      = state.totalTicks + 1;

    const [updatedState] = await db.update(worldSimState)
      .set({ population: newPop, economyScore: newEconomy, avgMood: newMood, stability: newStability, totalTicks: newTick, lastTickAt: new Date(), worldName: world.name, theme: framework?.theme ?? "" })
      .where(eq(worldSimState.worldSlug, worldSlug))
      .returning();

    const summary = `[Tick #${newTick}] ${eventName} | Pop: ${newPop} (${dPop >= 0 ? "+" : ""}${dPop}) | Economy: ${newEconomy.toFixed(1)} | Mood: ${newMood.toFixed(1)} | Stability: ${newStability.toFixed(1)}`;

    const [log] = await db.insert(worldSimLog).values({
      worldSlug,
      tickNumber: newTick,
      eventType,
      eventName,
      summary,
      aiNarrative: narrative,
      deltaPopulation: dPop,
      deltaEconomy: dEconomy,
      deltaMood: dMood,
      deltaStability: dStability,
    }).returning();

    /* ─── Apply government policy effects ─── */
    try { await applyGovernmentPolicies(worldSlug); } catch {}

    return { log, state: updatedState };
  } catch (e) {
    console.error(`[Simulation] tick error for ${worldSlug}:`, e);
    return { log: null, state: null };
  }
}

/* ─── Tick ALL active worlds ─── */
export async function tickAllWorlds(): Promise<void> {
  try {
    const worlds = await db.select().from(worldSimState).where(eq(worldSimState.isActive, true));
    if (worlds.length === 0) {
      const allWorlds = await db.select().from(customWorlds).limit(20);
      for (const w of allWorlds) await tickWorld(w.slug);
    } else {
      for (const s of worlds) await tickWorld(s.worldSlug);
    }
    console.log(`[Simulation] ✅ Ticked ${worlds.length} worlds`);
  } catch (e) {
    console.error("[Simulation] tickAll error:", e);
  }
}

/* ═══════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════ */

/* GET /api/simulation/state/:worldSlug */
router.get("/api/simulation/state/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    let [state] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug, worldSlug));
    if (!state) {
      const { state: s } = await tickWorld(worldSlug);
      state = s!;
    }
    res.json(state);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/simulation/logs/:worldSlug */
router.get("/api/simulation/logs/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const logs = await db.select().from(worldSimLog)
      .where(eq(worldSimLog.worldSlug, worldSlug))
      .orderBy(desc(worldSimLog.happenedAt))
      .limit(limit);
    res.json(logs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/simulation/feed — global event feed */
router.get("/api/simulation/feed", isAuthenticated, async (req, res) => {
  try {
    const logs = await db.select().from(worldSimLog)
      .orderBy(desc(worldSimLog.happenedAt))
      .limit(60);
    res.json(logs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/simulation/all — all world states */
router.get("/api/simulation/all", isAuthenticated, async (req, res) => {
  try {
    const states = await db.select().from(worldSimState)
      .where(eq(worldSimState.isActive, true))
      .orderBy(desc(worldSimState.lastTickAt));
    res.json(states);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/simulation/tick/:worldSlug — manual tick */
router.post("/api/simulation/tick/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const result = await tickWorld(worldSlug);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/simulation/tick/all — tick all (admin / heartbeat) */
router.post("/api/simulation/tick/all", isAuthenticated, async (_req, res) => {
  try {
    await tickAllWorlds();
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
