import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { recipes, characters, inventory, items } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const RECIPE_SEEDS = [
  // ── TU TIÊN ──
  // WEAPON - basic/mid/high
  { worldSlug: "cultivation", tier: "basic",    category: "weapon",  name: "Trường Kiếm Bạc",        description: "Luyện từ kim loại cơ bản và linh khí.", icon: "⚔️", materials: [{ name: "Mảnh Quặng", quantity: 3, rarity: "common" }, { name: "Kinh Văn Cơ Bản", quantity: 1, rarity: "common" }], resultItem: "Trường Kiếm Bạc",    resultRarity: "common",    resultIcon: "⚔️", requiredLevel: 1,  expReward: 30,  },
  { worldSlug: "cultivation", tier: "mid",      category: "weapon",  name: "Kiếm Linh Thanh",        description: "Kết hợp linh thạch và kiếm bạc.",        icon: "🗡️", materials: [{ name: "Tinh Quặng", quantity: 2, rarity: "uncommon" }, { name: "Kinh Văn Trung Cấp", quantity: 2, rarity: "uncommon" }], resultItem: "Kiếm Linh Thanh",    resultRarity: "uncommon",  resultIcon: "🗡️", requiredLevel: 15, expReward: 80,  },
  { worldSlug: "cultivation", tier: "high",     category: "weapon",  name: "Thần Kiếm Cổ Đại",       description: "Pháp bảo cấp cao — cần bảo thạch hiếm.", icon: "⚡", materials: [{ name: "Bảo Thạch", quantity: 1, rarity: "rare" }, { name: "Kiếm Linh", quantity: 1, rarity: "rare" }], resultItem: "Thần Kiếm Cổ Đại",    resultRarity: "rare",      resultIcon: "⚡", requiredLevel: 30, expReward: 200, },
  // ARMOR
  { worldSlug: "cultivation", tier: "basic",    category: "armor",   name: "Giáp Linh Cơ",           description: "Bảo hộ căn bản cho tu sĩ sơ nhập môn.", icon: "🛡️", materials: [{ name: "Mảnh Quặng", quantity: 4, rarity: "common" }, { name: "Băng Cuộn Vết Thương", quantity: 1, rarity: "common" }], resultItem: "Giáp Linh Cơ",        resultRarity: "common",    resultIcon: "🛡️", requiredLevel: 1,  expReward: 25,  },
  { worldSlug: "cultivation", tier: "mid",      category: "armor",   name: "Áo Giáp Thiên Thanh",    description: "Giáp trung cấp — kết cấu từ lụa linh.","icon": "🧥", materials: [{ name: "Tinh Quặng", quantity: 3, rarity: "uncommon" }, { name: "Đan Dược Trung Cấp", quantity: 1, rarity: "uncommon" }], resultItem: "Áo Giáp Thiên Thanh", resultRarity: "uncommon",  resultIcon: "🧥", requiredLevel: 15, expReward: 70,  },
  // ACCESSORY
  { worldSlug: "cultivation", tier: "basic",    category: "accessory",name: "Vòng Linh Nhỏ",          description: "Tăng nhẹ căn cơ tu luyện.",             icon: "💍", materials: [{ name: "Mảnh Quặng", quantity: 2, rarity: "common" }], resultItem: "Vòng Linh Nhỏ",       resultRarity: "common",    resultIcon: "💍", requiredLevel: 1,  expReward: 20,  },
  // CONSUMABLE
  { worldSlug: "cultivation", tier: "basic",    category: "consumable",name: "Đại Hồi Phục Đan",     description: "Đan dược hồi phục HP lớn trong chiến đấu.",icon: "💊", materials: [{ name: "Đan Dược Thấp Cấp", quantity: 3, rarity: "common" }], resultItem: "Đại Hồi Phục Đan",    resultRarity: "uncommon",  resultIcon: "💊", requiredLevel: 5,  expReward: 40,  },
  { worldSlug: "cultivation", tier: "mid",      category: "consumable",name: "Thiên Cấp Trường Sinh Đan","description": "Đan dược thượng phẩm — tu sĩ đại năng mới dùng được.",icon: "🔮", materials: [{ name: "Bảo Thạch", quantity: 1, rarity: "rare" }, { name: "Đan Dược Cao Cấp", quantity: 2, rarity: "rare" }], resultItem: "Thiên Cấp Trường Sinh Đan", resultRarity: "epic", resultIcon: "🔮", requiredLevel: 40, expReward: 300, },
  // SPECIAL
  { worldSlug: "cultivation", tier: "high",     category: "special",  name: "Thần Phù Bảo Hộ",       description: "Pháp bảo đặc biệt — khó chế tạo nhất.", icon: "🌟", materials: [{ name: "Huyền Thạch Tinh", quantity: 1, rarity: "epic" }, { name: "Đan Dược Cao Cấp", quantity: 3, rarity: "rare" }], resultItem: "Thần Phù Bảo Hộ",     resultRarity: "epic",      resultIcon: "🌟", requiredLevel: 50, expReward: 500, },

  // ── CYBERPUNK ──
  { worldSlug: "cyberpunk", tier: "basic",    category: "weapon",   name: "Dao Nano Cơ Bản",     description: "Lưỡi nano — cắt được hầu hết giáp thường.", icon: "🔪", materials: [{ name: "Mảnh Quặng", quantity: 3, rarity: "common" }], resultItem: "Dao Nano Cơ Bản",    resultRarity: "common",    resultIcon: "🔪", requiredLevel: 1,  expReward: 30,  },
  { worldSlug: "cyberpunk", tier: "mid",      category: "weapon",   name: "Súng Xung Điện",      description: "Vũ khí điện từ — EMP cục bộ.",              icon: "⚡", materials: [{ name: "Tinh Quặng", quantity: 2, rarity: "uncommon" }, { name: "Băng Cuộn Vết Thương", quantity: 1, rarity: "common" }], resultItem: "Súng Xung Điện",     resultRarity: "uncommon",  resultIcon: "⚡", requiredLevel: 15, expReward: 80,  },
  { worldSlug: "cyberpunk", tier: "high",     category: "weapon",   name: "Railgun Singularity", description: "Vũ khí hạng nặng — xuyên thủng mọi giáp.",  icon: "🔫", materials: [{ name: "Bảo Thạch", quantity: 1, rarity: "rare" }, { name: "Tinh Quặng", quantity: 3, rarity: "uncommon" }], resultItem: "Railgun Singularity", resultRarity: "rare",      resultIcon: "🔫", requiredLevel: 30, expReward: 200, },
  { worldSlug: "cyberpunk", tier: "basic",    category: "armor",    name: "Giáp Carbon Cơ Bản", description: "Bảo vệ cơ bản với sợi carbon.",              icon: "🦺", materials: [{ name: "Mảnh Quặng", quantity: 4, rarity: "common" }], resultItem: "Giáp Carbon Cơ Bản", resultRarity: "common",    resultIcon: "🦺", requiredLevel: 1,  expReward: 25,  },
  { worldSlug: "cyberpunk", tier: "mid",      category: "armor",    name: "Exosuit Titan",       description: "Giáp ngoại vi tăng cường cơ bắp gấp đôi.", icon: "🤖", materials: [{ name: "Tinh Quặng", quantity: 3, rarity: "uncommon" }, { name: "Đan Dược Trung Cấp", quantity: 1, rarity: "uncommon" }], resultItem: "Exosuit Titan",       resultRarity: "uncommon",  resultIcon: "🤖", requiredLevel: 15, expReward: 70,  },
  { worldSlug: "cyberpunk", tier: "basic",    category: "consumable",name: "Stim-Pack Cơ Bản",   description: "Hồi phục tức thời — chiến đấu không dừng.", icon: "💉", materials: [{ name: "Đan Dược Thấp Cấp", quantity: 3, rarity: "common" }], resultItem: "Stim-Pack Cơ Bản",   resultRarity: "uncommon",  resultIcon: "💉", requiredLevel: 5,  expReward: 40,  },
  { worldSlug: "cyberpunk", tier: "high",     category: "special",  name: "Chip Bất Tử Omega",   description: "Implant truyền thuyết — tiềm năng vô tận.", icon: "🔮", materials: [{ name: "Huyền Thạch Tinh", quantity: 1, rarity: "epic" }, { name: "Bảo Thạch", quantity: 2, rarity: "rare" }], resultItem: "Chip Bất Tử Omega",   resultRarity: "epic",      resultIcon: "🔮", requiredLevel: 50, expReward: 500, },

  // ── WASTELAND ──
  { worldSlug: "wasteland", tier: "basic",    category: "weapon",   name: "Gậy Sắt Phế Liệu",   description: "Đơn giản mà hiệu quả — tìm thấy trong đống rác.", icon: "🔨", materials: [{ name: "Mảnh Quặng", quantity: 3, rarity: "common" }], resultItem: "Gậy Sắt Phế Liệu",  resultRarity: "common",    resultIcon: "🔨", requiredLevel: 1,  expReward: 30,  },
  { worldSlug: "wasteland", tier: "mid",      category: "weapon",   name: "Súng Trường Cải Tiến","description": "Súng phế liệu được nâng cấp — chính xác hơn.", icon: "🪃", materials: [{ name: "Tinh Quặng", quantity: 2, rarity: "uncommon" }, { name: "Kinh Văn Trung Cấp", quantity: 1, rarity: "uncommon" }], resultItem: "Súng Trường Cải Tiến", resultRarity: "uncommon", resultIcon: "🪃", requiredLevel: 15, expReward: 80,  },
  { worldSlug: "wasteland", tier: "high",     category: "weapon",   name: "Plasma Cannon X99",   description: "Vũ khí plasma cổ đại — năng lượng vô tận.", icon: "☢️", materials: [{ name: "Bảo Thạch", quantity: 1, rarity: "rare" }, { name: "Kiếm Linh", quantity: 1, rarity: "rare" }], resultItem: "Plasma Cannon X99",   resultRarity: "rare",      resultIcon: "☢️", requiredLevel: 30, expReward: 200, },
  { worldSlug: "wasteland", tier: "basic",    category: "armor",    name: "Giáp Da Thú Biến Dị", description: "Da của sinh vật đột biến — bền hơn kim loại.",icon: "🐾", materials: [{ name: "Mảnh Quặng", quantity: 4, rarity: "common" }, { name: "Băng Cuộn Vết Thương", quantity: 1, rarity: "common" }], resultItem: "Giáp Da Thú Biến Dị", resultRarity: "common",    resultIcon: "🐾", requiredLevel: 1,  expReward: 25,  },
  { worldSlug: "wasteland", tier: "mid",      category: "armor",    name: "Giáp Titan Phế Liệu", description: "Ghép từ mảnh xe thiết giáp cũ — nặng nhưng bền.", icon: "⚙️", materials: [{ name: "Tinh Quặng", quantity: 3, rarity: "uncommon" }, { name: "Đan Dược Trung Cấp", quantity: 1, rarity: "uncommon" }], resultItem: "Giáp Titan Phế Liệu", resultRarity: "uncommon",  resultIcon: "⚙️", requiredLevel: 15, expReward: 70,  },
  { worldSlug: "wasteland", tier: "basic",    category: "consumable",name: "Huyết Thanh Đột Biến","description": "Chất lỏng đột biến — nguy hiểm nhưng hồi phục nhanh.", icon: "🧪", materials: [{ name: "Đan Dược Thấp Cấp", quantity: 3, rarity: "common" }], resultItem: "Huyết Thanh Đột Biến", resultRarity: "uncommon",  resultIcon: "🧪", requiredLevel: 5,  expReward: 40,  },
  { worldSlug: "wasteland", tier: "high",     category: "special",  name: "Hạt Nhân Nguyên Tử Rỗng", description: "Vũ khí phá hủy diện rộng — dùng cực kỳ cẩn thận.", icon: "💣", materials: [{ name: "Huyền Thạch Tinh", quantity: 1, rarity: "epic" }, { name: "Bảo Thạch", quantity: 2, rarity: "rare" }], resultItem: "Hạt Nhân Nguyên Tử Rỗng", resultRarity: "epic",   resultIcon: "💣", requiredLevel: 50, expReward: 500, },
];

async function seedRecipes() {
  const existing = await db.select({ id: recipes.id }).from(recipes);
  if (existing.length > 0) return;
  await db.insert(recipes).values(RECIPE_SEEDS);
}

// GET /api/craft/recipes/:worldSlug
router.get("/craft/recipes/:worldSlug", isAuthenticated, async (req: any, res) => {
  try {
    await seedRecipes();
    const { worldSlug } = req.params;
    const list = await db.select().from(recipes).where(eq(recipes.worldSlug, worldSlug));
    const userId = (req as any).userId;

    const chars = await db.select({ id: characters.id }).from(characters).where(eq(characters.userId, userId));
    const charId = chars[0]?.id;

    let invItems: { itemId: string; quantity: number; itemName?: string; rarity?: string }[] = [];
    if (charId) {
      const invRows = await db.select({ itemId: inventory.itemId, quantity: inventory.quantity }).from(inventory).where(eq(inventory.characterId, charId));
      const itemIds = invRows.map(r => r.itemId);
      if (itemIds.length > 0) {
        const { inArray } = await import("drizzle-orm");
        const itemDetails = await db.select({ id: items.id, name: items.name, rarity: items.rarity }).from(items).where(inArray(items.id, itemIds));
        invItems = invRows.map(r => {
          const detail = itemDetails.find(i => i.id === r.itemId);
          return { itemId: r.itemId, quantity: r.quantity, itemName: detail?.name, rarity: detail?.rarity };
        });
      }
    }

    const recipesWithAvailability = list.map(r => {
      const materials = r.materials as { name: string; quantity: number; rarity: string }[];
      const canCraft = materials.every(mat => {
        const owned = invItems.filter(inv => inv.rarity === mat.rarity).reduce((s, i) => s + i.quantity, 0);
        return owned >= mat.quantity;
      });
      return { ...r, canCraft, owned: invItems };
    });

    res.json({ recipes: recipesWithAvailability });
  } catch (err: any) {
    console.error("craft recipes error:", err?.message);
    res.status(500).json({ message: "Lỗi lấy công thức" });
  }
});

// POST /api/craft/make
router.post("/craft/make", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { recipeId } = req.body;
    await seedRecipes();

    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    if (!recipe) return res.status(404).json({ message: "Công thức không tồn tại" });

    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    if (char.level < recipe.requiredLevel) {
      return res.status(400).json({ message: `Cần cấp ${recipe.requiredLevel} để chế tạo` });
    }

    const materials = recipe.materials as { name: string; quantity: number; rarity: string }[];
    const { inArray } = await import("drizzle-orm");

    const invRows = await db.select({ id: inventory.id, itemId: inventory.itemId, quantity: inventory.quantity }).from(inventory).where(eq(inventory.characterId, char.id));
    const itemIds = invRows.map(r => r.itemId);
    const itemDetails = itemIds.length > 0 ? await db.select({ id: items.id, name: items.name, rarity: items.rarity }).from(items).where(inArray(items.id, itemIds)) : [];

    for (const mat of materials) {
      const matchingInv = invRows.filter(inv => {
        const detail = itemDetails.find(i => i.id === inv.itemId);
        return detail?.rarity === mat.rarity;
      });
      const totalOwned = matchingInv.reduce((s, i) => s + i.quantity, 0);
      if (totalOwned < mat.quantity) {
        return res.status(400).json({ message: `Thiếu ${mat.name} (${mat.quantity}x) — cần độ hiếm: ${mat.rarity}` });
      }
    }

    let remaining: Record<string, number> = {};
    for (const mat of materials) {
      remaining[mat.rarity] = (remaining[mat.rarity] ?? 0) + mat.quantity;
    }

    for (const [rarity, needed] of Object.entries(remaining)) {
      let toDeduct = needed;
      const matchingInv = invRows.filter(inv => {
        const detail = itemDetails.find(i => i.id === inv.itemId);
        return detail?.rarity === rarity;
      });
      for (const invRow of matchingInv) {
        if (toDeduct <= 0) break;
        const deduct = Math.min(toDeduct, invRow.quantity);
        toDeduct -= deduct;
        if (invRow.quantity - deduct <= 0) {
          await db.delete(inventory).where(eq(inventory.id, invRow.id));
        } else {
          await db.update(inventory).set({ quantity: invRow.quantity - deduct }).where(eq(inventory.id, invRow.id));
        }
      }
    }

    const matchingItems = await db.select().from(items).where(and(eq(items.worldSlug, recipe.worldSlug), eq(items.rarity, recipe.resultRarity)));
    let resultItemId: string | null = null;
    if (matchingItems.length > 0) {
      const picked = matchingItems[Math.floor(Math.random() * matchingItems.length)];
      await db.insert(inventory).values({ characterId: char.id, itemId: picked.id, quantity: 1 });
      resultItemId = picked.id;
    }

    const newExp = char.exp + recipe.expReward;
    const newLevel = Math.floor(newExp / 100) + 1;
    await db.update(characters).set({ exp: newExp, level: newLevel }).where(eq(characters.id, char.id));

    res.json({
      message: `Chế tạo thành công: ${recipe.icon} ${recipe.resultItem}!`,
      resultItem: recipe.resultItem,
      resultRarity: recipe.resultRarity,
      resultIcon: recipe.resultIcon,
      expGained: recipe.expReward,
    });
  } catch (err: any) {
    console.error("craft make error:", err?.message);
    res.status(500).json({ message: "Lỗi chế tạo vật phẩm" });
  }
});

export default router;
