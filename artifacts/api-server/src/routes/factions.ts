import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { factions, characterFaction, characters } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const FACTION_SEEDS: Record<string, {
  name: string; description: string; alignment: string;
  icon: string; color: string; bonusStats: Record<string, number>; lore: string;
}[]> = {
  cultivation: [
    { name: "Thiên Môn Tông", description: "Tông môn cổ xưa theo chính đạo, thờ phụng thiên luật và bảo vệ thế nhân.", alignment: "righteous", icon: "☀", color: "#f59e0b", bonusStats: { SPR: 3, END: 2 }, lore: "Ngàn năm trước, Thiên Môn Tông lập ra để chống lại tà ma." },
    { name: "Ma Đạo Liên Minh", description: "Liên minh của những kẻ theo ma đạo, tìm kiếm sức mạnh bằng mọi giá.", alignment: "evil", icon: "🩸", color: "#ef4444", bonusStats: { STR: 3, INT: 2 }, lore: "Ma đạo không phải ác — chỉ là con đường khác." },
    { name: "Kiếm Tông Trung Lập", description: "Tông phái kiếm thuật thuần túy, không can thiệp chính sự, chỉ theo đuổi đỉnh cao võ đạo.", alignment: "neutral", icon: "⚔", color: "#06b6d4", bonusStats: { AGI: 3, STR: 2 }, lore: "Kiếm là kiếm. Tà hay chính chỉ là trong lòng kẻ cầm kiếm." },
    { name: "Vô Danh Lãng Khách", description: "Những tu sĩ không thuộc tông môn nào, lang thang tự do khắp thiên hạ.", alignment: "wanderer", icon: "🌙", color: "#a855f7", bonusStats: { LCK: 4, AGI: 1 }, lore: "Không tên — không ràng buộc. Thiên hạ rộng lớn, ta một mình đi qua tất cả." },
  ],
  cyberpunk: [
    { name: "Tập Đoàn Arasaka", description: "Tập đoàn megacorp quyền lực nhất, kiểm soát công nghệ và thị trường toàn cầu.", alignment: "evil", icon: "🏢", color: "#ef4444", bonusStats: { INT: 4, LCK: 1 }, lore: "Arasaka không phải kẻ thù — họ là thực tại." },
    { name: "Băng Đảng Đường Phố", description: "Liên minh các băng đảng kiểm soát khu phố tầng dưới, sức mạnh thô bạo.", alignment: "neutral", icon: "🔥", color: "#f97316", bonusStats: { STR: 4, END: 1 }, lore: "Đường phố là nhà. Anh em là gia đình." },
    { name: "Hacker Underground", description: "Mạng lưới hacker bí mật chống lại các tập đoàn, thông tin là vũ khí.", alignment: "righteous", icon: "💻", color: "#06b6d4", bonusStats: { INT: 3, AGI: 2 }, lore: "Dữ liệu là quyền lực. Chúng ta hack để tự do." },
    { name: "Lính Đánh Thuê PMC", description: "Lực lượng quân sự tư nhân, trung thành với người trả tiền cao nhất.", alignment: "wanderer", icon: "🎯", color: "#84cc16", bonusStats: { STR: 2, AGI: 2, END: 1 }, lore: "Không có lý tưởng — chỉ có hợp đồng." },
  ],
  zombie: [
    { name: "Pháo Đài Sinh Tồn", description: "Cộng đồng có tổ chức, bảo vệ thường dân sau bức tường thép.", alignment: "righteous", icon: "🏰", color: "#f59e0b", bonusStats: { END: 4, SPR: 1 }, lore: "Trong địa ngục này, chúng ta vẫn còn người." },
    { name: "Đoàn Săn Mồi", description: "Nhóm thợ săn chuyên nghiệp, thu thập tài nguyên và tiêu diệt zombie đột biến.", alignment: "neutral", icon: "🗡", color: "#ef4444", bonusStats: { AGI: 3, STR: 2 }, lore: "Sống sót bằng cách không ngừng di chuyển và không ngừng giết." },
    { name: "Hội Đồng Trắng", description: "Các nhà khoa học và bác sĩ tìm kiếm vaccine, tin vào tương lai của nhân loại.", alignment: "righteous", icon: "🧬", color: "#06b6d4", bonusStats: { INT: 4, LCK: 1 }, lore: "Khoa học là ánh sáng cuối đường hầm." },
    { name: "Bầy Sói Cô Đơn", description: "Những kẻ sống sót một mình, không tin ai, chỉ tin vào bản năng sinh tồn.", alignment: "wanderer", icon: "🐺", color: "#a855f7", bonusStats: { LCK: 3, AGI: 2 }, lore: "Một mình — nhẹ hơn, nhanh hơn, sống lâu hơn." },
  ],
};

async function ensureFactionsSeed(worldSlug: string) {
  const existing = await db.select().from(factions).where(eq(factions.worldSlug, worldSlug));
  if (existing.length > 0) return existing;
  const seeds = FACTION_SEEDS[worldSlug] ?? [];
  if (seeds.length === 0) return [];
  const inserted = await db.insert(factions).values(
    seeds.map((s) => ({ ...s, worldSlug }))
  ).returning();
  return inserted;
}

router.get("/factions/:worldSlug", isAuthenticated, async (req: any, res) => {
  try {
    const { worldSlug } = req.params;
    const rows = await ensureFactionsSeed(worldSlug);
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to fetch factions" });
  }
});

router.get("/factions/character/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ message: "Character not found" });

    const [membership] = await db.select({
      id: characterFaction.id,
      characterId: characterFaction.characterId,
      factionId: characterFaction.factionId,
      reputation: characterFaction.reputation,
      joinedAt: characterFaction.joinedAt,
      factionName: factions.name,
      factionIcon: factions.icon,
      factionColor: factions.color,
      factionAlignment: factions.alignment,
      factionBonusStats: factions.bonusStats,
      factionDescription: factions.description,
    })
      .from(characterFaction)
      .leftJoin(factions, eq(characterFaction.factionId, factions.id))
      .where(eq(characterFaction.characterId, characterId));

    res.json(membership ?? null);
  } catch {
    res.status(500).json({ message: "Failed to fetch character faction" });
  }
});

const joinSchema = z.object({ factionId: z.string().uuid() });

router.post("/factions/character/:characterId/join", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "factionId is required" });
    const { factionId } = parsed.data;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ message: "Character not found" });

    const [faction] = await db.select().from(factions).where(eq(factions.id, factionId));
    if (!faction) return res.status(404).json({ message: "Faction not found" });

    const [existing] = await db.select().from(characterFaction)
      .where(eq(characterFaction.characterId, characterId));
    if (existing) return res.status(400).json({ message: "Ngươi đã gia nhập một phe phái rồi. Hãy rời bỏ trước." });

    const [membership] = await db.insert(characterFaction)
      .values({ characterId, factionId, reputation: 100 })
      .returning();

    res.json({ membership, faction });
  } catch {
    res.status(500).json({ message: "Failed to join faction" });
  }
});

router.post("/factions/character/:characterId/leave", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ message: "Character not found" });

    const [existing] = await db.select().from(characterFaction)
      .where(eq(characterFaction.characterId, characterId));
    if (!existing) return res.status(400).json({ message: "Ngươi chưa gia nhập phe phái nào" });

    await db.delete(characterFaction).where(eq(characterFaction.characterId, characterId));

    res.json({ message: "Đã rời phe phái" });
  } catch {
    res.status(500).json({ message: "Failed to leave faction" });
  }
});

router.post("/factions/character/:characterId/reputation", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;
    const amount = Math.max(1, Math.min(500, Number(req.body.amount) || 50));

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(404).json({ message: "Character not found" });

    const [existing] = await db.select().from(characterFaction)
      .where(eq(characterFaction.characterId, characterId));
    if (!existing) return res.status(400).json({ message: "Chưa gia nhập phe phái nào" });

    const newRep = existing.reputation + amount;
    await db.update(characterFaction)
      .set({ reputation: newRep })
      .where(eq(characterFaction.characterId, characterId));

    res.json({ reputation: newRep, gained: amount });
  } catch {
    res.status(500).json({ message: "Failed to update reputation" });
  }
});

export default router;
