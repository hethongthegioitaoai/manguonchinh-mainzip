import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldUniqueSkills, characterWorldSkills, characters, customWorlds, citizenships } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const BUILTIN_WORLDS: Record<string, string> = {
  cultivation: "Tu Tiên Giới",
  cyberpunk: "Thế Giới Cyberpunk",
  wasteland: "Vùng Hoang Phế",
};

const BUFF_TYPES = ["exp_bonus", "gold_find", "crit_chance", "defense_bonus", "hp_regen", "attack_bonus"];

async function seedWorldSkills(worldSlug: string, worldName: string): Promise<void> {
  const existing = await db.select().from(worldUniqueSkills).where(eq(worldUniqueSkills.worldSlug, worldSlug));
  if (existing.length >= 3) return;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(
      `Tạo 3 kỹ năng độc đáo cho thế giới "${worldName}" trong game nhập vai. Mỗi kỹ năng: tên (3-5 từ tiếng Việt), mô tả (1 câu, 10-15 từ). Trả về dạng JSON array: [{"name":"...","desc":"..."},{"name":"...","desc":"..."},{"name":"...","desc":"..."}]. Chỉ JSON, không giải thích.`
    );
    const text = result.response.text().trim().replace(/```json\n?|\n?```/g, "");
    const parsed = JSON.parse(text);
    for (let i = 0; i < parsed.length && i < 3; i++) {
      const buffType = BUFF_TYPES[i % BUFF_TYPES.length];
      await db.insert(worldUniqueSkills).values({
        worldSlug, skillName: parsed[i].name, skillDesc: parsed[i].desc,
        buffType, buffValue: 10 + i * 5,
        requiredLevel: 5 + i * 5, learnCost: 300 + i * 200,
      }).onConflictDoNothing();
    }
  } catch {
    const defaults = [
      { name: `Ngộ Đạo ${worldName}`, desc: `Thấm nhuần tinh hoa của ${worldName}`, buff: "exp_bonus", val: 10, lvl: 5, cost: 300 },
      { name: `Khí Vận ${worldName}`, desc: `Vận khí theo dòng năng lượng đặc trưng`, buff: "gold_find", val: 15, lvl: 10, cost: 500 },
      { name: `Bí Truyền ${worldName}`, desc: `Bí kíp tối thượng chỉ được truyền dạy ở đây`, buff: "crit_chance", val: 20, lvl: 20, cost: 800 },
    ];
    for (const d of defaults) {
      await db.insert(worldUniqueSkills).values({ worldSlug, skillName: d.name, skillDesc: d.desc, buffType: d.buff, buffValue: d.val, requiredLevel: d.lvl, learnCost: d.cost }).onConflictDoNothing();
    }
  }
}

/* ─────────────────────────────────────────────────────
   GET /api/world-skills/:worldSlug — kỹ năng của thế giới
───────────────────────────────────────────────────── */
router.get("/api/world-skills/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const userId = (req as any).userId;

    const worldName = BUILTIN_WORLDS[worldSlug] ?? (await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug)).limit(1))[0]?.name ?? worldSlug;

    await seedWorldSkills(worldSlug, worldName);

    const skills = await db.select().from(worldUniqueSkills).where(eq(worldUniqueSkills.worldSlug, worldSlug)).orderBy(worldUniqueSkills.requiredLevel);
    const mySkills = await db.select().from(characterWorldSkills).where(and(eq(characterWorldSkills.userId, userId), eq(characterWorldSkills.worldSlug, worldSlug)));

    const hasCitizenship = await db.select().from(citizenships).where(
      and(eq(citizenships.userId, userId), eq(citizenships.worldSlug, worldSlug), eq(citizenships.status, "approved"))
    );

    res.json({ skills, mySkills, hasCitizenship: hasCitizenship.length > 0 || !!BUILTIN_WORLDS[worldSlug], worldName });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/world-skills/learn — học kỹ năng
───────────────────────────────────────────────────── */
router.post("/api/world-skills/learn", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { skillId } = req.body;
    if (!skillId) return res.status(400).json({ message: "Thiếu skillId" });

    const [skill] = await db.select().from(worldUniqueSkills).where(eq(worldUniqueSkills.id, skillId));
    if (!skill) return res.status(404).json({ message: "Không tìm thấy kỹ năng" });

    const isBuiltin = !!BUILTIN_WORLDS[skill.worldSlug];
    if (!isBuiltin) {
      const hasCit = await db.select().from(citizenships).where(
        and(eq(citizenships.userId, userId), eq(citizenships.worldSlug, skill.worldSlug), eq(citizenships.status, "approved"))
      );
      if (!hasCit.length) return res.status(403).json({ message: "Cần có quốc tịch để học kỹ năng thế giới này" });
    }

    const already = await db.select().from(characterWorldSkills).where(
      and(eq(characterWorldSkills.userId, userId), eq(characterWorldSkills.skillId, skillId))
    );
    if (already.length > 0) return res.status(400).json({ message: "Bạn đã học kỹ năng này rồi" });

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });
    if ((char.level ?? 1) < skill.requiredLevel) return res.status(400).json({ message: `Cần cấp ${skill.requiredLevel} để học kỹ năng này` });
    if ((char.gold ?? 0) < skill.learnCost) return res.status(400).json({ message: `Cần ${skill.learnCost} gold để học` });

    await db.update(characters).set({ gold: (char.gold ?? 0) - skill.learnCost }).where(eq(characters.id, char.id));
    await db.update(worldUniqueSkills).set({ learners: (skill.learners ?? 0) + 1 }).where(eq(worldUniqueSkills.id, skillId));

    const [learned] = await db.insert(characterWorldSkills).values({
      characterId: char.id, userId, worldSlug: skill.worldSlug,
      skillId: skill.id, skillName: skill.skillName, buffType: skill.buffType, buffValue: skill.buffValue,
    }).returning();

    res.json({ skill: learned, message: `Đã học "${skill.skillName}"! +${skill.buffValue}% ${skill.buffType.replace("_", " ")}` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/world-skills/my — tất cả kỹ năng đã học
───────────────────────────────────────────────────── */
router.get("/api/world-skills/my", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const skills = await db.select().from(characterWorldSkills).where(eq(characterWorldSkills.userId, userId)).orderBy(desc(characterWorldSkills.learnedAt));
    res.json(skills);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
