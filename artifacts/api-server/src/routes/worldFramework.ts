import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { customWorlds, worldFrameworks, worldLoreEntries } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 32)
    + "-" + Math.random().toString(36).slice(2, 6);
}

async function generateFreeFramework(name: string, theme: string) {
  const prompt = `Bạn là AI kiến trúc sư thế giới ảo. Người dùng muốn tạo thế giới game nhập vai với:
Tên thế giới: "${name}"
Mô tả/Ý tưởng: "${theme}"

Hãy xây dựng framework hoàn chỉnh cho thế giới này — mọi thứ phải NHẤT QUÁN với chủ đề và mô tả. Đừng dùng template cũ — sáng tạo hoàn toàn dựa trên ý tưởng người dùng.

Trả về JSON thuần (không markdown, không code block):
{
  "progressionSystem": {
    "name": "<tên hệ thống tiến hóa, ví dụ: Cảnh Giới Tu Luyện, Cấp Độ Chiến Sĩ, Hạng Máy Móc>",
    "tiers": ["<cấp 1 thấp nhất>", "<cấp 2>", "<cấp 3>", "<cấp 4>", "<cấp 5>", "<cấp 6 đỉnh cao>"],
    "description": "<mô tả hệ thống tiến hóa, 1-2 câu>"
  },
  "currency": {
    "primary": "<tên tiền tệ chính, ví dụ: Linh Thạch, Tín Chỉ Năng Lượng, Vàng Huyết>",
    "secondary": "<tên tiền tệ phụ hoặc quý hiếm hơn>",
    "description": "<1 câu về kinh tế thế giới>"
  },
  "socialClasses": [
    { "name": "<tầng lớp thấp nhất>", "description": "<1 câu>" },
    { "name": "<tầng lớp trung>", "description": "<1 câu>" },
    { "name": "<tầng lớp cao>", "description": "<1 câu>" },
    { "name": "<tầng lớp thống trị>", "description": "<1 câu>" }
  ],
  "geography": [
    { "name": "<tên vùng đất 1>", "type": "<loại địa hình>", "description": "<1 câu đặc trưng>" },
    { "name": "<tên vùng đất 2>", "type": "<loại địa hình>", "description": "<1 câu>" },
    { "name": "<tên vùng đất 3 — nguy hiểm nhất>", "type": "<loại địa hình>", "description": "<1 câu>" }
  ],
  "terminology": {
    "hero": "<cách gọi người hùng/nhân vật chính trong thế giới này>",
    "enemy": "<cách gọi kẻ thù>",
    "power": "<cách gọi sức mạnh/năng lực>",
    "quest": "<cách gọi nhiệm vụ>",
    "guild": "<cách gọi tổ chức/bang hội>"
  },
  "loreRules": "<3-4 luật lệ/quy tắc cơ bản của thế giới, ví dụ: Ở đây không có thần linh, chỉ có công nghệ. Sức mạnh được đo bằng chip cấy vào não. Chết ở đây nghĩa là mất vĩnh viễn...>",
  "lore": "<lịch sử thế giới — 4-5 câu, sống động, epic, bí ẩn. Kể về nguồn gốc, đại sự kiện đã xảy ra, trạng thái hiện tại>",
  "bosses": [
    { "name": "<tên boss 1 nhất quán với lore>", "level": <50-80>, "description": "<1 câu ấn tượng>" },
    { "name": "<tên boss 2 mạnh hơn>", "level": <90-120>, "description": "<1 câu>" },
    { "name": "<boss cuối cùng — thực thể tối thượng>", "level": <150-200>, "description": "<1 câu epic>" }
  ],
  "factions": [
    { "name": "<tên phe 1>", "type": "light", "description": "<1 câu>" },
    { "name": "<tên phe 2>", "type": "dark", "description": "<1 câu>" },
    { "name": "<tên phe 3 bí ẩn nhất>", "type": "neutral", "description": "<1 câu>" }
  ],
  "npcs": [
    { "name": "<tên NPC lão sư/sage>", "role": "sage", "personality": "<1 câu>", "goals": ["<mục tiêu>"] },
    { "name": "<tên NPC chiến binh>", "role": "warlord", "personality": "<1 câu>", "goals": ["<mục tiêu>"] },
    { "name": "<tên NPC thương nhân>", "role": "merchant", "personality": "<1 câu>", "goals": ["<mục tiêu>"] }
  ],
  "loreEntries": [
    { "category": "history", "title": "<tiêu đề>, "content": "<nội dung 2-3 câu, lịch sử thế giới>" },
    { "category": "creature", "title": "<tên sinh vật đặc trưng>", "content": "<mô tả sinh vật 2 câu>" },
    { "category": "item", "title": "<tên vật phẩm huyền thoại>", "content": "<mô tả vật phẩm 2 câu>" },
    { "category": "faction", "title": "<tên tổ chức bí mật>", "content": "<lịch sử tổ chức 2 câu>" },
    { "category": "geography", "title": "<tên địa danh nổi tiếng>", "content": "<mô tả địa danh 2 câu>" }
  ],
  "atmosphereColor": "<hex color phù hợp, ví dụ #06b6d4 cho cyber, #a855f7 cho tiên hiệp, #ef4444 cho horr>",
  "tagline": "<khẩu hiệu epic 5-8 từ, nhất quán với chủ đề>"
}`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim().replace(/^```json?\s*/i, "").replace(/```$/i, "");
  return JSON.parse(raw);
}

const createFreeSchema = z.object({
  name: z.string().min(2).max(48),
  theme: z.string().min(10).max(1000),
});

router.post("/world/create-free", isAuthenticated, async (req: any, res) => {
  try {
    const parsed = createFreeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Tên tối thiểu 2 ký tự, mô tả tối thiểu 10 ký tự" });
    const { name, theme } = parsed.data;
    const userId = req.userId as string;

    const content = await generateFreeFramework(name, theme);

    const slug = slugify(name);

    const [world] = await db.insert(customWorlds).values({
      slug,
      name,
      genre: "fantasy",
      rules: content.loreRules ?? "",
      description: theme.slice(0, 500),
      lore: content.lore ?? "",
      bossData: content.bosses ?? [],
      factionData: content.factions ?? [],
      npcData: content.npcs ?? [],
      createdBy: userId,
      isPublic: true,
    }).returning();

    await db.insert(worldFrameworks).values({
      worldSlug: slug,
      theme,
      progressionSystem: content.progressionSystem ?? {},
      currency: content.currency ?? {},
      socialClasses: content.socialClasses ?? [],
      geography: content.geography ?? [],
      terminology: content.terminology ?? {},
      loreRules: content.loreRules ?? "",
      atmosphereColor: content.atmosphereColor ?? "#06b6d4",
      tagline: content.tagline ?? "",
    });

    if (content.loreEntries?.length) {
      await db.insert(worldLoreEntries).values(
        content.loreEntries.map((e: any) => ({
          worldSlug: slug,
          category: e.category ?? "history",
          title: e.title ?? "Untitled",
          content: e.content ?? "",
          aiGenerated: true,
        }))
      );
    }

    res.json({
      world,
      framework: {
        progressionSystem: content.progressionSystem,
        currency: content.currency,
        socialClasses: content.socialClasses,
        geography: content.geography,
        terminology: content.terminology,
        loreRules: content.loreRules,
        atmosphereColor: content.atmosphereColor,
        tagline: content.tagline,
      },
      loreEntries: content.loreEntries ?? [],
    });
  } catch (err) {
    console.error("[world/create-free]", err);
    res.status(500).json({ message: "AI đang bận — thử lại sau ít phút" });
  }
});

router.get("/world/framework/:worldSlug", isAuthenticated, async (req: any, res) => {
  try {
    const { worldSlug } = req.params;
    const [framework] = await db.select().from(worldFrameworks).where(eq(worldFrameworks.worldSlug, worldSlug));
    const loreEntries = await db.select().from(worldLoreEntries)
      .where(eq(worldLoreEntries.worldSlug, worldSlug))
      .orderBy(desc(worldLoreEntries.createdAt));
    res.json({ framework: framework ?? null, loreEntries });
  } catch {
    res.status(500).json({ message: "Lỗi tải framework" });
  }
});

const addLoreSchema = z.object({
  category: z.enum(["history", "faction", "geography", "creature", "item", "law"]),
  title: z.string().min(2).max(128),
  content: z.string().min(5).max(2000),
});

router.post("/world/lore/:worldSlug", isAuthenticated, async (req: any, res) => {
  try {
    const { worldSlug } = req.params;
    const userId = req.userId as string;

    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.slug, worldSlug));
    if (!world) return res.status(404).json({ message: "Thế giới không tồn tại" });
    if (world.createdBy !== userId) return res.status(403).json({ message: "Chỉ creator mới thêm lore được" });

    const parsed = addLoreSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dữ liệu không hợp lệ" });

    const [entry] = await db.insert(worldLoreEntries).values({
      worldSlug,
      ...parsed.data,
      aiGenerated: false,
    }).returning();

    res.json({ entry });
  } catch {
    res.status(500).json({ message: "Lỗi thêm lore" });
  }
});

export default router;
