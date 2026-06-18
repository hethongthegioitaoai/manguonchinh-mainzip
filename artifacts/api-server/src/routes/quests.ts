import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { quests, characters } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const QUEST_TEMPLATES: Record<string, Array<{ title: string; description: string; expReward: number; questType: string }>> = {
  cultivation: [
    { title: "Nhặt Linh Thảo", description: "Thu thập 10 cây linh thảo trong Rừng Thiên Mộc. Linh khí nơi đây rất nồng, cẩn thận với yêu thú tuần tra.", expReward: 50, questType: "daily" },
    { title: "Đánh Bại Yêu Thú", description: "Tiêu diệt con Thạch Hổ Yêu đang quấy phá con đường lên núi. Người tu luyện đã đứng ra tuyển mộ ai có thể đảm nhiệm.", expReward: 80, questType: "combat" },
    { title: "Học Kỹ Thuật Mới", description: "Tìm đến Lão Tiên ở Đỉnh Vân Sương để thỉnh giáo một chiêu thức mới. Đem theo lễ vật là 3 viên Ngưng Khí Đan.", expReward: 60, questType: "wisdom" },
    { title: "Thám Hiểm Hang Cổ", description: "Khám phá Huyền Âm Cổ Động ở phía Bắc núi. Tương truyền trong đó có di vật của tiền bối Đại Năng.", expReward: 90, questType: "explore" },
    { title: "Bảo Vệ Làng Thôn", description: "Một nhóm tà tu đang quấy phá ngôi làng dưới chân núi. Hãy đến bảo vệ và trấn áp chúng.", expReward: 70, questType: "combat" },
  ],
  cyberpunk: [
    { title: "Hack Hệ Thống Camera", description: "Xâm nhập mạng lưới camera của Tập Đoàn Arasaka ở Khu C-7. Lấy dữ liệu tuần tra để tránh phát hiện.", expReward: 50, questType: "daily" },
    { title: "Giao Hàng Đặc Biệt", description: "Vận chuyển một kiện hàng bí ẩn từ Dock 9 đến tay Fixer tên Rio ở Underpass Market. Đừng hỏi gì về nội dung.", expReward: 40, questType: "daily" },
    { title: "Tìm Cấy Ghép Mới", description: "Liên hệ với Ripperdoc ngầm ở Lower District để cài đặt bộ tăng cường phản xạ. Cần đủ Credits và dữ liệu đổi chác.", expReward: 70, questType: "explore" },
    { title: "Triệt Phá Ổ Phiến Quân", description: "Một nhóm Maelstrom đang chiếm đóng tòa nhà bỏ hoang Khu D-12. Tập đoàn trả thưởng cao cho ai thanh lý chúng.", expReward: 90, questType: "combat" },
    { title: "Đánh Cắp Dữ Liệu", description: "Cần lấy file Prototype-X từ máy chủ Militech ở tầng 47. Bảo mật cấp 6 — cần kỹ năng Netrunner đỉnh.", expReward: 80, questType: "wisdom" },
  ],
  zombie: [
    { title: "Thu Thập Nước Sạch", description: "Khu định cư đang thiếu nước. Đến cơ sở lọc nước bỏ hoang ở phía Đông để sửa chữa và vận chuyển về.", expReward: 45, questType: "daily" },
    { title: "Tuần Tra Vành Đai", description: "Tuần tra vòng ngoài hàng rào định cư trước khi trời tối. Báo cáo nếu phát hiện dấu hiệu xác sống di chuyển theo đàn.", expReward: 60, questType: "daily" },
    { title: "Đổi Chác Với Thương Nhân", description: "Đoàn thương nhân lưu động sẽ dừng ở Ngã Tư Bắc vào sáng mai. Đổi vật tư thu thập được lấy đạn dược và thuốc men.", expReward: 35, questType: "explore" },
    { title: "Cứu Người Sống Sót", description: "Tín hiệu cứu cứu phát từ Siêu Thị Abandoned trên đường Route 9. Có người còn sống kẹt trong đó — nhanh lên.", expReward: 80, questType: "combat" },
    { title: "Khám Phá Kho Vũ Khí", description: "Bản đồ cũ chỉ đến một kho quân sự bỏ hoang ở hầm ngầm phía Nam. Có thể còn nhiều tài nguyên chưa ai lấy.", expReward: 75, questType: "explore" },
  ],
};

const CULTIVATION_ENERGY_PER_QUEST = 15;

router.get("/quests/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const [char] = await db.select().from(characters).where(
      and(eq(characters.id, characterId), eq(characters.userId, userId))
    );
    if (!char) return res.status(404).json({ message: "Character not found" });

    const charQuests = await db.select().from(quests).where(eq(quests.characterId, characterId));
    res.json(charQuests);
  } catch {
    res.status(500).json({ message: "Failed to fetch quests" });
  }
});

router.post("/quests/generate/:characterId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;

    const [char] = await db.select().from(characters).where(
      and(eq(characters.id, characterId), eq(characters.userId, userId))
    );
    if (!char) return res.status(404).json({ message: "Character not found" });

    const worldSlug = (char.stats as any)?.world_slug ?? "cultivation";
    const templates = QUEST_TEMPLATES[worldSlug] ?? QUEST_TEMPLATES["cultivation"];

    const activeQuests = await db.select().from(quests).where(
      and(eq(quests.characterId, characterId), eq(quests.status, "active"))
    );

    if (activeQuests.length >= 3) {
      return res.json(activeQuests);
    }

    const existingTitles = new Set(activeQuests.map(q => q.title));
    const available = templates.filter(t => !existingTitles.has(t.title));
    const toCreate = available.slice(0, 3 - activeQuests.length);

    if (toCreate.length === 0) return res.json(activeQuests);

    const newQuests = await db.insert(quests).values(
      toCreate.map(t => ({
        characterId,
        worldSlug,
        title: t.title,
        description: t.description,
        expReward: t.expReward,
        questType: t.questType,
        status: "active",
      }))
    ).returning();

    res.json([...activeQuests, ...newQuests]);
  } catch {
    res.status(500).json({ message: "Failed to generate quests" });
  }
});

router.post("/quests/:questId/complete", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { questId } = req.params;

    const [quest] = await db.select().from(quests).where(eq(quests.id, questId));
    if (!quest) return res.status(404).json({ message: "Quest not found" });
    if (quest.status !== "active") return res.status(400).json({ message: "Quest already completed" });

    const [char] = await db.select().from(characters).where(
      and(eq(characters.id, quest.characterId), eq(characters.userId, userId))
    );
    if (!char) return res.status(403).json({ message: "Forbidden" });

    const newExp = char.exp + quest.expReward;
    const expPerLevel = 100;
    const newLevel = Math.floor(newExp / expPerLevel) + 1;

    const currentStats = (char.stats as any) ?? {};
    const currentEnergy = typeof currentStats.cultivationEnergy === "number" ? currentStats.cultivationEnergy : 100;
    const updatedStats = { ...currentStats, cultivationEnergy: currentEnergy + CULTIVATION_ENERGY_PER_QUEST };

    await db.update(quests).set({ status: "completed", completedAt: new Date() }).where(eq(quests.id, questId));
    const [updatedChar] = await db.update(characters)
      .set({ exp: newExp, level: newLevel, stats: updatedStats })
      .where(eq(characters.id, char.id))
      .returning();

    res.json({
      quest: { ...quest, status: "completed" },
      character: updatedChar,
      expGained: quest.expReward,
      leveledUp: newLevel > char.level,
      cultivationEnergyGained: CULTIVATION_ENERGY_PER_QUEST,
    });
  } catch {
    res.status(500).json({ message: "Failed to complete quest" });
  }
});

router.post("/characters/:characterId/exp", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.params;
    const { amount } = req.body;

    if (typeof amount !== "number" || amount < 0) return res.status(400).json({ message: "Invalid amount" });

    const [char] = await db.select().from(characters).where(
      and(eq(characters.id, characterId), eq(characters.userId, userId))
    );
    if (!char) return res.status(404).json({ message: "Character not found" });

    const newExp = char.exp + amount;
    const expPerLevel = 100;
    const newLevel = Math.floor(newExp / expPerLevel) + 1;

    const [updated] = await db.update(characters).set({ exp: newExp, level: newLevel }).where(eq(characters.id, characterId)).returning();
    res.json({ character: updated, leveledUp: newLevel > char.level });
  } catch {
    res.status(500).json({ message: "Failed to update exp" });
  }
});

export default router;
