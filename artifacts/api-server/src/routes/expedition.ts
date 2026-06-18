import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { expeditions, expeditionEvents, characters, customWorlds } from "@workspace/db/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const STEP_COOLDOWN_MS = 5 * 60 * 1000;

const EVENT_TEMPLATES = [
  { type: "combat", weight: 3 },
  { type: "treasure", weight: 2 },
  { type: "trap", weight: 1 },
  { type: "npc", weight: 1 },
  { type: "rest", weight: 1 },
];

function pickEventType(): string {
  const pool: string[] = [];
  for (const t of EVENT_TEMPLATES) for (let i = 0; i < t.weight; i++) pool.push(t.type);
  return pool[Math.floor(Math.random() * pool.length)];
}

async function generateMapData(worldName: string, difficulty: string, totalSteps: number): Promise<any[]> {
  const steps: any[] = [];
  for (let i = 0; i < totalSteps; i++) {
    const type = i === 0 ? "rest" : i === totalSteps - 1 ? "treasure" : pickEventType();
    steps.push({ step: i + 1, type, revealed: i === 0 });
  }
  return steps;
}

async function generateEventNarrative(worldName: string, eventType: string, step: number, memberNames: string[]): Promise<{
  title: string; description: string; goldChange: number; expChange: number; hpChange: number; success: boolean;
}> {
  const isBad = eventType === "trap" || (eventType === "combat" && Math.random() < 0.35);
  const base = {
    combat:   { goldMin: 20, goldMax: 100, expMin: 40, expMax: 120, hpLoss: isBad ? -20 : -5 },
    treasure: { goldMin: 80, goldMax: 300, expMin: 20, expMax: 60, hpLoss: 0 },
    trap:     { goldMin: -50, goldMax: -10, expMin: 10, expMax: 30, hpLoss: -30 },
    npc:      { goldMin: 30, goldMax: 120, expMin: 30, expMax: 80, hpLoss: 0 },
    rest:     { goldMin: 0, goldMax: 0, expMin: 10, expMax: 30, hpLoss: 20 },
  }[eventType] ?? { goldMin: 10, goldMax: 50, expMin: 10, expMax: 40, hpLoss: 0 };

  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const goldChange = rand(base.goldMin, base.goldMax);
  const expChange = rand(base.expMin, base.expMax);
  const hpChange = base.hpLoss < 0 ? base.hpLoss : base.hpLoss;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const memberStr = memberNames.slice(0, 3).join(", ");
    const prompt = `Viết 2-3 câu mô tả sự kiện "${eventType}" tại bước thứ ${step} trong thám hiểm nhóm ở thế giới "${worldName}". Đội có: ${memberStr}. Kết quả: ${goldChange > 0 ? `+${goldChange} gold` : `${goldChange} gold`}, ${hpChange < 0 ? `${hpChange} HP` : "hồi HP"}. Tiếng Việt, phong cách lore cyber cultivation. Chỉ trả mô tả, không giải thích.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const titleMap: Record<string, string[]> = {
      combat: ["Đụng Độ Quái Vật", "Gặp Kẻ Thù", "Chiến Đấu Đột Ngột"],
      treasure: ["Tìm Thấy Kho Báu", "Rương Bí Mật", "Phần Thưởng Huyền Bí"],
      trap: ["Bẫy Hiểm!", "Cạm Bẫy Cổ Xưa", "Nguy Hiểm Rình Rập"],
      npc: ["Gặp Dị Nhân", "Lữ Hành Đơn Độc", "Thương Nhân Lạ Mặt"],
      rest: ["Cắm Trại Nghỉ Ngơi", "Dừng Chân Hồi Sức", "Tạm Nghỉ"],
    };
    const titles = titleMap[eventType] ?? ["Sự Kiện Bí Ẩn"];
    return { title: titles[Math.floor(Math.random() * titles.length)], description: text, goldChange, expChange, hpChange, success: !isBad };
  } catch {
    return {
      title: `Sự kiện ${eventType}`, description: `Đội thám hiểm gặp ${eventType} ở bước ${step}.`,
      goldChange, expChange, hpChange, success: !isBad,
    };
  }
}

/* ─────────────────────────────────────────────────────
   POST /api/expedition/create — tạo đội thám hiểm
───────────────────────────────────────────────────── */
router.post("/api/expedition/create", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const body = z.object({
      worldSlug: z.string(),
      difficulty: z.enum(["easy", "normal", "hard"]).default("normal"),
    }).parse(req.body);

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const existing = await db.select().from(expeditions).where(
      and(eq(expeditions.leaderId, userId), or(eq(expeditions.status, "recruiting"), eq(expeditions.status, "active")))
    );
    if (existing.length > 0) return res.status(400).json({ message: "Bạn đang có cuộc thám hiểm chưa kết thúc" });

    const worldMap: Record<string, string> = { cultivation: "Tu Tiên Giới", cyberpunk: "Thế Giới Cyberpunk", wasteland: "Vùng Hoang Phế" };
    let worldName = worldMap[body.worldSlug];
    if (!worldName) {
      const [w] = await db.select().from(customWorlds).where(eq(customWorlds.slug, body.worldSlug));
      worldName = w?.name ?? body.worldSlug;
    }

    const totalSteps = body.difficulty === "easy" ? 5 : body.difficulty === "hard" ? 12 : 8;
    const mapData = await generateMapData(worldName, body.difficulty, totalSteps);

    const goldReward = body.difficulty === "easy" ? 200 : body.difficulty === "hard" ? 800 : 400;
    const expReward = body.difficulty === "easy" ? 100 : body.difficulty === "hard" ? 400 : 200;

    const [exp] = await db.insert(expeditions).values({
      worldSlug: body.worldSlug, worldName, leaderId: userId, leaderName: char.name,
      title: `Thám Hiểm ${worldName}`, totalSteps, mapData,
      difficulty: body.difficulty, goldReward, expReward,
      members: [{ userId, characterId: char.id, name: char.name, level: char.level }],
    }).returning();

    res.json({ expedition: exp, message: `Đã tạo đội thám hiểm! Chờ thành viên (tối đa 4 người).` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/expedition/open — danh sách expedition đang chiêu mộ
───────────────────────────────────────────────────── */
router.get("/api/expedition/open", isAuthenticated, async (req, res) => {
  try {
    const list = await db.select().from(expeditions).where(eq(expeditions.status, "recruiting")).orderBy(desc(expeditions.createdAt)).limit(20);
    res.json(list);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/expedition/join/:id — gia nhập đội
───────────────────────────────────────────────────── */
router.post("/api/expedition/join/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params as Record<string, string>;

    const [exp] = await db.select().from(expeditions).where(eq(expeditions.id, id));
    if (!exp) return res.status(404).json({ message: "Không tìm thấy đội" });
    if (exp.status !== "recruiting") return res.status(400).json({ message: "Đội đã khởi hành rồi" });

    const members = (exp.members as any[]) ?? [];
    if (members.length >= exp.maxMembers) return res.status(400).json({ message: "Đội đã đủ người" });
    if (members.some((m: any) => m.userId === userId)) return res.status(400).json({ message: "Bạn đã ở trong đội này" });

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const newMembers = [...members, { userId, characterId: char.id, name: char.name, level: char.level }];
    const newStatus = newMembers.length >= exp.maxMembers ? "active" : "recruiting";
    const startedAt = newStatus === "active" ? new Date() : exp.startedAt;
    const nextStepAt = newStatus === "active" ? new Date(Date.now() + STEP_COOLDOWN_MS) : exp.nextStepAt;

    const [updated] = await db.update(expeditions).set({ members: newMembers, status: newStatus, startedAt, nextStepAt }).where(eq(expeditions.id, id)).returning();
    res.json({ expedition: updated, message: newStatus === "active" ? "Đội đủ người! Thám hiểm bắt đầu!" : `Đã gia nhập đội! (${newMembers.length}/${exp.maxMembers})` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/expedition/start/:id — leader tự khởi động (không cần đủ người)
───────────────────────────────────────────────────── */
router.post("/api/expedition/start/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params as Record<string, string>;
    const [exp] = await db.select().from(expeditions).where(eq(expeditions.id, id));
    if (!exp) return res.status(404).json({ message: "Không tìm thấy" });
    if (exp.leaderId !== userId) return res.status(403).json({ message: "Chỉ leader mới có thể khởi động" });
    if (exp.status !== "recruiting") return res.status(400).json({ message: "Đội đã khởi hành" });

    const [updated] = await db.update(expeditions).set({
      status: "active", startedAt: new Date(), nextStepAt: new Date(Date.now() + STEP_COOLDOWN_MS),
    }).where(eq(expeditions.id, id)).returning();
    res.json({ expedition: updated, message: "Khởi hành thám hiểm!" });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/expedition/advance/:id — tiến bước tiếp
───────────────────────────────────────────────────── */
router.post("/api/expedition/advance/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params as Record<string, string>;

    const [exp] = await db.select().from(expeditions).where(eq(expeditions.id, id));
    if (!exp) return res.status(404).json({ message: "Không tìm thấy" });
    if (exp.status !== "active") return res.status(400).json({ message: "Thám hiểm không đang hoạt động" });

    const members = (exp.members as any[]) ?? [];
    if (!members.some((m: any) => m.userId === userId)) return res.status(403).json({ message: "Bạn không phải thành viên đội này" });

    if (exp.nextStepAt && new Date() < new Date(exp.nextStepAt)) {
      const remaining = Math.ceil((new Date(exp.nextStepAt).getTime() - Date.now()) / 60000);
      return res.status(400).json({ message: `Cần chờ ${remaining} phút nữa` });
    }

    const nextStep = (exp.currentStep ?? 0) + 1;
    const memberNames = members.map((m: any) => m.name);
    const mapData = exp.mapData as any[];
    const stepData = mapData[nextStep - 1];
    const eventType = stepData?.type ?? pickEventType();

    const narrative = await generateEventNarrative(exp.worldName, eventType, nextStep, memberNames);

    const [event] = await db.insert(expeditionEvents).values({
      expeditionId: id, step: nextStep, eventType,
      title: narrative.title, description: narrative.description,
      goldChange: narrative.goldChange, expChange: narrative.expChange, hpChange: narrative.hpChange,
      success: narrative.success,
    }).returning();

    const isLastStep = nextStep >= (exp.totalSteps ?? 8);
    const newStatus = isLastStep ? "ended" : "active";
    const newNextStepAt = isLastStep ? null : new Date(Date.now() + STEP_COOLDOWN_MS);

    if (mapData[nextStep - 1]) mapData[nextStep - 1].revealed = true;
    if (mapData[nextStep]) mapData[nextStep].revealed = true;

    const [updated] = await db.update(expeditions).set({
      currentStep: nextStep, status: newStatus,
      nextStepAt: newNextStepAt, mapData,
      endedAt: isLastStep ? new Date() : exp.endedAt,
    }).where(eq(expeditions.id, id)).returning();

    for (const member of members) {
      const [char] = await db.select().from(characters).where(eq(characters.userId, member.userId));
      if (!char) continue;
      const goldDelta = Math.floor(narrative.goldChange / members.length);
      const expDelta = Math.floor(narrative.expChange / members.length);
      const hpDelta = narrative.hpChange;
      const cs = char.stats as any ?? {};
      await db.update(characters).set({
        stats: { ...cs, gold: Math.max(0, (cs.gold ?? 0) + goldDelta), hp: Math.max(1, Math.min(cs.maxHp ?? 100, (cs.hp ?? 100) + hpDelta)) },
        exp: (char.exp ?? 0) + expDelta,
      }).where(eq(characters.id, char.id));
    }

    if (isLastStep) {
      for (const member of members) {
        const [char] = await db.select().from(characters).where(eq(characters.userId, member.userId));
        if (!char) continue;
        const bonusGold = Math.floor((exp.goldReward ?? 0) / members.length);
        const bonusExp = Math.floor((exp.expReward ?? 0) / members.length);
        const cs2 = char.stats as any ?? {};
        await db.update(characters).set({ stats: { ...cs2, gold: (cs2.gold ?? 0) + bonusGold }, exp: (char.exp ?? 0) + bonusExp }).where(eq(characters.id, char.id));
      }
    }

    res.json({ expedition: updated, event, isLastStep, message: isLastStep ? `🏆 Thám hiểm hoàn thành! Phần thưởng đã chia!` : narrative.title });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/expedition/active — thám hiểm đang hoạt động của user
───────────────────────────────────────────────────── */
router.get("/api/expedition/active", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const all = await db.select().from(expeditions)
      .where(or(eq(expeditions.status, "recruiting"), eq(expeditions.status, "active")))
      .orderBy(desc(expeditions.createdAt)).limit(50);

    const mine = all.filter(e => {
      const members = (e.members as any[]) ?? [];
      return e.leaderId === userId || members.some((m: any) => m.userId === userId);
    });

    res.json(mine);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/expedition/events/:id — sự kiện của expedition
───────────────────────────────────────────────────── */
router.get("/api/expedition/events/:id", isAuthenticated, async (req, res) => {
  try {
    const events = await db.select().from(expeditionEvents)
      .where(eq(expeditionEvents.expeditionId, req.params.id as string))
      .orderBy(desc(expeditionEvents.step));
    res.json(events);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/expedition/history — lịch sử đã kết thúc
───────────────────────────────────────────────────── */
router.get("/api/expedition/history", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const all = await db.select().from(expeditions).where(eq(expeditions.status, "ended")).orderBy(desc(expeditions.endedAt)).limit(50);
    const mine = all.filter(e => {
      const members = (e.members as any[]) ?? [];
      return e.leaderId === userId || members.some((m: any) => m.userId === userId);
    });
    res.json(mine.slice(0, 10));
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
