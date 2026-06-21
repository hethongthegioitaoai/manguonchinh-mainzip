import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { customWorlds } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const router = Router();

/* GET /api/worlds — public list of all worlds */
router.get("/worlds", async (_req, res) => {
  try {
    const worlds = await db
      .select({
        slug:  customWorlds.slug,
        name:  customWorlds.name,
        genre: customWorlds.genre,
      })
      .from(customWorlds)
      .orderBy(desc(customWorlds.createdAt));
    res.json(worlds);
  } catch (err) {
    console.error("[worlds] list error:", err);
    res.status(500).json({ error: "Failed to fetch worlds" });
  }
});

const genAI = new GoogleGenAI({ apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY, httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL } });

const GENRES = ["tu_tien", "cyberpunk", "fantasy", "horror", "scifi", "wasteland", "steampunk", "xianxia"] as const;
type Genre = typeof GENRES[number];

const GENRE_LABELS: Record<Genre, string> = {
  tu_tien: "Tu Tiên", cyberpunk: "Cyberpunk", fantasy: "Fantasy",
  horror: "Kinh Dị", scifi: "Khoa Học Viễn Tưởng", wasteland: "Hoang Phế",
  steampunk: "Steampunk", xianxia: "Tiên Hiệp",
};

const createSchema = z.object({
  name: z.string().min(2).max(48),
  genre: z.enum(GENRES),
  rules: z.string().max(500).default(""),
  description: z.string().max(500).default(""),
});

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 32)
    + "-" + Math.random().toString(36).slice(2, 6);
}

async function generateWorldContent(name: string, genre: Genre, rules: string, description: string) {
  const genreLabel = GENRE_LABELS[genre];
  const prompt = `Tạo nội dung hoàn chỉnh cho một thế giới game nhập vai:
Tên: "${name}"
Thể loại: ${genreLabel}
Mô tả từ người tạo: "${description || "Không có"}"
Luật lệ đặc biệt: "${rules || "Không có"}"

Trả về JSON (không markdown):
{
  "lore": "<lịch sử thế giới — 3-4 câu, sống động, bí ẩn, epic>",
  "bosses": [
    { "name": "<tên boss>", "level": <số từ 50-100>, "description": "<mô tả ngắn>" },
    { "name": "<tên boss>", "level": <số từ 80-120>, "description": "<mô tả ngắn>" }
  ],
  "factions": [
    { "name": "<tên phe>", "type": "<light|dark|neutral>", "description": "<mô tả 1 câu>" },
    { "name": "<tên phe>", "type": "<light|dark|neutral>", "description": "<mô tả 1 câu>" },
    { "name": "<tên phe>", "type": "<light|dark|neutral>", "description": "<mô tả 1 câu>" }
  ],
  "npcs": [
    { "name": "<tên NPC>", "role": "<merchant|guardian|sage|warlord|assassin>", "personality": "<1 câu>", "goals": ["<mục tiêu 1>", "<mục tiêu 2>"] },
    { "name": "<tên NPC>", "role": "<merchant|guardian|sage|warlord|assassin>", "personality": "<1 câu>", "goals": ["<mục tiêu 1>"] }
  ],
  "atmosphereColor": "<hex color phù hợp với thể loại>",
  "tagline": "<khẩu hiệu thế giới — tối đa 10 từ, ấn tượng>"
}`;

  const model = { generateContent: async (p: any) => { const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: typeof p === "string" ? p : p }); return { response: { text: () => r.text ?? "" } }; } };
  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim().replace(/^```json?\s*/i, "").replace(/```$/i, "");
  return JSON.parse(raw);
}

router.get("/custom-worlds", isAuthenticated, async (req: any, res) => {
  try {
    const list = await db.select().from(customWorlds).where(eq(customWorlds.isPublic, true)).orderBy(desc(customWorlds.createdAt)).limit(20);
    res.json({ worlds: list, genreLabels: GENRE_LABELS });
  } catch {
    res.status(500).json({ message: "Failed to fetch custom worlds" });
  }
});

router.get("/custom-worlds/:id", isAuthenticated, async (req: any, res) => {
  try {
    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.id, req.params.id));
    if (!world) return res.status(404).json({ message: "World not found" });
    res.json(world);
  } catch {
    res.status(500).json({ message: "Failed to fetch world" });
  }
});

router.post("/custom-worlds/create", isAuthenticated, async (req: any, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid world data" });
    const { name, genre, rules, description } = parsed.data;
    const userId = (req as any).userId;

    const content = await generateWorldContent(name, genre, rules, description);

    const slug = slugify(name);
    const [world] = await db.insert(customWorlds).values({
      slug, name, genre, rules, description,
      lore: content.lore ?? "",
      bossData: content.bosses ?? [],
      factionData: content.factions ?? [],
      npcData: content.npcs ?? [],
      createdBy: userId,
      isPublic: true,
    }).returning();

    res.json({ world, tagline: content.tagline, atmosphereColor: content.atmosphereColor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate world" });
  }
});

const AI_WORLD_THEMES = [
  { genre: "tu_tien" as Genre, seed: "một bí ảnh cổ xưa nơi linh khí tụ tập, chứa đựng bí mật về cảnh giới tối thượng" },
  { genre: "cyberpunk" as Genre, seed: "một megacity bị AI kiểm soát, con người đấu tranh giành lại tự do" },
  { genre: "xianxia" as Genre, seed: "thiên giới sụp đổ, tu tiên lạc vào hư không giữa các cõi" },
  { genre: "horror" as Genre, seed: "vùng đất bị lời nguyền cổ đại phong ấn, quỷ thức tỉnh mỗi đêm" },
  { genre: "wasteland" as Genre, seed: "sa mạc phóng xạ sau thế chiến thứ tư, nơi mutant và máy móc cùng tranh tồn tại" },
  { genre: "scifi" as Genre, seed: "hành tinh thuộc địa bị cắt liên lạc với Trái Đất, AI thủ hộ dần thức tỉnh" },
  { genre: "fantasy" as Genre, seed: "vương quốc cổ đại bị chia cắt bởi vết nứt không gian, ma thuật đang phai tàn" },
  { genre: "steampunk" as Genre, seed: "đế chế hơi nước kiểm soát bầu trời, tổ chức bí mật tìm cách lật đổ" },
];

async function generateAIWorld() {
  const theme = AI_WORLD_THEMES[Math.floor(Math.random() * AI_WORLD_THEMES.length)];
  const genreLabel = GENRE_LABELS[theme.genre];

  const prompt = `Tạo một thế giới game nhập vai độc đáo và ấn tượng với chủ đề: "${theme.seed}" (thể loại: ${genreLabel}).

Sáng tạo hoàn toàn — đặt tên riêng, không dùng tên thế giới có sẵn.

Trả về JSON (không markdown):
{
  "name": "<tên thế giới độc đáo, 2-4 chữ, ấn tượng>",
  "lore": "<lịch sử thế giới — 3-4 câu, sống động, bí ẩn, đầy drama>",
  "rules": "<1-2 luật lệ đặc biệt tạo nên bản sắc thế giới này>",
  "bosses": [
    { "name": "<tên boss phù hợp thể loại>", "level": <50-100>, "description": "<mô tả ngắn ấn tượng>" },
    { "name": "<tên boss mạnh hơn>", "level": <80-130>, "description": "<mô tả ngắn>" },
    { "name": "<boss cuối — boss cực mạnh>", "level": <120-200>, "description": "<mô tả boss cuối>" }
  ],
  "factions": [
    { "name": "<tên phe ánh sáng>", "type": "light", "description": "<mô tả>" },
    { "name": "<tên phe bóng tối>", "type": "dark", "description": "<mô tả>" },
    { "name": "<tên phe trung lập — bí ẩn nhất>", "type": "neutral", "description": "<mô tả>" }
  ],
  "npcs": [
    { "name": "<tên NPC>", "role": "sage", "personality": "<1 câu>", "goals": ["<mục tiêu>"] },
    { "name": "<tên NPC>", "role": "warlord", "personality": "<1 câu>", "goals": ["<mục tiêu>"] },
    { "name": "<tên NPC>", "role": "merchant", "personality": "<1 câu>", "goals": ["<mục tiêu>"] }
  ],
  "atmosphereColor": "<hex color phù hợp với thể loại và cảm xúc>",
  "tagline": "<khẩu hiệu epic — tối đa 8 từ>"
}`;

  const model = { generateContent: async (p: any) => { const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: typeof p === "string" ? p : p }); return { response: { text: () => r.text ?? "" } }; } };
  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim().replace(/^```json?\s*/i, "").replace(/```$/i, "");
  const content = JSON.parse(raw);
  return { content, genre: theme.genre };
}

router.post("/custom-worlds/generate-ai", isAuthenticated, async (req: any, res) => {
  try {
    const { content, genre } = await generateAIWorld();
    const worldName: string = content.name ?? "Thế Giới Bí Ẩn";
    const slug = slugify(worldName);

    const [world] = await db.insert(customWorlds).values({
      slug, name: worldName, genre, rules: content.rules ?? "", description: "Được tạo bởi AI",
      lore: content.lore ?? "",
      bossData: content.bosses ?? [],
      factionData: content.factions ?? [],
      npcData: content.npcs ?? [],
      createdBy: null,
      isPublic: true,
    }).returning();

    res.json({ world, tagline: content.tagline, atmosphereColor: content.atmosphereColor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate AI world" });
  }
});

router.delete("/custom-worlds/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req as any).userId;
    const [world] = await db.select().from(customWorlds).where(eq(customWorlds.id, req.params.id));
    if (!world) return res.status(404).json({ message: "World not found" });
    if (world.createdBy !== userId) return res.status(403).json({ message: "Không có quyền xóa thế giới này" });
    await db.delete(customWorlds).where(eq(customWorlds.id, req.params.id));
    res.json({ message: "Đã xóa thế giới" });
  } catch {
    res.status(500).json({ message: "Failed to delete world" });
  }
});

export default router;
export { GENRE_LABELS };
