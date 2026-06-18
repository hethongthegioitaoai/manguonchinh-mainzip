import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { characters } from "@workspace/db/schema";
import { characterSkills } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const SKILL_TREES: Record<string, { id: string; cost: number; requiredLevel: number; requires: string[] }[]> = {
  "Kiếm Thần Hệ Thống": [
    { id: "kiem_than_1", cost: 1, requiredLevel: 1, requires: [] },
    { id: "kiem_than_2", cost: 1, requiredLevel: 3, requires: ["kiem_than_1"] },
    { id: "kiem_than_3", cost: 1, requiredLevel: 3, requires: ["kiem_than_1"] },
    { id: "kiem_than_4", cost: 2, requiredLevel: 6, requires: ["kiem_than_2", "kiem_than_3"] },
    { id: "kiem_than_5", cost: 3, requiredLevel: 10, requires: ["kiem_than_4"] },
  ],
  "Luyện Đan Hệ Thống": [
    { id: "luyen_dan_1", cost: 1, requiredLevel: 1, requires: [] },
    { id: "luyen_dan_2", cost: 1, requiredLevel: 3, requires: ["luyen_dan_1"] },
    { id: "luyen_dan_3", cost: 1, requiredLevel: 3, requires: ["luyen_dan_1"] },
    { id: "luyen_dan_4", cost: 2, requiredLevel: 6, requires: ["luyen_dan_2", "luyen_dan_3"] },
    { id: "luyen_dan_5", cost: 3, requiredLevel: 10, requires: ["luyen_dan_4"] },
  ],
  "Thương Nhân Hệ Thống": [
    { id: "thuong_nhan_1", cost: 1, requiredLevel: 1, requires: [] },
    { id: "thuong_nhan_2", cost: 1, requiredLevel: 3, requires: ["thuong_nhan_1"] },
    { id: "thuong_nhan_3", cost: 1, requiredLevel: 3, requires: ["thuong_nhan_1"] },
    { id: "thuong_nhan_4", cost: 2, requiredLevel: 6, requires: ["thuong_nhan_2", "thuong_nhan_3"] },
    { id: "thuong_nhan_5", cost: 3, requiredLevel: 10, requires: ["thuong_nhan_4"] },
  ],
  "Thú Tướng Hệ Thống": [
    { id: "thu_tuong_1", cost: 1, requiredLevel: 1, requires: [] },
    { id: "thu_tuong_2", cost: 1, requiredLevel: 3, requires: ["thu_tuong_1"] },
    { id: "thu_tuong_3", cost: 1, requiredLevel: 3, requires: ["thu_tuong_1"] },
    { id: "thu_tuong_4", cost: 2, requiredLevel: 6, requires: ["thu_tuong_2", "thu_tuong_3"] },
    { id: "thu_tuong_5", cost: 3, requiredLevel: 10, requires: ["thu_tuong_4"] },
  ],
  "Bất Tử Tu Tiên Hệ Thống": [
    { id: "bat_tu_1", cost: 1, requiredLevel: 1, requires: [] },
    { id: "bat_tu_2", cost: 1, requiredLevel: 3, requires: ["bat_tu_1"] },
    { id: "bat_tu_3", cost: 1, requiredLevel: 3, requires: ["bat_tu_1"] },
    { id: "bat_tu_4", cost: 2, requiredLevel: 6, requires: ["bat_tu_2", "bat_tu_3"] },
    { id: "bat_tu_5", cost: 3, requiredLevel: 10, requires: ["bat_tu_4"] },
  ],
  "Tử Linh Hệ Thống": [
    { id: "tu_linh_1", cost: 1, requiredLevel: 1, requires: [] },
    { id: "tu_linh_2", cost: 1, requiredLevel: 3, requires: ["tu_linh_1"] },
    { id: "tu_linh_3", cost: 1, requiredLevel: 3, requires: ["tu_linh_1"] },
    { id: "tu_linh_4", cost: 2, requiredLevel: 6, requires: ["tu_linh_2", "tu_linh_3"] },
    { id: "tu_linh_5", cost: 3, requiredLevel: 10, requires: ["tu_linh_4"] },
  ],
};

function calcAvailablePoints(level: number, spentPoints: number): number {
  return Math.max(0, level - spentPoints);
}

router.get("/skills/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const [char] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ message: "Character not found" });

    const unlocked = await db
      .select()
      .from(characterSkills)
      .where(eq(characterSkills.characterId, characterId));

    const unlockedIds = unlocked.map((s) => s.skillId);
    const system = (char.stats as any)?.system as string;
    const tree = SKILL_TREES[system] ?? [];
    const spentPoints = tree
      .filter((s) => unlockedIds.includes(s.id))
      .reduce((acc, s) => acc + s.cost, 0);
    const availablePoints = calcAvailablePoints(char.level, spentPoints);

    res.json({
      characterId,
      system,
      level: char.level,
      unlockedSkills: unlocked,
      spentPoints,
      availablePoints,
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch skills" });
  }
});

const unlockSchema = z.object({
  skillId: z.string().min(1),
});

router.post("/skills/:characterId/unlock", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const parsed = unlockSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "skillId is required" });
    const { skillId } = parsed.data;

    const [char] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ message: "Character not found" });

    const system = (char.stats as any)?.system as string;
    const tree = SKILL_TREES[system] ?? [];
    const skillDef = tree.find((s) => s.id === skillId);
    if (!skillDef) return res.status(400).json({ message: "Kỹ năng không thuộc hệ thống của ngươi" });

    const existingSkills = await db
      .select()
      .from(characterSkills)
      .where(eq(characterSkills.characterId, characterId));
    const unlockedIds = existingSkills.map((s) => s.skillId);

    if (unlockedIds.includes(skillId))
      return res.status(400).json({ message: "Đã học kỹ năng này rồi" });

    if (char.level < skillDef.requiredLevel)
      return res.status(400).json({ message: `Cần đạt cấp ${skillDef.requiredLevel} để học kỹ năng này` });

    if (skillDef.requires.length > 0 && !skillDef.requires.some((r) => unlockedIds.includes(r)))
      return res.status(400).json({ message: "Cần học kỹ năng tiên quyết trước" });

    const spentPoints = tree
      .filter((s) => unlockedIds.includes(s.id))
      .reduce((acc, s) => acc + s.cost, 0);
    const availablePoints = calcAvailablePoints(char.level, spentPoints);

    if (availablePoints < skillDef.cost)
      return res.status(400).json({ message: `Cần ${skillDef.cost} điểm kỹ năng, hiện có ${availablePoints}` });

    const [newSkill] = await db
      .insert(characterSkills)
      .values({ characterId, skillId })
      .returning();

    const newSpent = spentPoints + skillDef.cost;
    const newAvailable = calcAvailablePoints(char.level, newSpent);

    res.json({
      skill: newSkill,
      spentPoints: newSpent,
      availablePoints: newAvailable,
    });
  } catch {
    res.status(500).json({ message: "Failed to unlock skill" });
  }
});

export default router;
