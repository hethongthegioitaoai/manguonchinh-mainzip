import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldWeather } from "@workspace/db/schema";
import { eq, and, desc, lt } from "drizzle-orm";
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

/* ─── Weather templates ─── */
const WEATHER_TEMPLATES = [
  { type: "clear",       name: "Quang Đãng",      intensity: "light",    effects: { expMult: 1.0,  goldMult: 1.0,  harvestMult: 1.0,  battleMult: 1.0  }, durationH: 8  },
  { type: "rain",        name: "Mưa Linh",         intensity: "moderate", effects: { expMult: 1.2,  goldMult: 0.9,  harvestMult: 1.3,  battleMult: 0.95 }, durationH: 10 },
  { type: "storm",       name: "Bão Cuồng",        intensity: "severe",   effects: { expMult: 0.8,  goldMult: 0.7,  harvestMult: 0.5,  battleMult: 1.3  }, durationH: 6  },
  { type: "fog",         name: "Sương Huyền Bí",   intensity: "moderate", effects: { expMult: 0.85, goldMult: 1.1,  harvestMult: 1.4,  battleMult: 0.9  }, durationH: 12 },
  { type: "blizzard",    name: "Băng Phong Hàn",   intensity: "severe",   effects: { expMult: 0.7,  goldMult: 0.8,  harvestMult: 0.4,  battleMult: 0.85 }, durationH: 8  },
  { type: "heatwave",    name: "Nắng Liệt Hỏa",    intensity: "severe",   effects: { expMult: 0.9,  goldMult: 1.2,  harvestMult: 0.6,  battleMult: 1.1  }, durationH: 10 },
  { type: "thunderstorm",name: "Lôi Kiếp Thiên",   intensity: "severe",   effects: { expMult: 1.4,  goldMult: 0.8,  harvestMult: 0.7,  battleMult: 1.2  }, durationH: 6  },
  { type: "aurora",      name: "Linh Quang Thiên",  intensity: "moderate", effects: { expMult: 1.3,  goldMult: 1.2,  harvestMult: 1.1,  battleMult: 1.05 }, durationH: 8  },
  { type: "sandstorm",   name: "Sa Mạc Phong Cuồng",intensity: "severe",  effects: { expMult: 0.75, goldMult: 0.9,  harvestMult: 0.3,  battleMult: 1.15 }, durationH: 8  },
  { type: "blessing_sky",name: "Thiên Khí Phúc Lành",intensity: "light",  effects: { expMult: 1.5,  goldMult: 1.3,  harvestMult: 1.5,  battleMult: 1.0  }, durationH: 4  },
];

/* ─── Auto-expire weather ─── */
async function expireOldWeather() {
  await db.update(worldWeather)
    .set({ isActive: false })
    .where(and(eq(worldWeather.isActive, true), lt(worldWeather.endsAt, new Date())));
}

/* ─── Generate weather for a world ─── */
async function generateWeatherForWorld(worldSlug: string, worldName?: string): Promise<typeof worldWeather.$inferSelect> {
  const tmpl = WEATHER_TEMPLATES[Math.floor(Math.random() * WEATHER_TEMPLATES.length)];
  const endsAt = new Date(Date.now() + tmpl.durationH * 3600 * 1000);

  let narrative = "";
  let localizedName = tmpl.name;

  const prompt = `Bạn là narrator cho thế giới game "${worldName || worldSlug}" với loại thời tiết "${tmpl.type}" (${tmpl.name}).
Viết đúng 2 câu tiếng Việt mô tả thời tiết này theo lore thế giới đó. Đặt tên thời tiết phù hợp với lore thế giới nếu có thể.
Trả về JSON: {"name": "tên thời tiết theo lore", "narrative": "2 câu mô tả"}
Chỉ JSON, không markdown.`;

  const raw = await geminiText(prompt);
  try {
    const parsed = JSON.parse(raw.replace(/```json?|```/g, "").trim());
    if (parsed.name) localizedName = parsed.name;
    if (parsed.narrative) narrative = parsed.narrative;
  } catch {
    narrative = `${localizedName} bao phủ ${worldName || worldSlug}. Người tu hành cảm nhận sự thay đổi của thiên khí.`;
  }

  const desc = `${localizedName}: EXP ×${tmpl.effects.expMult} | Vàng ×${tmpl.effects.goldMult} | Thu hoạch ×${tmpl.effects.harvestMult} | Chiến đấu ×${tmpl.effects.battleMult}`;

  const [created] = await db.insert(worldWeather).values({
    worldSlug,
    weatherType: tmpl.type,
    weatherName: localizedName,
    intensity: tmpl.intensity,
    description: desc,
    aiNarrative: narrative,
    effects: tmpl.effects,
    isActive: true,
    endsAt,
  }).returning();

  return created;
}

/* ─────────────────────────────────────────────────────
   GET /api/weather/:worldSlug — thời tiết hiện tại + lịch sử
───────────────────────────────────────────────────── */
router.get("/api/weather/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    await expireOldWeather();
    const { worldSlug } = req.params;

    let current = await db.select().from(worldWeather)
      .where(and(eq(worldWeather.worldSlug, worldSlug), eq(worldWeather.isActive, true)))
      .orderBy(desc(worldWeather.startsAt))
      .limit(1)
      .then(r => r[0] ?? null);

    if (!current) {
      current = await generateWeatherForWorld(worldSlug);
    }

    const history = await db.select().from(worldWeather)
      .where(and(eq(worldWeather.worldSlug, worldSlug), eq(worldWeather.isActive, false)))
      .orderBy(desc(worldWeather.startsAt))
      .limit(10);

    res.json({ current, history });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────
   GET /api/weather/all/active — tất cả thế giới có thời tiết active
───────────────────────────────────────────────────── */
router.get("/api/weather/all/active", isAuthenticated, async (req, res) => {
  try {
    await expireOldWeather();
    const all = await db.select().from(worldWeather)
      .where(eq(worldWeather.isActive, true))
      .orderBy(desc(worldWeather.startsAt));
    res.json(all);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────
   POST /api/weather/generate/:worldSlug — tạo thời tiết mới (force hoặc auto)
───────────────────────────────────────────────────── */
router.post("/api/weather/generate/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const { worldName, force } = req.body as { worldName?: string; force?: boolean };

    await expireOldWeather();

    const existing = await db.select().from(worldWeather)
      .where(and(eq(worldWeather.worldSlug, worldSlug), eq(worldWeather.isActive, true)))
      .limit(1)
      .then(r => r[0] ?? null);

    if (existing && !force) {
      return res.json({ weather: existing, generated: false, message: "Thời tiết hiện tại vẫn còn hiệu lực" });
    }

    if (existing) {
      await db.update(worldWeather).set({ isActive: false }).where(eq(worldWeather.id, existing.id));
    }

    const weather = await generateWeatherForWorld(worldSlug, worldName);
    res.json({ weather, generated: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
