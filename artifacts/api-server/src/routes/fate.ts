import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { fateEvents, fateReadings, characters } from "@workspace/db/schema";
import { eq, and, desc, gt, lt } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const genAI = new GoogleGenAI({ apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY, httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL } });

const HEXAGRAMS = [
  { symbol: "☰", name: "Càn — Thiên", element: "Kim" },
  { symbol: "☱", name: "Đoài — Trạch", element: "Kim" },
  { symbol: "☲", name: "Ly — Hỏa",   element: "Hỏa" },
  { symbol: "☳", name: "Chấn — Lôi",  element: "Mộc" },
  { symbol: "☴", name: "Tốn — Phong", element: "Mộc" },
  { symbol: "☵", name: "Khảm — Thủy", element: "Thủy" },
  { symbol: "☶", name: "Cấn — Sơn",   element: "Thổ" },
  { symbol: "☷", name: "Khôn — Địa",  element: "Thổ" },
];

// Tính Mệnh Số từ tên nhân vật + level + ngày tạo
function calcFateNumber(name: string, level: number, createdAt: Date): number {
  let sum = 0;
  for (const c of name) sum += c.charCodeAt(0);
  sum += level;
  sum += createdAt.getDate() + createdAt.getMonth() + 1;
  while (sum > 9) sum = String(sum).split("").reduce((a, b) => a + parseInt(b), 0);
  return sum === 0 ? 9 : sum;
}

// Weights cho mỗi Mệnh Số
const FATE_WEIGHTS: Record<number, { cat: number; hung: number; trung: number }> = {
  1: { cat: 0.5, hung: 0.2, trung: 0.3 },
  2: { cat: 0.3, hung: 0.4, trung: 0.3 },
  3: { cat: 0.6, hung: 0.1, trung: 0.3 },
  4: { cat: 0.35, hung: 0.35, trung: 0.3 },
  5: { cat: 0.4, hung: 0.3, trung: 0.3 },
  6: { cat: 0.55, hung: 0.15, trung: 0.3 },
  7: { cat: 0.25, hung: 0.45, trung: 0.3 },
  8: { cat: 0.5, hung: 0.2, trung: 0.3 },
  9: { cat: 0.45, hung: 0.25, trung: 0.3 },
};

function rollEventType(fateNum: number): "cat" | "hung" | "trung_binh" {
  const w = FATE_WEIGHTS[fateNum] ?? { cat: 0.33, hung: 0.33, trung: 0.34 };
  const r = Math.random();
  if (r < w.cat) return "cat";
  if (r < w.cat + w.hung) return "hung";
  return "trung_binh";
}

const EVENT_EFFECTS = {
  cat: [
    { title: "Thiên Mệnh Chiếu Sáng", effect: { expBonus: 200, critBoostPct: 15 }, durationHours: 6 },
    { title: "Phúc Lộc Song Toàn",     effect: { expBonus: 150, goldBonus: 120 }, durationHours: 8 },
    { title: "Kiếm Tâm Thông Minh",    effect: { critBoostPct: 25, dropBoostPct: 10 }, durationHours: 4 },
    { title: "Tinh Tú Kết Giới",       effect: { expBonus: 300, expMultiplier: 1.5 }, durationHours: 3 },
    { title: "Long Khí Phú Bần",       effect: { goldBonus: 250, dropBoostPct: 20 }, durationHours: 5 },
  ],
  hung: [
    { title: "Mệnh Cung Phá Toái",   effect: { expPenalty: 100, critReducePct: 10 }, durationHours: 4 },
    { title: "Vận Khí Suy Tàn",      effect: { goldPenalty: 80, expPenalty: 50 }, durationHours: 6 },
    { title: "Ma Kiếp Xâm Thân",     effect: { dropReducePct: 15, critReducePct: 15 }, durationHours: 3 },
    { title: "Thiên La Địa Võng",    effect: { expMultiplier: 0.7, expPenalty: 50 }, durationHours: 5 },
    { title: "Nghiệp Chướng Hiện Ra", effect: { goldPenalty: 150, dropReducePct: 20 }, durationHours: 4 },
  ],
  trung_binh: [
    { title: "Mệnh Bình Thủy Lưu",  effect: { expBonus: 50 }, durationHours: 6 },
    { title: "Âm Dương Cân Bằng",   effect: { critBoostPct: 5, critReducePct: 0 }, durationHours: 8 },
    { title: "Nhân Quả Tương Sinh",  effect: { dropBoostPct: 5, goldBonus: 30 }, durationHours: 6 },
  ],
};

// GET /api/fate/char/:characterId — Mệnh Số + active events + last reading
router.get("/fate/char/:characterId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, String(req.params.characterId)), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    const fateNumber = calcFateNumber(char.name, char.level, new Date(char.createdAt ?? Date.now()));
    const hexagram = HEXAGRAMS[(fateNumber - 1) % 8];

    // Active events
    const now = new Date();
    const activeEvents = await db.select().from(fateEvents)
      .where(and(
        eq(fateEvents.characterId, char.id),
        eq(fateEvents.active, true),
        gt(fateEvents.expiresAt, now),
      ))
      .orderBy(desc(fateEvents.createdAt)).limit(5);

    // Last reading
    const [lastReading] = await db.select().from(fateReadings)
      .where(eq(fateReadings.characterId, char.id))
      .orderBy(desc(fateReadings.createdAt)).limit(1);

    // Recent history
    const history = await db.select().from(fateEvents)
      .where(eq(fateEvents.characterId, char.id))
      .orderBy(desc(fateEvents.createdAt)).limit(12);

    res.json({ fateNumber, hexagram, activeEvents, lastReading: lastReading ?? null, history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tải Mệnh Số" });
  }
});

// GET /api/fate/my-chars — danh sách nhân vật của user
router.get("/fate/my-chars", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const chars = await db.select().from(characters).where(eq(characters.userId, userId));
    res.json(chars);
  } catch (err) {
    res.status(500).json({ error: "Lỗi tải nhân vật" });
  }
});

// POST /api/fate/trigger/:characterId — kích hoạt Mệnh Cục ngẫu nhiên (cooldown 1h)
router.post("/fate/trigger/:characterId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, String(req.params.characterId)), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    // Cooldown: không trigger nếu đã có event trong 1h qua
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await db.select().from(fateEvents)
      .where(and(eq(fateEvents.characterId, char.id), gt(fateEvents.createdAt, oneHourAgo)))
      .limit(1);
    if (recent) return res.status(429).json({ error: "Mệnh Cục đang hồi phục — cần ít nhất 1 giờ giữa các lần kích hoạt." });

    const fateNumber = calcFateNumber(char.name, char.level, new Date(char.createdAt ?? Date.now()));
    const eventType = rollEventType(fateNumber);
    const pool = EVENT_EFFECTS[eventType];
    const template = pool[Math.floor(Math.random() * pool.length)];
    const hexagram = HEXAGRAMS[(fateNumber - 1) % 8];

    // AI sinh description cho event
    const model = { generateContent: async (p: any) => { const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: typeof p === "string" ? p : p }); return { response: { text: () => r.text ?? "" } }; } };
    const charStats = char.stats as any;
    const worldSlug = charStats?.worldSlug ?? "cultivation";
    const descPrompt = `Nhân vật ${char.name} (Lv.${char.level}, mệnh ${hexagram.symbol} ${hexagram.name}) vừa kích hoạt Mệnh Cục:
Tên sự kiện: "${template.title}" (loại: ${eventType === "cat" ? "Cát — may mắn" : eventType === "hung" ? "Hung — xui xẻo" : "Trung bình"})
Effect: ${JSON.stringify(template.effect)}

Viết 2-3 câu mô tả sự kiện này xảy ra như thế nào với nhân vật — ngắn gọn, thần bí, phù hợp với aesthetic cyber cultivation tối tăm. Chỉ trả về text thuần, không markdown.`;

    let description = `Mệnh Cục ${template.title} kích hoạt — vận mệnh của ${char.name} đang chuyển dịch.`;
    try {
      const r = await model.generateContent(descPrompt);
      description = r.response.text().trim().slice(0, 400);
    } catch (_) {}

    const expiresAt = new Date(Date.now() + template.durationHours * 60 * 60 * 1000);
    const [event] = await db.insert(fateEvents).values({
      characterId: char.id,
      fateNumber,
      eventType,
      title: template.title,
      description,
      effect: template.effect,
      duration: template.durationHours,
      expiresAt,
    }).returning();

    // Apply immediate effects (EXP/gold bonus/penalty)
    const eff = template.effect as any;
    const statsNow = char.stats as any;
    let statsUpdate: any = {};
    let expDelta = 0;

    if (eff.expBonus) expDelta += eff.expBonus;
    if (eff.expPenalty) expDelta -= eff.expPenalty;
    if (eff.goldBonus) statsUpdate.gold = (statsNow?.gold ?? 0) + eff.goldBonus;
    if (eff.goldPenalty) statsUpdate.gold = Math.max(0, (statsNow?.gold ?? 0) - eff.goldPenalty);

    if (expDelta !== 0 || Object.keys(statsUpdate).length) {
      await db.update(characters).set({
        exp: Math.max(0, char.exp + expDelta),
        stats: { ...statsNow, ...statsUpdate },
      }).where(eq(characters.id, char.id));
    }

    res.json({
      event,
      fateNumber,
      hexagram,
      immediateEffect: { expDelta, ...statsUpdate },
      message: eventType === "cat"
        ? `✨ ${template.title} — Vận khí tốt lành giáng xuống!`
        : eventType === "hung"
        ? `⚡ ${template.title} — Ma kiếp xâm thân, cẩn thận!`
        : `☯ ${template.title} — Mệnh bình an lưu chuyển.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi kích hoạt Mệnh Cục" });
  }
});

// POST /api/fate/consult/:characterId — AI giải quẻ (xin lời khuyên vận mệnh)
router.post("/fate/consult/:characterId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, String(req.params.characterId)), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    // Cooldown: 1 lần / 2 giờ
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const [recentReading] = await db.select().from(fateReadings)
      .where(and(eq(fateReadings.characterId, char.id), gt(fateReadings.createdAt, twoHoursAgo)))
      .limit(1);
    if (recentReading) return res.status(429).json({ error: "Thiên Cơ không thể hỏi quá thường — chờ 2 giờ giữa các lần giải quẻ." });

    const fateNumber = calcFateNumber(char.name, char.level, new Date(char.createdAt ?? Date.now()));
    const hexIdx = (fateNumber - 1 + Math.floor(Math.random() * 3)) % 8;
    const hexagram = HEXAGRAMS[hexIdx];
    const charStats = char.stats as any;

    const model = { generateContent: async (p: any) => { const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: typeof p === "string" ? p : p }); return { response: { text: () => r.text ?? "" } }; } };
    const prompt = `Bạn là Thiên Cơ Tiên — nhà tiên tri huyền bí trong thế giới cyber cultivation.
Nhân vật: ${char.name} (Lv.${char.level}, Mệnh Số ${fateNumber})
Quẻ bốc được: ${hexagram.symbol} ${hexagram.name} (Ngũ hành: ${hexagram.element})

Hãy giải quẻ cho nhân vật này. Trả về JSON (không markdown):
{
  "reading": "<lời giải quẻ — 3-4 câu thơ/văn xuôi thần bí, liên quan tình huống hiện tại của nhân vật, phong cách cổ điển pha cyber>",
  "advice": "<lời khuyên thực tế — 1-2 câu ngắn gọn, rõ ràng: nên làm gì tiếp theo trong game>",
  "luckyElement": "<yếu tố may mắn — VD: 'Kiếm Kim Ngân', 'Đêm Trăng Khuyết', 'Số 7', 'Màu Tím'>"
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/```json\n?|\n?```/g, "");
    let aiData: any;
    try { aiData = JSON.parse(raw); } catch {
      aiData = {
        reading: "Quẻ mờ tối, thiên cơ bất khả lộ. Hành trình phía trước nhiều thử thách nhưng vinh quang chờ đợi.",
        advice: "Tiếp tục chiến đấu, tích lũy sức mạnh từng ngày.",
        luckyElement: "Ánh Sao Bắc Đẩu",
      };
    }

    const [reading] = await db.insert(fateReadings).values({
      characterId: char.id,
      fateNumber,
      hexagram: hexagram.symbol,
      hexagramName: hexagram.name,
      reading: aiData.reading ?? "",
      advice: aiData.advice ?? "",
      luckyElement: (aiData.luckyElement ?? "").slice(0, 32),
    }).returning();

    res.json({ reading, hexagram, fateNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi giải quẻ" });
  }
});

export default router;
