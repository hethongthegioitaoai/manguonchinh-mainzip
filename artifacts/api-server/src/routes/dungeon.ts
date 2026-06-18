import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { dungeons, dungeonRuns, characters, items, inventory } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

const DUNGEON_SEEDS = [
  // ── TU TIÊN (CULTIVATION) ──
  { worldSlug: "cultivation", name: "Thiên Ma Cổ Mộ",   description: "Lăng mộ của một thiên ma cổ đại. Linh khí đậm đặc nhưng nguy hiểm.", difficulty: "easy",   floors: 5, minLevel: 1,  floorEnemyScale: 5,  rewardMultiplier: 1, icon: "🪦" },
  { worldSlug: "cultivation", name: "Huyết Kiếm Tông",  description: "Tông phái tà ma bị tiêu diệt. Hồn linh vẫn còn vảng vất.", difficulty: "normal", floors: 7, minLevel: 15, floorEnemyScale: 10, rewardMultiplier: 2, icon: "⚔️" },
  { worldSlug: "cultivation", name: "Tiên Đài Thiên Phong", description: "Thử thách của các đại tiên — chỉ dành cho kẻ đã đạt Thiên Tiên.", difficulty: "hard",   floors: 10,minLevel: 40, floorEnemyScale: 20, rewardMultiplier: 3, icon: "⛩️" },
  // ── CYBERPUNK ──
  { worldSlug: "cyberpunk",   name: "Khu Ổ Chuột Tầng B12", description: "Tầng hầm ngầm của megacorp bỏ hoang. Bot chiến đấu vẫn còn kích hoạt.", difficulty: "easy",   floors: 5, minLevel: 1,  floorEnemyScale: 5,  rewardMultiplier: 1, icon: "🤖" },
  { worldSlug: "cyberpunk",   name: "Datacenter Thất Thủ", description: "Máy chủ AI nổi loạn chiếm toàn bộ datacenter. Hack & combat kết hợp.", difficulty: "normal", floors: 7, minLevel: 15, floorEnemyScale: 10, rewardMultiplier: 2, icon: "💻" },
  { worldSlug: "cyberpunk",   name: "Orbital Station ∆9",  description: "Trạm không gian bị AI độc lập kiểm soát. Zero-gravity combat.", difficulty: "hard",   floors: 10,minLevel: 40, floorEnemyScale: 20, rewardMultiplier: 3, icon: "🛸" },
  // ── WASTELAND (HOANG PHẾ) ──
  { worldSlug: "wasteland",   name: "Hầm Trú Ẩn S-7",  description: "Bunker trước đại chiến. Những kẻ đột biến chiếm lĩnh từ lâu.", difficulty: "easy",   floors: 5, minLevel: 1,  floorEnemyScale: 5,  rewardMultiplier: 1, icon: "🏚️" },
  { worldSlug: "wasteland",   name: "Lò Luyện Địa Ngục", description: "Nhà máy luyện thép bị bỏ hoang. Bức xạ cao + quái vật kim loại.", difficulty: "normal", floors: 7, minLevel: 15, floorEnemyScale: 10, rewardMultiplier: 2, icon: "🏭" },
  { worldSlug: "wasteland",   name: "Mộ Thành Cổ Đại",  description: "Tàn tích của một nền văn minh cũ. Boss cuối là một AI cổ thức tỉnh.", difficulty: "hard",   floors: 10,minLevel: 40, floorEnemyScale: 20, rewardMultiplier: 3, icon: "🗿" },
];

async function seedDungeons() {
  const existing = await db.select({ id: dungeons.id }).from(dungeons);
  if (existing.length > 0) return;
  await db.insert(dungeons).values(DUNGEON_SEEDS);
}

function generateFloorEnemy(floorNum: number, dungeonDifficulty: string, dungeonScale: number) {
  const baseLevel = floorNum * dungeonScale;
  const isBoss = floorNum % 5 === 0;
  const bossMultiplier = isBoss ? 2.5 : 1;
  const diffMultiplier = dungeonDifficulty === "hard" ? 1.5 : dungeonDifficulty === "normal" ? 1.2 : 1;
  const hp = Math.round(baseLevel * 8 * bossMultiplier * diffMultiplier);
  const atk = Math.round(baseLevel * 2 * diffMultiplier);
  return {
    name: isBoss ? `👹 Trùm Tầng ${floorNum}` : `👾 Kẻ Thù Tầng ${floorNum}`,
    hp, maxHp: hp, atk,
    isBoss, level: Math.round(baseLevel * diffMultiplier),
  };
}

function rollLoot(floor: number, rarity: string) {
  const lootTable: Record<string, { items: string[]; icon: string }> = {
    common:   { items: ["Kinh Văn Cơ Bản", "Đan Dược Thấp Cấp", "Mảnh Quặng", "Băng Cuộn Vết Thương"], icon: "📦" },
    uncommon: { items: ["Kinh Văn Trung Cấp", "Đan Dược Trung Cấp", "Tinh Quặng", "Giáp Da Cũ"], icon: "🔵" },
    rare:     { items: ["Kinh Văn Thượng Cấp", "Đan Dược Cao Cấp", "Bảo Thạch", "Kiếm Linh"], icon: "💜" },
    epic:     { items: ["Pháp Bảo Cổ Đại", "Thần Đan", "Huyền Thạch Tinh", "Thánh Kiếm"], icon: "🟡" },
  };
  const t = lootTable[rarity] ?? lootTable.common;
  const name = t.items[Math.floor(Math.random() * t.items.length)];
  return { floor, itemName: name, rarity, icon: t.icon };
}

// GET /api/dungeon/list/:worldSlug
router.get("/dungeon/list/:worldSlug", isAuthenticated, async (req: any, res) => {
  try {
    await seedDungeons();
    const { worldSlug } = req.params;
    const list = await db.select().from(dungeons).where(eq(dungeons.worldSlug, worldSlug));
    const userId = (req as any).userId;

    const chars = await db.select({ id: characters.id }).from(characters).where(eq(characters.userId, userId));
    const charId = chars[0]?.id;

    let activeRun: typeof dungeonRuns.$inferSelect | null = null;
    if (charId) {
      const [run] = await db.select().from(dungeonRuns)
        .where(and(eq(dungeonRuns.characterId, charId), eq(dungeonRuns.status, "active")))
        .orderBy(desc(dungeonRuns.startedAt)).limit(1);
      activeRun = run ?? null;
    }

    res.json({ dungeons: list, activeRun });
  } catch (err: any) {
    console.error("dungeon list error:", err?.message);
    res.status(500).json({ message: "Lỗi lấy danh sách dungeon" });
  }
});

// GET /api/dungeon/active
router.get("/dungeon/active", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.json({ activeRun: null });

    const [run] = await db.select().from(dungeonRuns)
      .where(and(eq(dungeonRuns.characterId, char.id), eq(dungeonRuns.status, "active")))
      .orderBy(desc(dungeonRuns.startedAt)).limit(1);

    if (!run) return res.json({ activeRun: null });

    const [dungeon] = await db.select().from(dungeons).where(eq(dungeons.id, run.dungeonId));
    const enemy = generateFloorEnemy(run.currentFloor, dungeon.difficulty, dungeon.floorEnemyScale);

    res.json({ activeRun: run, dungeon, currentEnemy: enemy });
  } catch (err: any) {
    console.error("dungeon active error:", err?.message);
    res.status(500).json({ message: "Lỗi lấy run hiện tại" });
  }
});

// POST /api/dungeon/start/:dungeonId
router.post("/dungeon/start/:dungeonId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { dungeonId } = req.params;

    await seedDungeons();
    const [dungeon] = await db.select().from(dungeons).where(eq(dungeons.id, dungeonId));
    if (!dungeon) return res.status(404).json({ message: "Dungeon không tồn tại" });

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    if (char.level < dungeon.minLevel) {
      return res.status(400).json({ message: `Cần cấp ${dungeon.minLevel} để vào dungeon này` });
    }

    const existing = await db.select().from(dungeonRuns)
      .where(and(eq(dungeonRuns.characterId, char.id), eq(dungeonRuns.status, "active")));
    if (existing.length > 0) {
      return res.status(400).json({ message: "Đang có run dungeon đang dở — cần hoàn thành hoặc thoát trước" });
    }

    const maxHp = 100 + (char.level - 1) * 10;
    const [run] = await db.insert(dungeonRuns).values({
      characterId: char.id,
      dungeonId,
      currentFloor: 1,
      hpRemaining: maxHp,
      status: "active",
      loot: [],
      totalExpGained: 0,
      completedFloors: 0,
    }).returning();

    const enemy = generateFloorEnemy(1, dungeon.difficulty, dungeon.floorEnemyScale);
    res.json({ run, dungeon, currentEnemy: enemy, character: { id: char.id, level: char.level, maxHp } });
  } catch (err: any) {
    console.error("dungeon start error:", err?.message);
    res.status(500).json({ message: "Lỗi bắt đầu dungeon" });
  }
});

// POST /api/dungeon/advance — chiến tầng hiện tại
router.post("/dungeon/advance", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { runId, action } = req.body; // action: "fight" | "flee"

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const [run] = await db.select().from(dungeonRuns)
      .where(and(eq(dungeonRuns.id, runId), eq(dungeonRuns.characterId, char.id)));
    if (!run || run.status !== "active") return res.status(400).json({ message: "Run không hợp lệ" });

    const [dungeon] = await db.select().from(dungeons).where(eq(dungeons.id, run.dungeonId));

    if (action === "flee") {
      await db.update(dungeonRuns).set({ status: "fled", finishedAt: new Date() }).where(eq(dungeonRuns.id, run.id));
      return res.json({ result: "fled", message: "Bỏ chạy khỏi dungeon. Mất toàn bộ tiến trình tầng này." });
    }

    const enemy = generateFloorEnemy(run.currentFloor, dungeon.difficulty, dungeon.floorEnemyScale);
    const stats = char.stats as any;

    const charAtk = (stats?.strength ?? 10) * 2 + char.level * 3;
    const charDef = (stats?.defense ?? 10) + char.level;
    const charSpd = stats?.speed ?? 10;

    const enemyAtk = enemy.atk;
    const enemyHp = enemy.hp;

    let charHpLeft = run.hpRemaining;
    let enemyHpLeft = enemyHp;
    let rounds = 0;
    const maxRounds = 20;

    while (charHpLeft > 0 && enemyHpLeft > 0 && rounds < maxRounds) {
      const dmgToEnemy = Math.max(1, charAtk - Math.floor(enemyHp * 0.05) + Math.floor(Math.random() * 10));
      const dmgToChar = Math.max(1, enemyAtk - Math.floor(charDef * 0.5) + Math.floor(Math.random() * 8));
      const speedAdvantage = charSpd > 15;

      if (speedAdvantage) enemyHpLeft -= Math.floor(dmgToEnemy * 1.1);
      else enemyHpLeft -= dmgToEnemy;

      if (enemyHpLeft > 0) charHpLeft -= dmgToChar;
      rounds++;
    }

    const won = enemyHpLeft <= 0 || charHpLeft > 0 && rounds >= maxRounds && enemyHpLeft <= 0;
    const died = charHpLeft <= 0;

    if (died) {
      await db.update(dungeonRuns).set({
        status: "dead",
        hpRemaining: 0,
        finishedAt: new Date(),
      }).where(eq(dungeonRuns.id, run.id));
      return res.json({ result: "dead", message: "Nhân vật đã ngã xuống trong dungeon.", completedFloors: run.completedFloors });
    }

    const isLastFloor = run.currentFloor >= dungeon.floors;
    const lootRarity = enemy.isBoss ? (isLastFloor ? "epic" : "rare") : (run.currentFloor > 5 ? "uncommon" : "common");
    const lootItem = rollLoot(run.currentFloor, lootRarity);
    const expGain = Math.round(enemy.level * 10 * dungeon.rewardMultiplier);

    const newLoot = [...(run.loot as any[] ?? []), lootItem];
    const newExp = run.totalExpGained + expGain;
    const newHp = Math.max(5, Math.round(charHpLeft));

    if (isLastFloor) {
      await db.update(dungeonRuns).set({
        status: "completed",
        hpRemaining: newHp,
        completedFloors: run.completedFloors + 1,
        totalExpGained: newExp,
        loot: newLoot,
        finishedAt: new Date(),
      }).where(eq(dungeonRuns.id, run.id));

      const charNewExp = char.exp + newExp;
      const charNewLevel = Math.floor(charNewExp / 100) + 1;
      await db.update(characters).set({ exp: charNewExp, level: charNewLevel }).where(eq(characters.id, char.id));

      const eligibleItems = await db.select().from(items)
        .where(and(eq(items.worldSlug, dungeon.worldSlug), eq(items.rarity, isLastFloor ? "rare" : "common")));
      if (eligibleItems.length > 0) {
        const picked = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
        await db.insert(inventory).values({ characterId: char.id, itemId: picked.id, quantity: 1 });
      }

      return res.json({
        result: "completed",
        message: `Chinh phục ${dungeon.name} hoàn toàn! Nhận ${newExp} EXP.`,
        expGained: newExp, loot: newLoot, hpRemaining: newHp,
        completedFloors: run.completedFloors + 1,
      });
    }

    await db.update(dungeonRuns).set({
      currentFloor: run.currentFloor + 1,
      hpRemaining: newHp,
      completedFloors: run.completedFloors + 1,
      totalExpGained: newExp,
      loot: newLoot,
    }).where(eq(dungeonRuns.id, run.id));

    const nextEnemy = generateFloorEnemy(run.currentFloor + 1, dungeon.difficulty, dungeon.floorEnemyScale);

    res.json({
      result: "advance",
      message: `Thắng tầng ${run.currentFloor}! Tiến vào tầng ${run.currentFloor + 1}.`,
      expGained: expGain, lootItem, hpRemaining: newHp,
      nextFloor: run.currentFloor + 1,
      nextEnemy,
      completedFloors: run.completedFloors + 1,
    });
  } catch (err: any) {
    console.error("dungeon advance error:", err?.message);
    res.status(500).json({ message: "Lỗi tiến tầng dungeon" });
  }
});

// GET /api/dungeon/history/:characterId
router.get("/dungeon/history/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const { characterId } = req.params;
    const runs = await db.select().from(dungeonRuns)
      .where(eq(dungeonRuns.characterId, characterId))
      .orderBy(desc(dungeonRuns.startedAt)).limit(10);

    const withNames = await Promise.all(runs.map(async (run) => {
      const [d] = await db.select({ name: dungeons.name, icon: dungeons.icon }).from(dungeons).where(eq(dungeons.id, run.dungeonId));
      return { ...run, dungeonName: d?.name ?? "?", dungeonIcon: d?.icon ?? "🏰" };
    }));

    res.json({ runs: withNames });
  } catch (err: any) {
    console.error("dungeon history error:", err?.message);
    res.status(500).json({ message: "Lỗi lấy lịch sử dungeon" });
  }
});

export default router;
