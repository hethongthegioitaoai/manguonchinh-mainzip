import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcCores,
  npcPersonalities,
  npcCoreMemories,
  npcRelationships,
  npcJobs,
  npcInventory,
  npcTransactions,
  worldMarket,
  marketOrders,
  territories,
  territoryLogs,
} from "@workspace/db/schema";
import { eq, desc, and, or, gt, ne } from "drizzle-orm";

const router = Router();

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getLifeStage(age: number): string {
  if (age <= 12) return "child";
  if (age <= 17) return "teenager";
  if (age <= 59) return "adult";
  return "elder";
}

/* ── Market constants ── */
const MARKET_ITEMS = ["thực phẩm", "cá", "gỗ", "công cụ"] as const;
const BASE_PRICES: Record<string, number> = {
  "thực phẩm": 8,
  cá: 6,
  gỗ: 5,
  "công cụ": 12,
};
const PRICE_BOUNDS: Record<string, [number, number]> = {
  "thực phẩm": [3, 28],
  cá: [2, 22],
  gỗ: [2, 18],
  "công cụ": [5, 35],
};

/* ── Job config ── */
const JOB_CONFIG: Record<
  string,
  { salary: number; produces: string; produceAmt: [number, number] }
> = {
  "nông dân": { salary: 15, produces: "thực phẩm", produceAmt: [1, 3] },
  "thương nhân": { salary: 25, produces: "công cụ", produceAmt: [0, 1] },
  "bảo vệ": { salary: 20, produces: "công cụ", produceAmt: [0, 1] },
  "thợ thủ công": { salary: 18, produces: "gỗ", produceAmt: [1, 2] },
  "ngư dân": { salary: 16, produces: "cá", produceAmt: [2, 4] },
};

function occupationToJob(occupation: string): string {
  const o = occupation.toLowerCase();
  if (o.includes("thương") || o.includes("buôn") || o.includes("chủ"))
    return "thương nhân";
  if (
    o.includes("kiếm") ||
    o.includes("vệ") ||
    o.includes("sát") ||
    o.includes("crusher") ||
    o.includes("titan") ||
    o.includes("jack") ||
    o.includes("viper")
  )
    return "bảo vệ";
  if (
    o.includes("dược") ||
    o.includes("hacker") ||
    o.includes("thuốc") ||
    o.includes("tình báo") ||
    o.includes("kira") ||
    o.includes("maia") ||
    o.includes("elara")
  )
    return "thợ thủ công";
  if (o.includes("ngư") || o.includes("cá")) return "ngư dân";
  return "nông dân";
}

const INIT_INVENTORY: Record<
  string,
  Array<{ itemName: string; quantity: number }>
> = {
  "nông dân": [
    { itemName: "thực phẩm", quantity: 5 },
    { itemName: "gỗ", quantity: 2 },
  ],
  "thương nhân": [
    { itemName: "thực phẩm", quantity: 3 },
    { itemName: "công cụ", quantity: 2 },
  ],
  "bảo vệ": [
    { itemName: "thực phẩm", quantity: 2 },
    { itemName: "công cụ", quantity: 3 },
  ],
  "thợ thủ công": [
    { itemName: "gỗ", quantity: 5 },
    { itemName: "công cụ", quantity: 3 },
    { itemName: "thực phẩm", quantity: 1 },
  ],
  "ngư dân": [
    { itemName: "cá", quantity: 8 },
    { itemName: "gỗ", quantity: 1 },
  ],
};

const FOOD_ITEMS = ["thực phẩm", "cá"];

type TerritoryContext = { prosperity: number; security: number; name: string } | null;

function generateGoal(npc: typeof npcCores.$inferSelect, territory?: TerritoryContext): string {
  // ── Territory overrides (highest priority) ──
  if (territory) {
    // Nguy hiểm: bỏ trốn
    if (territory.security < 30) return `Tìm nơi an toàn — ${territory.name} đang nguy hiểm`;
    // Cực nghèo: kiếm tiền sống còn
    if (territory.prosperity < 25 && npc.money < 80) return `Kiếm tiền — ${territory.name} nghèo, cần tích lũy`;
    // Nghèo trung bình: lao động xây dựng
    if (territory.prosperity < 40 && npc.money < 150) return `Làm ăn chăm chỉ — ${territory.name} cần phát triển`;
    // Thịnh vượng cao: giao lưu, mở rộng quan hệ
    if (territory.prosperity >= 70 && npc.money >= 80 && npc.happiness < 80)
      return `Giao tiếp & kết nối — ${territory.name} thịnh vượng, mở rộng quan hệ`;
    // Rất giàu: phiêu lưu, khám phá
    if (territory.prosperity >= 80 && npc.energy >= 60)
      return `Khám phá — ${territory.name} giàu có, thời cơ phiêu lưu`;
    // Cực thịnh: học tập, phát triển bản thân
    if (territory.prosperity >= 90 && npc.money >= 100)
      return `Học tập & phát triển — ${territory.name} cực thịnh, trau dồi bản thân`;
  }
  // ── Nhu cầu cơ bản ──
  if (npc.money < 30) return "Kiếm tiền — túi tiền gần cạn";
  if (npc.hunger > 70) return "Ăn uống — cơn đói hành hạ";
  if (npc.energy < 25) return "Nghỉ ngơi — kiệt sức hoàn toàn";
  if (npc.happiness < 30) return "Giao tiếp — cần kết nối với ai đó";
  if (npc.hunger > 50) return "Tìm thức ăn — bắt đầu đói";
  if (npc.energy < 50) return "Tìm chỗ nghỉ — cần lấy lại sức";
  if (npc.happiness < 60) return "Giải trí — tâm trạng không tốt";
  return "Khám phá — không có việc gì cấp bách";
}

function scoreToType(score: number): string {
  if (score <= -61) return "kẻ thù";
  if (score <= -21) return "đối thủ";
  if (score <= 20) return "người lạ";
  if (score <= 50) return "người quen";
  if (score <= 75) return "bạn bè";
  return "đồng minh";
}

function describeAction(
  npc: typeof npcCores.$inferSelect,
  personality: typeof npcPersonalities.$inferSelect | null,
): string {
  if (npc.currentGoal?.includes("Kiếm tiền"))
    return personality?.greed && personality.greed > 0.7
      ? `${npc.name} đang tích cực mời chào khách hàng`
      : `${npc.name} đang làm việc chăm chỉ kiếm thêm thu nhập`;
  if (
    npc.currentGoal?.includes("Ăn uống") ||
    npc.currentGoal?.includes("Tìm thức ăn")
  )
    return `${npc.name} đang tìm kiếm thức ăn, bụng réo sôi ùng ục`;
  if (
    npc.currentGoal?.includes("Nghỉ ngơi") ||
    npc.currentGoal?.includes("Tìm chỗ nghỉ")
  )
    return `${npc.name} đang tìm chỗ ngả lưng, mắt díu lại vì mệt`;
  if (
    npc.currentGoal?.includes("Giao tiếp") ||
    npc.currentGoal?.includes("Giải trí")
  )
    return personality?.kindness && personality.kindness > 0.6
      ? `${npc.name} đang trò chuyện vui vẻ`
      : `${npc.name} đang ngồi một mình, nhìn xa xăm`;
  return personality?.curiosity && personality.curiosity > 0.7
    ? `${npc.name} đang tò mò khám phá xung quanh`
    : `${npc.name} đang đi lang thang qua khu vực`;
}

/* ── Upsert inventory ── */
async function upsertInventory(
  npcCoreId: string,
  itemName: string,
  delta: number,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(npcInventory)
    .where(
      and(
        eq(npcInventory.npcCoreId, npcCoreId),
        eq(npcInventory.itemName, itemName),
      ),
    );
  if (existing) {
    await db
      .update(npcInventory)
      .set({ quantity: Math.max(0, existing.quantity + delta) })
      .where(eq(npcInventory.id, existing.id));
  } else if (delta > 0) {
    await db
      .insert(npcInventory)
      .values({ npcCoreId, itemName, quantity: delta });
  }
}

/* ── Record NPC transaction ── */
async function recordTx(
  npcCoreId: string,
  description: string,
  amount: number,
  transactionType: "earn" | "buy" | "sell" | "trade",
): Promise<void> {
  await db
    .insert(npcTransactions)
    .values({ npcCoreId, description, amount, transactionType });
  const all = await db
    .select({ id: npcTransactions.id })
    .from(npcTransactions)
    .where(eq(npcTransactions.npcCoreId, npcCoreId))
    .orderBy(desc(npcTransactions.timestamp));
  if (all.length > 30)
    for (const t of all.slice(30))
      await db.delete(npcTransactions).where(eq(npcTransactions.id, t.id));
}

/* ── Seed world market (base prices) ── */
async function seedMarket(worldSlug: string): Promise<void> {
  for (const item of MARKET_ITEMS) {
    const [existing] = await db
      .select()
      .from(worldMarket)
      .where(
        and(
          eq(worldMarket.worldSlug, worldSlug),
          eq(worldMarket.itemName, item),
        ),
      );
    if (!existing) {
      await db
        .insert(worldMarket)
        .values({
          worldSlug,
          itemName: item,
          currentPrice: BASE_PRICES[item],
          totalSupply: rand(10, 20),
          totalDemand: rand(8, 15),
        });
    }
  }
}

/* ── Get market price for item in a world ── */
async function getMarketPrice(
  worldSlug: string,
  itemName: string,
): Promise<number> {
  const [row] = await db
    .select()
    .from(worldMarket)
    .where(
      and(
        eq(worldMarket.worldSlug, worldSlug),
        eq(worldMarket.itemName, itemName),
      ),
    );
  return row?.currentPrice ?? BASE_PRICES[itemName] ?? 8;
}

/* ── Record a market order + update supply/demand ── */
async function recordMarketOrder(
  worldSlug: string,
  npcId: string | null,
  itemName: string,
  quantity: number,
  orderType: "mua" | "bán",
  price: number,
): Promise<void> {
  await db
    .insert(marketOrders)
    .values({
      npcId,
      worldSlug,
      itemName,
      quantity,
      orderType,
      price,
      status: "filled",
    });
  // Clean up old orders (keep 100 per world)
  const all = await db
    .select({ id: marketOrders.id })
    .from(marketOrders)
    .where(eq(marketOrders.worldSlug, worldSlug))
    .orderBy(desc(marketOrders.createdAt));
  if (all.length > 100)
    for (const o of all.slice(100))
      await db.delete(marketOrders).where(eq(marketOrders.id, o.id));
}

/* ── Update market prices based on supply/demand this tick ── */
async function updateMarketPrices(
  worldSlug: string,
  tickSupply: Record<string, number>,
  tickDemand: Record<string, number>,
): Promise<void> {
  for (const item of MARKET_ITEMS) {
    const [row] = await db
      .select()
      .from(worldMarket)
      .where(
        and(
          eq(worldMarket.worldSlug, worldSlug),
          eq(worldMarket.itemName, item),
        ),
      );
    if (!row) continue;

    const supply = row.totalSupply + (tickSupply[item] ?? 0) || 1;
    const demand = row.totalDemand + (tickDemand[item] ?? 0) || 1;
    const ratio = demand / supply;

    let newPrice = row.currentPrice;
    if (ratio > 1.15) {
      // Demand > supply → tăng giá, tối đa +10%
      const pct = Math.min(0.1, (ratio - 1) * 0.25);
      newPrice = Math.round(newPrice * (1 + pct));
    } else if (ratio < 0.85) {
      // Supply > demand → giảm giá, tối đa -10%
      const pct = Math.min(0.1, (1 - ratio) * 0.25);
      newPrice = Math.round(newPrice * (1 - pct));
    }

    const [lo, hi] = PRICE_BOUNDS[item];
    newPrice = clamp(newPrice, lo, hi);

    const newTotalSupply = Math.min(
      999,
      row.totalSupply + (tickSupply[item] ?? 0),
    );
    const newTotalDemand = Math.min(
      999,
      row.totalDemand + (tickDemand[item] ?? 0),
    );

    await db
      .update(worldMarket)
      .set({
        currentPrice: newPrice,
        totalSupply: newTotalSupply,
        totalDemand: newTotalDemand,
        lastUpdated: new Date(),
      })
      .where(eq(worldMarket.id, row.id));
  }
}

/* ── Relationship delta ── */
function calcRelationshipDelta(
  a: typeof npcCores.$inferSelect,
  b: typeof npcCores.$inferSelect,
  pA: typeof npcPersonalities.$inferSelect | null,
  pB: typeof npcPersonalities.$inferSelect | null,
): { delta: number; memory: string; importance: number } {
  let delta = 0;
  let memory = "";
  let importance = 2;
  const kA = pA?.kindness ?? 0.5,
    kB = pB?.kindness ?? 0.5;
  const gA = pA?.greed ?? 0.5,
    gB = pB?.greed ?? 0.5;
  const brA = pA?.bravery ?? 0.5,
    brB = pB?.bravery ?? 0.5;
  const cA = pA?.curiosity ?? 0.5,
    cB = pB?.curiosity ?? 0.5;

  if (kA > 0.6 && kB > 0.6) {
    delta += rand(8, 15);
    memory = [
      `Gặp ${b.name} và chia sẻ bữa ăn ấm áp`,
      `Giúp ${b.name} giải quyết khó khăn`,
      `${b.name} và tôi trò chuyện chân thành`,
    ][rand(0, 2)];
    importance = 3;
  } else if (gA > 0.7 && b.money < 50) {
    delta += rand(-20, -8);
    memory = [
      `Tranh cãi với ${b.name} về tiền bạc`,
      `Gây khó dễ cho ${b.name} trong mua bán`,
      `Xung đột với ${b.name} vì chênh lệch của cải`,
    ][rand(0, 2)];
    importance = 3;
  } else if (cA > 0.6 && cB > 0.6) {
    delta += rand(5, 12);
    memory = [
      `Cùng ${b.name} khám phá khu vực mới`,
      `Trao đổi thông tin thú vị với ${b.name}`,
      `${b.name} chia sẻ bí mật về thế giới`,
    ][rand(0, 2)];
    importance = 2;
  } else if (brA > 0.75 && brB > 0.75) {
    delta += rand(-10, -3);
    memory = [
      `Tranh giành địa bàn với ${b.name}`,
      `Thách đấu ${b.name} xem ai mạnh hơn`,
      `Xung đột với ${b.name}, không ai chịu lùi`,
    ][rand(0, 2)];
    importance = 3;
  } else if (kA > 0.6 && b.money < 50) {
    delta += rand(5, 10);
    memory = [
      `Giúp ${b.name} tìm việc làm`,
      `Cho ${b.name} mượn tiền`,
      `${b.name} cảm ơn sự giúp đỡ`,
    ][rand(0, 2)];
    importance = 3;
  } else if (gA > 0.65 && gB > 0.65) {
    delta += rand(-8, -2);
    memory = [
      `Cạnh tranh khốc liệt với ${b.name}`,
      `${b.name} phá hợp đồng của tôi`,
      `Tranh cãi lợi nhuận với ${b.name}`,
    ][rand(0, 2)];
    importance = 2;
  } else {
    delta += rand(-3, 5);
    memory = [
      `Chạm mặt ${b.name}, gật đầu chào`,
      `Trao đổi vài câu với ${b.name}`,
      `Gặp ${b.name} ở chợ rồi đi`,
    ][rand(0, 2)];
    importance = 1;
  }
  return { delta, memory, importance };
}

/* ── Upsert relationship ── */
async function upsertRelationship(
  aId: string,
  bId: string,
  delta: number,
): Promise<void> {
  const [idA, idB] = aId < bId ? [aId, bId] : [bId, aId];
  const [existing] = await db
    .select()
    .from(npcRelationships)
    .where(
      and(eq(npcRelationships.npcAId, idA), eq(npcRelationships.npcBId, idB)),
    );
  if (existing) {
    const newScore = clamp(existing.relationshipScore + delta, -100, 100);
    await db
      .update(npcRelationships)
      .set({
        relationshipScore: newScore,
        relationshipType: scoreToType(newScore),
        updatedAt: new Date(),
      })
      .where(eq(npcRelationships.id, existing.id));
  } else {
    const initScore = clamp(delta, -100, 100);
    await db
      .insert(npcRelationships)
      .values({
        npcAId: idA,
        npcBId: idB,
        relationshipScore: initScore,
        relationshipType: scoreToType(initScore),
      });
  }
}

const SEED_DATA: Record<
  string,
  Array<{
    name: string;
    age: number;
    occupation: string;
    money: number;
    energy: number;
    hunger: number;
    happiness: number;
    kindness: number;
    greed: number;
    bravery: number;
    intelligence: number;
    curiosity: number;
  }>
> = {
  cultivation: [
    {
      name: "Hư Vô Lão Nhân",
      age: 312,
      occupation: "Hiền Giả",
      money: 850,
      energy: 60,
      hunger: 30,
      happiness: 75,
      kindness: 0.8,
      greed: 0.1,
      bravery: 0.7,
      intelligence: 0.95,
      curiosity: 0.9,
    },
    {
      name: "Hắc Thị Chủ Tiêu",
      age: 45,
      occupation: "Thương Nhân",
      money: 20,
      energy: 80,
      hunger: 65,
      happiness: 40,
      kindness: 0.3,
      greed: 0.9,
      bravery: 0.5,
      intelligence: 0.75,
      curiosity: 0.4,
    },
    {
      name: "Huyết Kiếm Dạ La",
      age: 28,
      occupation: "Kiếm Khách",
      money: 150,
      energy: 95,
      hunger: 40,
      happiness: 55,
      kindness: 0.2,
      greed: 0.5,
      bravery: 0.95,
      intelligence: 0.6,
      curiosity: 0.3,
    },
    {
      name: "Linh Trà Cô Nương",
      age: 22,
      occupation: "Dược Sư",
      money: 300,
      energy: 70,
      hunger: 55,
      happiness: 80,
      kindness: 0.9,
      greed: 0.2,
      bravery: 0.4,
      intelligence: 0.85,
      curiosity: 0.75,
    },
  ],
  cyberpunk: [
    {
      name: "VIPER-7",
      age: 31,
      occupation: "Sát Thủ",
      money: 500,
      energy: 90,
      hunger: 20,
      happiness: 35,
      kindness: 0.1,
      greed: 0.6,
      bravery: 0.95,
      intelligence: 0.8,
      curiosity: 0.3,
    },
    {
      name: "Nexus Kira",
      age: 26,
      occupation: "Hacker",
      money: 15,
      energy: 55,
      hunger: 75,
      happiness: 45,
      kindness: 0.4,
      greed: 0.8,
      bravery: 0.5,
      intelligence: 0.9,
      curiosity: 0.85,
    },
    {
      name: "IRON-TITAN-03",
      age: 38,
      occupation: "Lãnh Chúa",
      money: 1200,
      energy: 100,
      hunger: 10,
      happiness: 70,
      kindness: 0.6,
      greed: 0.4,
      bravery: 1.0,
      intelligence: 0.65,
      curiosity: 0.2,
    },
    {
      name: "Ghost Maia",
      age: 24,
      occupation: "Tình Báo",
      money: 80,
      energy: 40,
      hunger: 60,
      happiness: 20,
      kindness: 0.5,
      greed: 0.5,
      bravery: 0.7,
      intelligence: 0.95,
      curiosity: 0.7,
    },
  ],
  zombie: [
    {
      name: "Gravel Jack",
      age: 42,
      occupation: "Hộ Vệ",
      money: 50,
      energy: 35,
      hunger: 80,
      happiness: 30,
      kindness: 0.7,
      greed: 0.2,
      bravery: 0.85,
      intelligence: 0.55,
      curiosity: 0.3,
    },
    {
      name: "Rust Mara",
      age: 33,
      occupation: "Thương Nhân",
      money: 200,
      energy: 75,
      hunger: 45,
      happiness: 50,
      kindness: 0.3,
      greed: 0.7,
      bravery: 0.6,
      intelligence: 0.7,
      curiosity: 0.5,
    },
    {
      name: "Bone Crusher",
      age: 35,
      occupation: "Thổ Phỉ",
      money: 90,
      energy: 100,
      hunger: 30,
      happiness: 60,
      kindness: 0.1,
      greed: 0.6,
      bravery: 0.95,
      intelligence: 0.4,
      curiosity: 0.2,
    },
    {
      name: "Doc Elara",
      age: 29,
      occupation: "Thầy Thuốc",
      money: 40,
      energy: 50,
      hunger: 70,
      happiness: 25,
      kindness: 0.95,
      greed: 0.1,
      bravery: 0.5,
      intelligence: 0.9,
      curiosity: 0.65,
    },
  ],
};

/* ════════════════════════════════════════
   GET all NPC cores for a world
════════════════════════════════════════ */
router.get("/npc-core/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const npcs = await db
      .select()
      .from(npcCores)
      .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)))
      .orderBy(npcCores.createdAt);
    const results = await Promise.all(
      npcs.map(async (npc) => {
        const [personality] = await db
          .select()
          .from(npcPersonalities)
          .where(eq(npcPersonalities.npcCoreId, npc.id));
        const memories = await db
          .select()
          .from(npcCoreMemories)
          .where(eq(npcCoreMemories.npcCoreId, npc.id))
          .orderBy(desc(npcCoreMemories.timestamp))
          .limit(5);
        return {
          ...npc,
          personality: personality ?? null,
          recentMemories: memories,
        };
      }),
    );
    return res.json(results);
  } catch (err) {
    console.error("[npcCore] GET:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   POST seed NPCs for a world
════════════════════════════════════════ */
router.post("/npc-core/seed/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const existing = await db
      .select({ id: npcCores.id })
      .from(npcCores)
      .where(eq(npcCores.worldSlug, worldSlug))
      .limit(1);
    if (existing.length > 0)
      return res.json({ message: "Đã có NPC, không cần seed lại", seeded: 0 });

    // Phase 1: lấy danh sách territories của world này để gán cho NPC
    const worldTerritories = await db
      .select({ id: territories.id, name: territories.name, prosperity: territories.prosperity, security: territories.security })
      .from(territories)
      .where(eq(territories.worldSlug, worldSlug));

    const templates = SEED_DATA[worldSlug] ?? SEED_DATA["cultivation"];
    let seeded = 0;

    for (const t of templates) {
      // Chọn ngẫu nhiên 1 territory (null nếu chưa có)
      const assignedTerritory = worldTerritories.length > 0
        ? worldTerritories[rand(0, worldTerritories.length - 1)]
        : null;

      const [created] = await db
        .insert(npcCores)
        .values({
          worldSlug,
          name: t.name,
          age: t.age,
          occupation: t.occupation,
          money: t.money,
          energy: t.energy,
          hunger: t.hunger,
          happiness: t.happiness,
          currentGoal: null,
          territoryId: assignedTerritory?.id ?? null,
        })
        .returning();
      await db
        .insert(npcPersonalities)
        .values({
          npcCoreId: created.id,
          kindness: t.kindness,
          greed: t.greed,
          bravery: t.bravery,
          intelligence: t.intelligence,
          curiosity: t.curiosity,
        });
      await db
        .update(npcCores)
        .set({ currentGoal: generateGoal(created, assignedTerritory) })
        .where(eq(npcCores.id, created.id));

      const jobType = occupationToJob(t.occupation);
      const cfg = JOB_CONFIG[jobType] ?? JOB_CONFIG["thương nhân"];
      const skillLevel = Math.min(
        1,
        parseFloat(
          (0.3 + t.intelligence * 0.5 + Math.random() * 0.2).toFixed(2),
        ),
      );
      await db
        .insert(npcJobs)
        .values({
          npcCoreId: created.id,
          jobType,
          salary: cfg.salary,
          skillLevel,
        });

      for (const item of INIT_INVENTORY[jobType] ??
        INIT_INVENTORY["thương nhân"]) {
        await db
          .insert(npcInventory)
          .values({
            npcCoreId: created.id,
            itemName: item.itemName,
            quantity: item.quantity,
          });
      }
      await db
        .insert(npcCoreMemories)
        .values({
          npcCoreId: created.id,
          event: `${created.name} xuất hiện tại ${worldSlug} với tư cách ${created.occupation}`,
          importance: 5,
        });
      seeded++;
    }

    // Seed market cho thế giới này
    await seedMarket(worldSlug);
    return res.json({ message: `Đã tạo ${seeded} NPC`, seeded });
  } catch (err) {
    console.error("[npcCore] seed:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   POST run world cycle tick
════════════════════════════════════════ */
export async function tickNpcWorld(worldSlug: string, limit = 20): Promise<{ message: string; ticked: number; logs: Array<{ name: string; goal: string; action: string }> }> {
  try {
    const npcs = await db
      .select()
      .from(npcCores)
      .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)))
      .limit(limit);
    if (npcs.length === 0)
      return { message: "Không có NPC để tick", ticked: 0, logs: [] };

    // Đảm bảo thị trường đã được khởi tạo
    await seedMarket(worldSlug);

    const logs: Array<{ name: string; goal: string; action: string }> = [];
    // Track supply/demand changes in this tick
    const tickSupply: Record<string, number> = {};
    const tickDemand: Record<string, number> = {};

    // ── Territory Harvest ──
    // Trước khi NPC làm việc, mỗi lãnh thổ tự sản xuất thực phẩm theo prosperity
    {
      const harvestTerritories = await db
        .select()
        .from(territories)
        .where(eq(territories.worldSlug, worldSlug));

      for (const t of harvestTerritories) {
        const pop = t.population ?? 0;
        // Scale harvest theo dân số: log10(pop+10) ≈ 1 ở pop=0, 2 ở pop=90, 3 ở pop=990
        const popScale = Math.max(1, Math.log10(pop + 10));
        let harvest = 0;
        if (t.prosperity >= 70) harvest = Math.round(rand(5, 15) * popScale);
        else if (t.prosperity >= 40) harvest = Math.round(rand(2, 8) * popScale);
        else if (t.prosperity >= 20) harvest = Math.round(rand(0, 3) * popScale);
        // prosperity < 20 → đất cằn cỗi, không sản xuất được

        if (harvest > 0) {
          tickSupply["thực phẩm"] = (tickSupply["thực phẩm"] ?? 0) + harvest;
          await db.insert(territoryLogs).values({
            territoryId: t.id,
            event: `Thu hoạch mùa màng: +${harvest} thực phẩm (prosperity ${t.prosperity}/100, pop ${pop})`,
          });
        }
      }
    }

    // Pre-load personalities + jobs + territories
    const personalityMap = new Map<
      string,
      typeof npcPersonalities.$inferSelect
    >();
    const jobMap = new Map<string, typeof npcJobs.$inferSelect>();
    const territoryMap = new Map<string, TerritoryContext>();
    for (const npc of npcs) {
      const [p] = await db
        .select()
        .from(npcPersonalities)
        .where(eq(npcPersonalities.npcCoreId, npc.id));
      if (p) personalityMap.set(npc.id, p);
      const [j] = await db
        .select()
        .from(npcJobs)
        .where(eq(npcJobs.npcCoreId, npc.id));
      if (j) jobMap.set(npc.id, j);
      // Phase 3: load territory context nếu NPC có territoryId
      if (npc.territoryId) {
        const [t] = await db
          .select({ id: territories.id, name: territories.name, prosperity: territories.prosperity, security: territories.security })
          .from(territories)
          .where(eq(territories.id, npc.territoryId));
        if (t) territoryMap.set(npc.id, t);
      }
    }

    for (const npc of npcs) {
      const personality = personalityMap.get(npc.id) ?? null;
      const job = jobMap.get(npc.id) ?? null;
      const territory = territoryMap.get(npc.id) ?? null;

      let newHunger = clamp(npc.hunger + rand(3, 8), 0, 100);
      let newEnergy = clamp(npc.energy - rand(2, 6), 0, 100);
      let newMoney = npc.money;
      let newHappiness = npc.happiness;
      let memoryEvent = "";
      let memoryImportance = 1;

      const goal = npc.currentGoal ?? "";

      // ── 0. Energy Recovery — NPC ngủ nghỉ nếu kiệt sức ──
      let skipWork = false;
      if (newEnergy < 10) {
        // Kiệt sức hoàn toàn: bắt buộc nghỉ ngơi
        newEnergy = clamp(newEnergy + 40, 0, 100);
        newHappiness = clamp(newHappiness + 5, 0, 100);
        skipWork = true;
        memoryEvent = `${npc.name} kiệt sức, phải nghỉ ngơi để hồi phục`;
        memoryImportance = 1;
      } else if (newEnergy < 20) {
        // Mệt mỏi: tự chọn nghỉ, hồi energy
        newEnergy = clamp(newEnergy + 40, 0, 100);
        newHappiness = clamp(newHappiness + 5, 0, 100);
        skipWork = true;
      }

      // ── 1. Làm việc nhận lương + sản xuất ──
      if (job && !skipWork) {
        const cfg = JOB_CONFIG[job.jobType] ?? JOB_CONFIG["thương nhân"];
        const earned = Math.round(job.salary * (0.7 + job.skillLevel * 0.6));
        newMoney = clamp(newMoney + earned, 0, 9999);
        newEnergy = clamp(newEnergy - rand(2, 5), 0, 100);
        await recordTx(
          npc.id,
          `Làm ${job.jobType}, nhận ${earned} vàng lương`,
          earned,
          "earn",
        );

        const produceQty = rand(...cfg.produceAmt);
        if (produceQty > 0) {
          await upsertInventory(npc.id, cfg.produces, produceQty);
          // Đóng góp vào cung thị trường
          tickSupply[cfg.produces] =
            (tickSupply[cfg.produces] ?? 0) + produceQty;
        }
      }

      // ── 2. Ăn uống nếu đói ──
      if (newHunger > 55) {
        let ate = false;
        for (const foodItem of FOOD_ITEMS) {
          const [inv] = await db
            .select()
            .from(npcInventory)
            .where(
              and(
                eq(npcInventory.npcCoreId, npc.id),
                eq(npcInventory.itemName, foodItem),
              ),
            );
          if (inv && inv.quantity >= 1) {
            await upsertInventory(npc.id, foodItem, -1);
            newHunger = clamp(newHunger - 45, 0, 100);
            newHappiness = clamp(newHappiness + 5, 0, 100);
            memoryEvent = `${npc.name} ăn ${foodItem} từ kho, no bụng hơn`;
            memoryImportance = 1;
            ate = true;
            break;
          }
        }
        // Nếu kho hết → mua từ thị trường
        if (!ate && newMoney >= 8) {
          const marketPrice = await getMarketPrice(worldSlug, "thực phẩm");
          const cost = Math.min(newMoney, marketPrice + rand(0, 3));
          newMoney = clamp(newMoney - cost, 0, 9999);
          newHunger = clamp(newHunger - 50, 0, 100);
          newHappiness = clamp(newHappiness + 6, 0, 100);
          memoryEvent = `${npc.name} mua thực phẩm từ chợ, giá ${cost} vàng`;
          memoryImportance = 2;
          await recordTx(
            npc.id,
            `Mua thực phẩm ở chợ: -${cost} vàng`,
            cost,
            "buy",
          );
          await recordMarketOrder(
            worldSlug,
            npc.id,
            "thực phẩm",
            1,
            "mua",
            cost,
          );
          tickDemand["thực phẩm"] = (tickDemand["thực phẩm"] ?? 0) + 1;
        }
      }

      // ── 3. Hành vi thị trường theo nghề ──
      if (job) {
        const p = personality;
        // Thương nhân tham lam: bán hàng dư với giá cao hơn thị trường
        if (job.jobType === "thương nhân" && (p?.greed ?? 0.5) > 0.6) {
          const allInv = await db
            .select()
            .from(npcInventory)
            .where(eq(npcInventory.npcCoreId, npc.id));
          for (const inv of allInv) {
            if (inv.quantity >= 4 && PRICE_BOUNDS[inv.itemName]) {
              const marketPrice = await getMarketPrice(worldSlug, inv.itemName);
              const sellPrice = Math.round(
                marketPrice * (1.08 + (p?.greed ?? 0.5) * 0.12),
              );
              const sellQty = Math.min(inv.quantity - 2, 3);
              await upsertInventory(npc.id, inv.itemName, -sellQty);
              newMoney = clamp(newMoney + sellPrice * sellQty, 0, 9999);
              memoryEvent = `${npc.name} bán ${sellQty} ${inv.itemName} ở chợ, giá cao ${sellPrice} vàng/đơn vị`;
              memoryImportance = 3;
              await recordTx(
                npc.id,
                `Bán ${sellQty} ${inv.itemName} chợ: +${sellPrice * sellQty} vàng`,
                sellPrice * sellQty,
                "sell",
              );
              await recordMarketOrder(
                worldSlug,
                npc.id,
                inv.itemName,
                sellQty,
                "bán",
                sellPrice,
              );
              tickSupply[inv.itemName] =
                (tickSupply[inv.itemName] ?? 0) + sellQty;
              break;
            }
          }
          // Mua thấp: nếu giá < 85% giá gốc → mua để tích
          for (const item of MARKET_ITEMS) {
            const marketPrice = await getMarketPrice(worldSlug, item);
            if (
              marketPrice < BASE_PRICES[item] * 0.85 &&
              newMoney >= marketPrice * 2
            ) {
              const buyQty = rand(2, 4);
              const cost = marketPrice * buyQty;
              if (newMoney >= cost) {
                newMoney = clamp(newMoney - cost, 0, 9999);
                await upsertInventory(npc.id, item, buyQty);
                await recordTx(
                  npc.id,
                  `Mua thấp ${buyQty} ${item}: -${cost} vàng (giá rẻ)`,
                  cost,
                  "buy",
                );
                await recordMarketOrder(
                  worldSlug,
                  npc.id,
                  item,
                  buyQty,
                  "mua",
                  marketPrice,
                );
                tickDemand[item] = (tickDemand[item] ?? 0) + buyQty;
                if (!memoryEvent) {
                  memoryEvent = `${npc.name} nhanh tay mua ${buyQty} ${item} khi giá hạ còn ${marketPrice} vàng`;
                  memoryImportance = 3;
                }
                break;
              }
            }
          }
        }

        // Thợ thủ công: mua gỗ khi kho thấp
        if (job.jobType === "thợ thủ công") {
          const [woodInv] = await db
            .select()
            .from(npcInventory)
            .where(
              and(
                eq(npcInventory.npcCoreId, npc.id),
                eq(npcInventory.itemName, "gỗ"),
              ),
            );
          const woodQty = woodInv?.quantity ?? 0;
          if (woodQty < 3 && newMoney >= 8) {
            const marketPrice = await getMarketPrice(worldSlug, "gỗ");
            const buyQty = rand(2, 3);
            const cost = marketPrice * buyQty;
            if (newMoney >= cost) {
              newMoney = clamp(newMoney - cost, 0, 9999);
              await upsertInventory(npc.id, "gỗ", buyQty);
              await recordTx(
                npc.id,
                `Mua ${buyQty} gỗ từ chợ: -${cost} vàng`,
                cost,
                "buy",
              );
              await recordMarketOrder(
                worldSlug,
                npc.id,
                "gỗ",
                buyQty,
                "mua",
                marketPrice,
              );
              tickDemand["gỗ"] = (tickDemand["gỗ"] ?? 0) + buyQty;
              if (!memoryEvent) {
                memoryEvent = `${npc.name} mua gỗ để làm thủ công, kho dự trữ đang cạn`;
                memoryImportance = 2;
              }
            }
          }
        }
      }

      // ── 4. Bán tài nguyên dư thừa ra chợ ──
      const allInv = await db
        .select()
        .from(npcInventory)
        .where(eq(npcInventory.npcCoreId, npc.id));
      for (const inv of allInv) {
        if (inv.quantity > 9 && PRICE_BOUNDS[inv.itemName]) {
          const marketPrice = await getMarketPrice(worldSlug, inv.itemName);
          const sellQty = inv.quantity - 5;
          const revenue = sellQty * marketPrice;
          await upsertInventory(npc.id, inv.itemName, -sellQty);
          newMoney = clamp(newMoney + revenue, 0, 9999);
          if (!memoryEvent) {
            memoryEvent = `${npc.name} bán ${sellQty} ${inv.itemName} dư thừa ra chợ, thu ${revenue} vàng`;
            memoryImportance = 2;
          }
          await recordTx(
            npc.id,
            `Bán ${sellQty} ${inv.itemName} chợ: +${revenue} vàng`,
            revenue,
            "sell",
          );
          await recordMarketOrder(
            worldSlug,
            npc.id,
            inv.itemName,
            sellQty,
            "bán",
            marketPrice,
          );
          tickSupply[inv.itemName] = (tickSupply[inv.itemName] ?? 0) + sellQty;
          break;
        }
      }

      // ── 5. Xử lý mục tiêu (nghỉ ngơi / giao tiếp / khám phá) ──
      if (goal.includes("Nghỉ ngơi") || goal.includes("Tìm chỗ nghỉ")) {
        newEnergy = clamp(newEnergy + 50, 0, 100);
        newHappiness = clamp(newHappiness + 5, 0, 100);
        if (!memoryEvent) {
          memoryEvent = `${npc.name} nghỉ ngơi và phục hồi sức lực`;
          memoryImportance = 1;
        }
      } else if (goal.includes("Giao tiếp") || goal.includes("Giải trí")) {
        const boost =
          Math.floor((personality?.kindness ?? 0.5) * 20) + rand(5, 15);
        newHappiness = clamp(newHappiness + boost, 0, 100);
        if (!memoryEvent) {
          memoryEvent = `${npc.name} trò chuyện vui vẻ, tâm trạng khá hơn`;
          memoryImportance = 2;
        }
      } else if (!memoryEvent) {
        newHappiness = clamp(
          newHappiness + Math.floor((personality?.curiosity ?? 0.5) * 10),
          0,
          100,
        );
        // ── Đa dạng memory fallback theo context ──
        const cur = personality?.curiosity ?? 0.5;
        const kind = personality?.kindness ?? 0.5;
        const brave = personality?.bravery ?? 0.5;
        const fallbackPool: Array<[string, number]> = [];

        if (territory) {
          if (territory.prosperity >= 70) {
            fallbackPool.push(
              [`${npc.name} dạo chơi khắp ${territory.name}, tận hưởng sự phồn thịnh`, 2],
              [`${npc.name} ghé thăm khu chợ sầm uất tại ${territory.name}`, 2],
              [`${npc.name} trò chuyện với dân cư ${territory.name} về tin tức địa phương`, 2],
            );
          } else if (territory.prosperity < 40) {
            fallbackPool.push(
              [`${npc.name} nhìn quanh ${territory.name}, thở dài vì cảnh nghèo khó`, 2],
              [`${npc.name} cố tìm cơ hội kiếm thêm thu nhập ở ${territory.name}`, 2],
            );
          }
        }

        if (cur > 0.7) {
          fallbackPool.push(
            [`${npc.name} tò mò quan sát người qua lại, ghi nhớ từng chi tiết lạ`, 1],
            [`${npc.name} khám phá một góc phố chưa từng đặt chân tới`, 2],
            [`${npc.name} đọc bản đồ cũ, vạch ra lộ trình mới`, 1],
          );
        }
        if (kind > 0.6) {
          fallbackPool.push(
            [`${npc.name} giúp một người lạ tìm đường`, 2],
            [`${npc.name} ngồi trò chuyện với người già trong làng`, 1],
          );
        }
        if (brave > 0.75) {
          fallbackPool.push(
            [`${npc.name} luyện tập chiến đấu một mình trong bóng tối`, 1],
            [`${npc.name} tuần tra khu vực xung quanh, cảnh giác mọi động tĩnh`, 2],
          );
        }
        if (npc.money < 60) {
          fallbackPool.push(
            [`${npc.name} đếm từng đồng tiền còn lại, lo lắng cho ngày mai`, 2],
            [`${npc.name} tìm kiếm việc làm thêm nhưng chưa ai thuê`, 1],
          );
        }
        if (npc.happiness > 75) {
          fallbackPool.push(
            [`${npc.name} huýt sáo vui vẻ khi đi qua khu chợ`, 1],
            [`${npc.name} chia sẻ bữa ăn nhỏ với người hàng xóm`, 2],
          );
        }

        // fallback cuối nếu pool rỗng
        if (fallbackPool.length === 0) {
          fallbackPool.push(
            [`${npc.name} lang thang và suy nghĩ về tương lai`, 1],
            [`${npc.name} dừng lại nhìn bầu trời, không nói gì`, 1],
            [`${npc.name} quan sát thị trường nhưng chưa hành động`, 1],
          );
        }

        const picked = fallbackPool[rand(0, fallbackPool.length - 1)];
        memoryEvent = picked[0];
        memoryImportance = picked[1];
      }

      const updatedNpc = {
        ...npc,
        money: newMoney,
        energy: newEnergy,
        hunger: newHunger,
        happiness: newHappiness,
      };
      // Phase 3: truyền territory context vào generateGoal
      const newGoal = generateGoal(updatedNpc, territory);
      const action = describeAction(updatedNpc, personality);

      // Ghi memory territory nếu goal bị ảnh hưởng bởi territory
      if (territory && newGoal.includes(territory.name) && !memoryEvent) {
        if (territory.security < 30) {
          memoryEvent = `${npc.name} cảm thấy bất an ở ${territory.name} — an ninh quá thấp (${territory.security}/100)`;
          memoryImportance = 3;
        } else if (territory.prosperity < 25) {
          memoryEvent = `${npc.name} lo lắng vì ${territory.name} nghèo nàn (prosperity ${territory.prosperity}/100)`;
          memoryImportance = 3;
        }
      }

      const newTickCount = (npc.tickCount ?? 0) + 1;
      const newAge =
        newTickCount % 5 === 0 ? Math.min(npc.age + 1, 120) : npc.age;
      await db
        .update(npcCores)
        .set({
          money: newMoney,
          energy: newEnergy,
          hunger: newHunger,
          happiness: newHappiness,
          currentGoal: newGoal,
          lastTickAt: new Date(),
          tickCount: newTickCount,
          age: newAge,
          lifeStage: getLifeStage(newAge),
        })
        .where(eq(npcCores.id, npc.id));
      await db
        .insert(npcCoreMemories)
        .values({
          npcCoreId: npc.id,
          event: memoryEvent,
          importance: memoryImportance,
        });

      const mems = await db
        .select({ id: npcCoreMemories.id })
        .from(npcCoreMemories)
        .where(eq(npcCoreMemories.npcCoreId, npc.id))
        .orderBy(desc(npcCoreMemories.timestamp));
      if (mems.length > 50)
        for (const m of mems.slice(50))
          await db.delete(npcCoreMemories).where(eq(npcCoreMemories.id, m.id));

      logs.push({ name: npc.name, goal: newGoal, action });
    }

    // ── Gặp gỡ ngẫu nhiên ──
    if (npcs.length >= 2) {
      const numEncounters = npcs.length >= 4 ? 2 : 1;
      const shuffled = [...npcs].sort(() => Math.random() - 0.5);
      for (let i = 0; i < numEncounters && i * 2 + 1 < shuffled.length; i++) {
        const a = shuffled[i * 2],
          b = shuffled[i * 2 + 1];
        const pA = personalityMap.get(a.id) ?? null,
          pB = personalityMap.get(b.id) ?? null;
        const jobA = jobMap.get(a.id) ?? null;
        const {
          delta,
          memory: memEvent,
          importance,
        } = calcRelationshipDelta(a, b, pA, pB);
        await upsertRelationship(a.id, b.id, delta);
        await db
          .insert(npcCoreMemories)
          .values({ npcCoreId: a.id, event: memEvent, importance });
        const revMem = memEvent
          .replace(new RegExp(b.name, "g"), "___T___")
          .replace(new RegExp(a.name, "g"), b.name)
          .replace(/___T___/g, a.name);
        await db
          .insert(npcCoreMemories)
          .values({ npcCoreId: b.id, event: revMem, importance });

        // Giao dịch P2P
        const [aFresh] = await db
          .select()
          .from(npcCores)
          .where(eq(npcCores.id, a.id));
        const [bFresh] = await db
          .select()
          .from(npcCores)
          .where(eq(npcCores.id, b.id));
        for (const [buyer, seller] of [
          [aFresh, bFresh],
          [bFresh, aFresh],
        ] as const) {
          if (buyer.hunger > 60) {
            for (const foodItem of FOOD_ITEMS) {
              const [sellerInv] = await db
                .select()
                .from(npcInventory)
                .where(
                  and(
                    eq(npcInventory.npcCoreId, seller.id),
                    eq(npcInventory.itemName, foodItem),
                  ),
                );
              if (sellerInv && sellerInv.quantity >= 2 && buyer.money >= 8) {
                const price =
                  (await getMarketPrice(worldSlug, foodItem)) + rand(-1, 2);
                await upsertInventory(seller.id, foodItem, -1);
                await db
                  .update(npcCores)
                  .set({ money: clamp(seller.money + price, 0, 9999) })
                  .where(eq(npcCores.id, seller.id));
                await db
                  .update(npcCores)
                  .set({
                    hunger: clamp(buyer.hunger - 35, 0, 100),
                    money: clamp(buyer.money - price, 0, 9999),
                  })
                  .where(eq(npcCores.id, buyer.id));
                await recordTx(
                  buyer.id,
                  `Mua ${foodItem} từ ${seller.name}: -${price} vàng`,
                  price,
                  "trade",
                );
                await recordTx(
                  seller.id,
                  `Bán ${foodItem} cho ${buyer.name}: +${price} vàng`,
                  price,
                  "trade",
                );
                await db
                  .insert(npcCoreMemories)
                  .values({
                    npcCoreId: buyer.id,
                    event: `Mua ${foodItem} từ ${seller.name}, giá ${price} vàng`,
                    importance: 3,
                  });
                await db
                  .insert(npcCoreMemories)
                  .values({
                    npcCoreId: seller.id,
                    event: `Bán ${foodItem} cho ${buyer.name}, thu ${price} vàng`,
                    importance: 3,
                  });
                break;
              }
            }
          }
        }

        if (jobA?.jobType === "thợ thủ công") {
          const [bWood] = await db
            .select()
            .from(npcInventory)
            .where(
              and(
                eq(npcInventory.npcCoreId, b.id),
                eq(npcInventory.itemName, "gỗ"),
              ),
            );
          if (bWood && bWood.quantity >= 2 && a.money >= 8) {
            const price = (await getMarketPrice(worldSlug, "gỗ")) + rand(-1, 1);
            await upsertInventory(b.id, "gỗ", -1);
            await upsertInventory(a.id, "gỗ", 1);
            await db
              .update(npcCores)
              .set({ money: clamp(a.money - price, 0, 9999) })
              .where(eq(npcCores.id, a.id));
            await db
              .update(npcCores)
              .set({ money: clamp(b.money + price, 0, 9999) })
              .where(eq(npcCores.id, b.id));
            await recordTx(
              a.id,
              `Mua gỗ từ ${b.name}: -${price} vàng`,
              price,
              "trade",
            );
            await recordTx(
              b.id,
              `Bán gỗ cho ${a.name}: +${price} vàng`,
              price,
              "trade",
            );
          }
        }
      }
    }

    // ── Territory Migration ──
    // NPC có thể tự động di cư từ vùng nghèo/nguy hiểm → vùng thịnh vượng hơn
    const allTerritories = await db
      .select()
      .from(territories)
      .where(eq(territories.worldSlug, worldSlug));

    if (allTerritories.length >= 2) {
      for (const npc of npcs) {
        const currentTerritory = npc.territoryId
          ? allTerritories.find((t) => t.id === npc.territoryId)
          : null;
        if (!currentTerritory) continue;

        // Điều kiện xét di cư: vùng cực nghèo (<25) hoặc rất nguy hiểm (<30)
        const wantToLeave =
          currentTerritory.prosperity < 25 || currentTerritory.security < 30;
        if (!wantToLeave) continue;

        // Tìm vùng tốt hơn đáng kể (prosperity cao hơn ít nhất 20 điểm, an toàn)
        const candidates = allTerritories.filter(
          (t) =>
            t.id !== currentTerritory.id &&
            t.prosperity > currentTerritory.prosperity + 20 &&
            t.security >= 40,
        );
        if (candidates.length === 0) continue;

        // 30% xác suất di cư mỗi tick khi điều kiện thỏa
        if (Math.random() > 0.3) continue;

        // Lấy thông tin NPC mới nhất để kiểm tra tiền
        const [freshNpc] = await db
          .select()
          .from(npcCores)
          .where(eq(npcCores.id, npc.id));
        if (!freshNpc) continue;

        const movingCost = rand(15, 35);
        if (freshNpc.money < movingCost + 20) continue; // không đủ tiền di chuyển

        const destination = candidates[rand(0, candidates.length - 1)];

        // Thực hiện di cư
        await db
          .update(npcCores)
          .set({
            territoryId: destination.id,
            money: clamp(freshNpc.money - movingCost, 0, 9999),
            energy: clamp(freshNpc.energy - 25, 0, 100),
          })
          .where(eq(npcCores.id, npc.id));

        // Cập nhật dân số territory
        await db
          .update(territories)
          .set({ population: Math.max(0, (currentTerritory.population ?? 0) - 1) })
          .where(eq(territories.id, currentTerritory.id));
        await db
          .update(territories)
          .set({ population: (destination.population ?? 0) + 1 })
          .where(eq(territories.id, destination.id));

        // Ghi memory di cư (importance cao = sự kiện quan trọng)
        await db.insert(npcCoreMemories).values({
          npcCoreId: npc.id,
          event: `${npc.name} rời bỏ ${currentTerritory.name} (thịnh vượng ${currentTerritory.prosperity}/100, an ninh ${currentTerritory.security}/100) và di cư đến ${destination.name} (thịnh vượng ${destination.prosperity}/100) — chi phí di chuyển ${movingCost} vàng`,
          importance: 7,
        });

        // Ghi log territory đích
        await db.insert(territoryLogs).values({
          territoryId: destination.id,
          event: `${npc.name} di cư đến từ ${currentTerritory.name} (vùng suy tàn)`,
        });

        // Ghi log territory nguồn
        await db.insert(territoryLogs).values({
          territoryId: currentTerritory.id,
          event: `${npc.name} rời bỏ vùng này, đến ${destination.name}`,
        });

        logs.push({
          name: npc.name,
          goal: `Di cư đến ${destination.name}`,
          action: `${npc.name} đang di chuyển từ ${currentTerritory.name} → ${destination.name}`,
        });
      }
    }

    // ── Cập nhật giá thị trường (sau harvest + NPC sản xuất) ──
    await updateMarketPrices(worldSlug, tickSupply, tickDemand);

    // ── Supply Decay — tiêu thụ + hư hỏng tự nhiên ──
    // Không có decay → supply chạm 999 → thị trường chết
    {
      const decayTerritories = await db
        .select({ population: territories.population })
        .from(territories)
        .where(eq(territories.worldSlug, worldSlug));

      const totalPop = decayTerritories.reduce((s, t) => s + (t.population ?? 0), 0);

      // Tiêu thụ theo dân số + 3% hư hỏng tự nhiên
      // Rate nhỏ để cân bằng với harvest (harvest scale theo log10 population)
      const consumptionMap: Record<string, number> = {
        "thực phẩm": Math.round(totalPop * 0.04),
        "gỗ":        Math.round(totalPop * 0.01),
        "công cụ":   Math.round(totalPop * 0.002),
      };

      for (const [itemName, consumption] of Object.entries(consumptionMap)) {
        const [row] = await db
          .select()
          .from(worldMarket)
          .where(and(
            eq(worldMarket.worldSlug, worldSlug),
            eq(worldMarket.itemName, itemName),
          ));
        if (!row) continue;

        // Tự nhiên decay 3% + tiêu thụ dân số
        const afterDecay   = Math.floor(row.totalSupply * 0.97);
        const afterConsume = Math.max(0, afterDecay - consumption);

        await db
          .update(worldMarket)
          .set({ totalSupply: afterConsume })
          .where(eq(worldMarket.id, row.id));
      }
    }

    // ── Price → Prosperity Feedback (weighted by local capacity) ──
    // Vùng cằn cỗi chỉ hưởng lợi một phần từ giá rẻ — không phải toàn bộ
    {
      const [foodRow] = await db
        .select()
        .from(worldMarket)
        .where(and(
          eq(worldMarket.worldSlug, worldSlug),
          eq(worldMarket.itemName, "thực phẩm"),
        ));

      if (foodRow) {
        const foodPrice = foodRow.currentPrice;
        const feedbackTerritories = await db
          .select()
          .from(territories)
          .where(eq(territories.worldSlug, worldSlug));

        for (const t of feedbackTerritories) {
          const currentProsperity = t.prosperity ?? 0;
          const currentSecurity   = t.security ?? 0;

          // localProductionFactor: vùng nghèo chỉ hưởng lợi ít từ thị trường chung
          let localProductionFactor: number;
          if      (currentProsperity >= 70) localProductionFactor = 1.0;
          else if (currentProsperity >= 40) localProductionFactor = 0.5;
          else if (currentProsperity >= 20) localProductionFactor = 0.2;
          else                              localProductionFactor = 0.05;

          // securityFactor: vùng không an toàn khó phát triển kinh tế
          const securityFactor = clamp(currentSecurity / 100, 0.1, 1.0);

          let rawDelta = 0;
          if (foodPrice <= 12) {
            rawDelta = rand(1, 3);  // Thực phẩm rẻ → tiềm năng tăng prosperity
          } else if (foodPrice >= 22) {
            rawDelta = -rand(1, 2); // Thực phẩm đắt → giảm prosperity (không nhân hệ số, áp dụng toàn cục)
          }

          if (rawDelta === 0) continue;

          // Gain được nhân hệ số địa phương; loss áp dụng như nhau (đói kém không phân biệt)
          const effectiveDelta = rawDelta > 0
            ? Math.round(rawDelta * localProductionFactor * securityFactor)
            : rawDelta;

          if (effectiveDelta === 0) continue;

          const newProsperity = clamp(currentProsperity + effectiveDelta, 0, 100);
          await db
            .update(territories)
            .set({ prosperity: newProsperity })
            .where(eq(territories.id, t.id));

          const sign = effectiveDelta > 0 ? "+" : "";
          await db.insert(territoryLogs).values({
            territoryId: t.id,
            event: `Giá thực phẩm ${foodPrice}đ × factor ${(localProductionFactor * securityFactor).toFixed(2)} → prosperity ${sign}${effectiveDelta}`,
          });
        }
      }
    }

    // ── Population Dynamics ──
    // Chạy SAU price feedback để dùng prosperity đã được cập nhật
    const latestTerritories = await db
      .select()
      .from(territories)
      .where(eq(territories.worldSlug, worldSlug));

    for (const territory of latestTerritories) {
      const pop = territory.population ?? 0;
      let delta = 0;
      let reason = "";

      if (territory.prosperity > 70) {
        // Vùng thịnh vượng: sinh sản tự nhiên, người ngoài định cư
        delta = rand(0, 2);
        if (delta > 0) reason = `Tăng dân số tự nhiên (prosperity ${territory.prosperity}/100): +${delta}`;
      } else if (territory.prosperity < 20) {
        // Vùng suy tàn: bỏ đi hoặc chết, không ai đến
        delta = -rand(0, 1);
        if (delta < 0) reason = `Giảm dân số tự nhiên (prosperity ${territory.prosperity}/100): ${delta}`;
      }

      if (delta === 0) continue;

      const newPop = Math.max(0, pop + delta);
      await db
        .update(territories)
        .set({ population: newPop })
        .where(eq(territories.id, territory.id));

      if (reason) {
        await db.insert(territoryLogs).values({
          territoryId: territory.id,
          event: reason,
        });
      }
    }

    // ── Territory Collapse ──
    // active   : bình thường
    // abandoned: population = 0 → prosperity/security suy giảm mỗi tick
    // ruins    : prosperity < 10 AND security < 15 → sụp đổ hoàn toàn
    {
      const collapseCheck = await db
        .select()
        .from(territories)
        .where(eq(territories.worldSlug, worldSlug));

      for (const t of collapseCheck) {
        const pop         = t.population ?? 0;
        const prosperity  = t.prosperity ?? 0;
        const security    = t.security ?? 0;
        const status      = t.status ?? "active";

        // 1. Vùng có người → đảm bảo active
        if (pop > 0 && status !== "active") {
          await db
            .update(territories)
            .set({ status: "active" })
            .where(eq(territories.id, t.id));
          await db.insert(territoryLogs).values({
            territoryId: t.id,
            event: `${t.name} được tái định cư (population ${pop}) — trạng thái: active`,
          });
          continue;
        }

        // 2. Vùng trống → chuyển sang abandoned
        if (pop === 0 && status === "active") {
          await db
            .update(territories)
            .set({ status: "abandoned" })
            .where(eq(territories.id, t.id));
          await db.insert(territoryLogs).values({
            territoryId: t.id,
            event: `${t.name} bị bỏ hoang — dân số về 0`,
          });
          continue;
        }

        // 3. Abandoned → suy giảm dần mỗi tick
        if (status === "abandoned") {
          const newProsperity = Math.max(0, prosperity - 1);
          const newSecurity   = Math.max(0, security - 1);

          // Đủ điều kiện collapse thành ruins?
          if (newProsperity < 10 && newSecurity < 15) {
            await db
              .update(territories)
              .set({ status: "ruins", prosperity: newProsperity, security: newSecurity })
              .where(eq(territories.id, t.id));
            await db.insert(territoryLogs).values({
              territoryId: t.id,
              event: `${t.name} sụp đổ hoàn toàn — thành phế tích (prosperity ${newProsperity}, security ${newSecurity})`,
            });
          } else {
            await db
              .update(territories)
              .set({ prosperity: newProsperity, security: newSecurity })
              .where(eq(territories.id, t.id));
            await db.insert(territoryLogs).values({
              territoryId: t.id,
              event: `${t.name} tiếp tục hoang tàn (prosperity ${prosperity}→${newProsperity}, security ${security}→${newSecurity})`,
            });
          }
          continue;
        }

        // 4. Ruins → decay cực chậm (mỗi 5 tick giảm 1)
        if (status === "ruins") {
          // Dùng entropy ngẫu nhiên thấp để tránh update DB mỗi tick
          if (Math.random() < 0.2) {
            const newProsperity = Math.max(0, prosperity - 1);
            const newSecurity   = Math.max(0, security - 1);
            await db
              .update(territories)
              .set({ prosperity: newProsperity, security: newSecurity })
              .where(eq(territories.id, t.id));
          }
        }
      }
    }

    return {
      message: `Đã tick ${logs.length} NPC`,
      ticked: logs.length,
      logs,
    };
  } catch (err) {
    console.error("[npcCore] tick:", err);
    return { message: "Lỗi server", ticked: 0, logs: [] };
  }
}

router.post("/npc-core/tick/:worldSlug", isAuthenticated, async (req, res) => {
  const { worldSlug } = req.params as Record<string, string>;
  const result = await tickNpcWorld(worldSlug);
  return res.json(result);
});




/* ════════════════════════════════════════
   POST /simulation/stress-test/:worldSlug  (DEV ONLY)
   Chạy tickNpcWorld() 200 lần với DB thật,
   validate toàn bộ constraints và report anomalies.
════════════════════════════════════════ */
if (process.env.NODE_ENV !== "production") {
  router.post("/simulation/stress-test/:worldSlug", async (req, res) => {
    const { worldSlug } = req.params as Record<string, string>;
    const TICKS = 200;
    const errors: string[] = [];
    const anomalies: string[] = [];

    // ── Chạy 200 tick ──
    for (let i = 1; i <= TICKS; i++) {
      try {
        await tickNpcWorld(worldSlug);
      } catch (err: any) {
        errors.push(`Tick ${i}: ${err?.message ?? String(err)}`);
      }
    }

    // ── Đọc trạng thái cuối từ DB thật ──
    const [territoriesData, npcsData, marketData] = await Promise.all([
      db.select().from(territories).where(eq(territories.worldSlug, worldSlug)),
      db.select({
        id: npcCores.id,
        name: npcCores.name,
        money: npcCores.money,
        energy: npcCores.energy,
        hunger: npcCores.hunger,
        happiness: npcCores.happiness,
        territoryId: npcCores.territoryId,
      }).from(npcCores).where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1))),
      db.select().from(worldMarket).where(eq(worldMarket.worldSlug, worldSlug)),
    ]);

    // ── Validate & collect anomalies ──
    const VALID_STATUSES = ["active", "abandoned", "ruins"];
    for (const t of territoriesData) {
      if ((t.population ?? 0) < 0)
        anomalies.push(`[territory:${t.name}] population âm: ${t.population}`);
      if ((t.prosperity ?? 0) < 0 || (t.prosperity ?? 0) > 100)
        anomalies.push(`[territory:${t.name}] prosperity out of range: ${t.prosperity}`);
      if ((t.security ?? 0) < 0 || (t.security ?? 0) > 100)
        anomalies.push(`[territory:${t.name}] security out of range: ${t.security}`);
      if (!VALID_STATUSES.includes(t.status ?? ""))
        anomalies.push(`[territory:${t.name}] status không hợp lệ: ${t.status}`);
      if ((t.population ?? 0) > 0 && t.status !== "active")
        anomalies.push(`[territory:${t.name}] có dân (${t.population}) nhưng status="${t.status}" — nên là active`);
    }

    for (const npc of npcsData) {
      if ((npc.money ?? 0) < 0)
        anomalies.push(`[npc:${npc.name}] money âm: ${npc.money}`);
      if ((npc.energy ?? 0) < 0 || (npc.energy ?? 0) > 100)
        anomalies.push(`[npc:${npc.name}] energy out of range: ${npc.energy}`);
      if ((npc.hunger ?? 0) < 0 || (npc.hunger ?? 0) > 100)
        anomalies.push(`[npc:${npc.name}] hunger out of range: ${npc.hunger}`);
      if ((npc.happiness ?? 0) < 0 || (npc.happiness ?? 0) > 100)
        anomalies.push(`[npc:${npc.name}] happiness out of range: ${npc.happiness}`);
    }

    for (const m of marketData) {
      if ((m.currentPrice ?? 0) <= 0)
        anomalies.push(`[market:${m.itemName}] price không hợp lệ: ${m.currentPrice}`);
      if ((m.totalSupply ?? 0) < 0)
        anomalies.push(`[market:${m.itemName}] supply âm: ${m.totalSupply}`);
      if ((m.totalDemand ?? 0) < 0)
        anomalies.push(`[market:${m.itemName}] demand âm: ${m.totalDemand}`);
    }

    // ── Tổng hợp report ──
    const totalPopulation = territoriesData.reduce((s, t) => s + (t.population ?? 0), 0);
    const avgProsperity = territoriesData.length
      ? Math.round(territoriesData.reduce((s, t) => s + (t.prosperity ?? 0), 0) / territoriesData.length)
      : 0;

    return res.json({
      ticksRun: TICKS,
      tickErrors: errors.length,
      anomalyCount: anomalies.length,
      passed: errors.length === 0 && anomalies.length === 0,

      summary: {
        totalPopulation,
        avgProsperity,
        territoryCount: territoriesData.length,
        npcCount: npcsData.length,
        marketItemCount: marketData.length,
      },

      territories: territoriesData.map((t) => ({
        name: t.name,
        status: t.status,
        population: t.population,
        prosperity: t.prosperity,
        security: t.security,
      })),

      npcs: npcsData.map((n) => ({
        name: n.name,
        money: n.money,
        energy: n.energy,
        hunger: n.hunger,
        happiness: n.happiness,
        territoryId: n.territoryId,
      })),

      market: marketData.map((m) => ({
        item: m.itemName,
        price: m.currentPrice,
        supply: m.totalSupply,
        demand: m.totalDemand,
      })),

      errors,
      anomalies,
    });
  });
}

/* ════════════════════════════════════════
   GET market data for a world
════════════════════════════════════════ */
router.get("/npc-market/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    await seedMarket(worldSlug);

    const market = await db
      .select()
      .from(worldMarket)
      .where(eq(worldMarket.worldSlug, worldSlug));
    const recentOrders = await db
      .select()
      .from(marketOrders)
      .where(eq(marketOrders.worldSlug, worldSlug))
      .orderBy(desc(marketOrders.createdAt))
      .limit(30);

    // Attach NPC name to each order
    const ordersWithName = await Promise.all(
      recentOrders.map(async (o) => {
        if (!o.npcId) return { ...o, npcName: "Hệ Thống" };
        const [npc] = await db
          .select({ name: npcCores.name })
          .from(npcCores)
          .where(eq(npcCores.id, o.npcId));
        return { ...o, npcName: npc?.name ?? "Không rõ" };
      }),
    );

    return res.json({ market, recentOrders: ordersWithName });
  } catch (err) {
    console.error("[npcCore] market:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   GET economy data for a single NPC
════════════════════════════════════════ */
router.get("/npc-economy/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params as Record<string, string>;
    const [npc] = await db
      .select()
      .from(npcCores)
      .where(eq(npcCores.id, npcId));
    if (!npc) return res.status(404).json({ message: "Không tìm thấy NPC" });
    const [job] = await db
      .select()
      .from(npcJobs)
      .where(eq(npcJobs.npcCoreId, npcId));
    const inventory = await db
      .select()
      .from(npcInventory)
      .where(eq(npcInventory.npcCoreId, npcId));
    const transactions = await db
      .select()
      .from(npcTransactions)
      .where(eq(npcTransactions.npcCoreId, npcId))
      .orderBy(desc(npcTransactions.timestamp))
      .limit(10);
    return res.json({ npc, job: job ?? null, inventory, transactions });
  } catch (err) {
    console.error("[npcCore] economy:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   GET relationships for a single NPC
════════════════════════════════════════ */
router.get("/npc-relationships/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params as Record<string, string>;
    const rows = await db
      .select()
      .from(npcRelationships)
      .where(
        or(
          eq(npcRelationships.npcAId, npcId),
          eq(npcRelationships.npcBId, npcId),
        ),
      )
      .orderBy(desc(npcRelationships.updatedAt));
    const results = await Promise.all(
      rows.map(async (rel) => {
        const otherId = rel.npcAId === npcId ? rel.npcBId : rel.npcAId;
        const [other] = await db
          .select({
            id: npcCores.id,
            name: npcCores.name,
            occupation: npcCores.occupation,
          })
          .from(npcCores)
          .where(eq(npcCores.id, otherId));
        const recentMemories = await db
          .select()
          .from(npcCoreMemories)
          .where(eq(npcCoreMemories.npcCoreId, npcId))
          .orderBy(desc(npcCoreMemories.timestamp))
          .limit(50);
        const relatedMemories = other
          ? recentMemories
              .filter((m) => m.event.includes(other.name))
              .slice(0, 3)
          : [];
        return {
          ...rel,
          other: other ?? null,
          recentEncounters: relatedMemories,
        };
      }),
    );
    return res.json(results);
  } catch (err) {
    console.error("[npcCore] relationships:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   GET memories of a single NPC
════════════════════════════════════════ */
router.get("/npc-core/:npcId/memories", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params as Record<string, string>;
    const memories = await db
      .select()
      .from(npcCoreMemories)
      .where(eq(npcCoreMemories.npcCoreId, npcId))
      .orderBy(desc(npcCoreMemories.timestamp))
      .limit(20);
    return res.json(memories);
  } catch (err) {
    console.error("[npcCore] memories:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

/* ════════════════════════════════════════
   GET single NPC detail
════════════════════════════════════════ */
router.get("/npc-core/detail/:npcId", isAuthenticated, async (req, res) => {
  try {
    const { npcId } = req.params as Record<string, string>;
    const [npc] = await db
      .select()
      .from(npcCores)
      .where(eq(npcCores.id, npcId));
    if (!npc) return res.status(404).json({ message: "Không tìm thấy NPC" });
    const [personality] = await db
      .select()
      .from(npcPersonalities)
      .where(eq(npcPersonalities.npcCoreId, npcId));
    const memories = await db
      .select()
      .from(npcCoreMemories)
      .where(eq(npcCoreMemories.npcCoreId, npcId))
      .orderBy(desc(npcCoreMemories.timestamp))
      .limit(10);
    return res.json({
      ...npc,
      personality: personality ?? null,
      recentMemories: memories,
    });
  } catch (err) {
    console.error("[npcCore] detail:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
