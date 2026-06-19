import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { pets, characters, inventory, items } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

/* ─── PET DEFINITIONS ─── */
interface PetDef {
  species: string; icon: string; worldSlug: string;
  baseExpBonus: number; baseGoldBonus: number; baseCritBonus: number; baseHpBonus: number;
}

const PET_DEFS: PetDef[] = [
  // Tu Tiên
  { species: "Linh Hổ",       icon: "🐯", worldSlug: "cultivation", baseExpBonus: 8,  baseGoldBonus: 3,  baseCritBonus: 5,  baseHpBonus: 2 },
  { species: "Rồng Con",      icon: "🐲", worldSlug: "cultivation", baseExpBonus: 5,  baseGoldBonus: 8,  baseCritBonus: 3,  baseHpBonus: 4 },
  { species: "Phượng Hoàng",  icon: "🦅", worldSlug: "cultivation", baseExpBonus: 12, baseGoldBonus: 5,  baseCritBonus: 2,  baseHpBonus: 6 },
  // Cyberpunk
  { species: "Combat Drone",  icon: "🚁", worldSlug: "cyberpunk",   baseExpBonus: 5,  baseGoldBonus: 4,  baseCritBonus: 8,  baseHpBonus: 1 },
  { species: "Mech Dog",      icon: "🤖", worldSlug: "cyberpunk",   baseExpBonus: 6,  baseGoldBonus: 6,  baseCritBonus: 6,  baseHpBonus: 5 },
  { species: "Nano Spider",   icon: "🕷️", worldSlug: "cyberpunk",   baseExpBonus: 3,  baseGoldBonus: 12, baseCritBonus: 4,  baseHpBonus: 1 },
  // Hoang Phế
  { species: "Mutant Wolf",   icon: "🐺", worldSlug: "wasteland",   baseExpBonus: 7,  baseGoldBonus: 2,  baseCritBonus: 10, baseHpBonus: 3 },
  { species: "Scavenger Bird",icon: "🦜", worldSlug: "wasteland",   baseExpBonus: 10, baseGoldBonus: 7,  baseCritBonus: 3,  baseHpBonus: 2 },
  { species: "Toxic Slug",    icon: "🐛", worldSlug: "wasteland",   baseExpBonus: 2,  baseGoldBonus: 10, baseCritBonus: 2,  baseHpBonus: 8 },
];

const RARITY_POOL = [
  { rarity: "legendary", weight: 1  },
  { rarity: "epic",      weight: 4  },
  { rarity: "rare",      weight: 15 },
  { rarity: "uncommon",  weight: 30 },
  { rarity: "common",    weight: 50 },
];

const RARITY_MULTIPLIER: Record<string, number> = {
  common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 5,
};

const SUMMON_COST   = 200;
const SUMMON_COOLDOWN_H = 12; // 12 tiếng

const TIER_EXP: Record<number, number> = { 1: 100, 2: 300, 3: 700, 4: 1500, 5: Infinity };

function rollRarity(): string {
  const total = RARITY_POOL.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const { rarity, weight } of RARITY_POOL) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return "common";
}

function rollPetDef(worldSlug: string): PetDef {
  const pool = PET_DEFS.filter(p => p.worldSlug === worldSlug);
  return pool[Math.floor(Math.random() * pool.length)];
}

function calcSkills(def: PetDef, rarity: string, tier: number): { expBonus: number; goldBonus: number; critBonus: number; hpBonus: number } {
  const mult  = RARITY_MULTIPLIER[rarity] ?? 1;
  const tMult = 1 + (tier - 1) * 0.5;
  return {
    expBonus:  Math.round(def.baseExpBonus  * mult * tMult),
    goldBonus: Math.round(def.baseGoldBonus * mult * tMult),
    critBonus: Math.round(def.baseCritBonus * mult * tMult),
    hpBonus:   Math.round(def.baseHpBonus   * mult * tMult),
  };
}

function generatePetName(species: string, rarity: string): string {
  const prefixes: Record<string, string[]> = {
    legendary: ["Bất Tử", "Thần", "Vô Song", "Tối Thượng"],
    epic:      ["Huyền Bí", "Thần Thánh", "Ma Vương", "Tinh Anh"],
    rare:      ["Tinh Nhuệ", "Mạnh Mẽ", "Dũng Cảm"],
    uncommon:  ["Nhanh Nhẹn", "Kiên Cường"],
    common:    ["Nhỏ Bé", "Hiền Lành"],
  };
  const p = prefixes[rarity] ?? [""];
  const prefix = p[Math.floor(Math.random() * p.length)];
  return `${prefix} ${species}`.trim();
}

function getGold(stats: unknown): number { return ((stats as any)?.gold ?? 0) as number; }

/* ─── API ROUTES ─── */

// GET /api/pets/my-chars — nhân vật + info
router.get("/pets/my-chars", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const chars  = await db.select().from(characters).where(eq(characters.userId, userId));
    res.json(chars);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

// GET /api/pets/my/:characterId — danh sách pet của nhân vật
router.get("/pets/my/:characterId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params as Record<string, string>;
    const [char] = await db.select().from(characters).where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    const myPets = await db.select().from(pets).where(eq(pets.characterId, characterId));
    res.json(myPets);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

// POST /api/pets/summon — triệu hồi pet ngẫu nhiên
router.post("/pets/summon", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = z.object({ characterId: z.string().uuid() }).parse(req.body);

    const [char] = await db.select().from(characters).where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    const gold = getGold(char.stats);
    if (gold < SUMMON_COST) return res.status(400).json({ message: `Không đủ vàng (cần ${SUMMON_COST}, có ${gold})` });

    // Cooldown check
    const worldSlug = (char.stats as any)?.world_slug ?? "cultivation";
    const recentPets = await db.select().from(pets)
      .where(and(
        eq(pets.characterId, characterId),
        sql`last_summoned_at > now() - interval '${sql.raw(String(SUMMON_COOLDOWN_H))} hours'`
      ));
    if (recentPets.length > 0) {
      const lastTime = recentPets[0].lastSummonedAt;
      const nextTime = lastTime ? new Date(lastTime.getTime() + SUMMON_COOLDOWN_H * 3600 * 1000) : new Date();
      return res.status(400).json({ message: `Cooldown chưa hết. Thử lại lúc ${nextTime.toLocaleTimeString("vi-VN")}` });
    }

    // Roll
    const rarity = rollRarity();
    const def    = rollPetDef(worldSlug);
    const tier   = 1;
    const skills = calcSkills(def, rarity, tier);
    const name   = generatePetName(def.species, rarity);

    // Deduct gold
    await db.update(characters)
      .set({ stats: sql`stats || jsonb_build_object('gold', ${gold - SUMMON_COST})` })
      .where(eq(characters.id, characterId));

    const [newPet] = await db.insert(pets).values({
      characterId, name, species: def.species, icon: def.icon,
      worldSlug, rarity, tier, level: 1, exp: 0, bondLevel: 0,
      skills, isActive: 0, lastSummonedAt: new Date(),
    }).returning();

    res.status(201).json({ pet: newPet, goldSpent: SUMMON_COST });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// POST /api/pets/:id/equip — kích hoạt pet (deactivate others)
router.post("/pets/:id/equip", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const petId  = req.params.id as string;
    const { characterId } = z.object({ characterId: z.string().uuid() }).parse(req.body);

    const [char] = await db.select().from(characters).where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    const [pet] = await db.select().from(pets).where(and(eq(pets.id, petId), eq(pets.characterId, characterId)));
    if (!pet) return res.status(404).json({ message: "Pet không tồn tại" });

    // Deactivate all, then activate this one
    await db.update(pets).set({ isActive: 0 }).where(eq(pets.characterId, characterId));
    await db.update(pets).set({ isActive: 1 }).where(eq(pets.id, petId));

    res.json({ ok: true, activePet: petId });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

// POST /api/pets/:id/unequip — tắt pet active
router.post("/pets/:id/unequip", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const petId  = req.params.id as string;
    const { characterId } = z.object({ characterId: z.string().uuid() }).parse(req.body);

    const [char] = await db.select().from(characters).where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    await db.update(pets).set({ isActive: 0 }).where(and(eq(pets.id, petId), eq(pets.characterId, characterId)));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

// POST /api/pets/:id/feed — cho pet ăn tăng bond level
router.post("/pets/:id/feed", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const petId  = req.params.id as string;
    const { characterId } = z.object({ characterId: z.string().uuid() }).parse(req.body);

    const [char] = await db.select().from(characters).where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ message: "Không có quyền" });

    const [pet] = await db.select().from(pets).where(and(eq(pets.id, petId), eq(pets.characterId, characterId)));
    if (!pet) return res.status(404).json({ message: "Pet không tồn tại" });

    // Cooldown: 4 tiếng/lần
    if (pet.lastFedAt) {
      const diff = Date.now() - pet.lastFedAt.getTime();
      if (diff < 4 * 3600 * 1000) {
        const next = new Date(pet.lastFedAt.getTime() + 4 * 3600 * 1000);
        return res.status(400).json({ message: `Pet chưa đói. Cho ăn lại lúc ${next.toLocaleTimeString("vi-VN")}` });
      }
    }

    // Tốn 50 vàng để cho ăn
    const gold = getGold(char.stats);
    const feedCost = 50;
    if (gold < feedCost) return res.status(400).json({ message: `Không đủ vàng (cần ${feedCost})` });

    await db.update(characters)
      .set({ stats: sql`stats || jsonb_build_object('gold', ${gold - feedCost})` })
      .where(eq(characters.id, characterId));

    const newBond = Math.min(pet.bondLevel + 1, 50);
    const newExp  = pet.exp + 20;
    const expNeeded = TIER_EXP[pet.tier] ?? 9999;
    let newLevel = pet.level + (newExp >= expNeeded ? 1 : 0);
    let newTier  = pet.tier;

    // Tiến hóa tại level 10, 20, 30
    if (newLevel >= 30 && newTier < 3) { newTier = 3; newLevel = 30; }
    else if (newLevel >= 20 && newTier < 2) { newTier = 2; newLevel = 20; }

    const def = PET_DEFS.find(d => d.species === pet.species);
    const newSkills = def ? calcSkills(def, pet.rarity, newTier) : pet.skills;

    await db.update(pets).set({
      bondLevel: newBond, exp: newExp, level: newLevel, tier: newTier,
      skills: newSkills as any, lastFedAt: new Date(),
    }).where(eq(pets.id, petId));

    const evolved = newTier > pet.tier;
    res.json({ ok: true, newBond, newLevel, newTier, evolved, skills: newSkills, goldSpent: feedCost });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// GET /api/pets/info — pet definitions + summon info
router.get("/pets/info", isAuthenticated, async (_req, res) => {
  res.json({ defs: PET_DEFS, summonCost: SUMMON_COST, cooldownHours: SUMMON_COOLDOWN_H, rarityPool: RARITY_POOL });
});

export default router;
