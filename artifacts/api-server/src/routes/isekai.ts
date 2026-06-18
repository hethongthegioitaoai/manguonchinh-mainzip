import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { isekaiRecords, characters, customWorlds, worldEvents } from "@workspace/db/schema";
import { eq, and, desc, ne, sql } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const BUILTIN_WORLDS = [
  { slug: "cultivation", name: "Đại Lục Tu Tiên", genre: "tu_tien", lore: "Nơi linh khí tràn lan, kiếm tiên lướt mây, tông môn tranh bá." },
  { slug: "cyberpunk",   name: "Neon Megacity",   genre: "cyberpunk", lore: "Megacorp kiểm soát tất cả. Hacker và samurai sống cùng nhau dưới ánh đèn neon." },
  { slug: "zombie",      name: "Vùng Hoang Phế",  genre: "wasteland", lore: "Nền văn minh sụp đổ. Người sống sót tranh giành từng hộp đồ hộp." },
];

const ISEKAI_CLASSES: Record<string, string[]> = {
  tu_tien:    ["Kiếm Tu Phàm Nhân", "Linh Căn Giác Thức Giả", "Phế Tài Trùng Sinh", "Ngoại Lai Thần Khách"],
  cyberpunk:  ["Lập Trình Viên Lạc Lối", "Đặc Vụ Không Danh", "Kỹ Sư Cơ Thể Sống", "Hacker Dị Giới"],
  fantasy:    ["Dũng Sĩ Triệu Hồi", "Thám Hiểm Gia Lạc Đường", "Pháp Sư Ngoại Lai", "Hiệp Sĩ Không Tên"],
  horror:     ["Kẻ Sống Sót Tình Cờ", "Nhà Điều Tra Siêu Nhiên", "Lính Nghĩa Vụ Xui Xẻo"],
  scifi:      ["Phi Hành Gia Thất Lạc", "Nhà Khoa Học Thực Nghiệm", "Tộc Người Dị Giới"],
  wasteland:  ["Kẻ Lang Thang Sa Mạc", "Thương Nhân Đổi Chác", "Cựu Binh Mất Trí"],
  steampunk:  ["Nhà Phát Minh Tình Cờ", "Thám Tử Máy Hơi Nước", "Quý Tộc Thất Sủng"],
  xianxia:    ["Thiên Tài Chuyển Sinh", "Tiên Nhân Hạ Giới", "Kiếm Linh Thức Tỉnh"],
  default:    ["Người Lạ Từ Nơi Khác", "Kẻ Xuyên Không", "Lữ Khách Dị Giới"],
};

function pickIsekaiClass(genre: string): string {
  const pool = ISEKAI_CLASSES[genre] ?? ISEKAI_CLASSES.default;
  return pool[Math.floor(Math.random() * pool.length)];
}

// GET /api/isekai/my — lịch sử xuyên không của user
router.get("/api/isekai/my", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const records = await db.select().from(isekaiRecords)
      .where(eq(isekaiRecords.userId, userId))
      .orderBy(desc(isekaiRecords.createdAt))
      .limit(20);
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi tải lịch sử" });
  }
});

// GET /api/isekai/record/:id — chi tiết 1 record
router.get("/api/isekai/record/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [record] = await db.select().from(isekaiRecords)
      .where(and(eq(isekaiRecords.id, req.params.id), eq(isekaiRecords.userId, userId)));
    if (!record) return res.status(404).json({ error: "Không tìm thấy" });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: "Lỗi tải record" });
  }
});

// GET /api/isekai/worlds — danh sách thế giới user có nhân vật (nguồn)
router.get("/api/isekai/worlds", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const myChars = await db.select().from(characters).where(eq(characters.userId, userId));
    res.json(myChars);
  } catch (err) {
    res.status(500).json({ error: "Lỗi tải nhân vật" });
  }
});

// POST /api/isekai/enter — kích hoạt cổng xuyên không
router.post("/api/isekai/enter", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { characterId } = req.body;
    if (!characterId) return res.status(400).json({ error: "Thiếu characterId" });

    const [char] = await db.select().from(characters)
      .where(and(eq(characters.id, characterId), eq(characters.userId, userId)));
    if (!char) return res.status(403).json({ error: "Không có quyền" });

    // Lấy danh sách thế giới có thể đến (builtin + custom của người khác)
    const customWorlds_ = await db.select().from(customWorlds)
      .where(eq(customWorlds.isPublic, true)).limit(20);
    const otherCustom = customWorlds_.filter(w => w.createdBy !== userId);

    // Pool: builtin + custom worlds khác
    const allDestinations = [
      ...BUILTIN_WORLDS,
      ...otherCustom.map(w => ({
        slug: w.slug,
        name: w.name,
        genre: w.genre,
        lore: w.lore?.slice(0, 150) ?? "",
      })),
    ];

    // Lọc bỏ thế giới hiện tại của nhân vật
    const charStats = char.stats as any;
    const fromWorldSlug = charStats?.worldSlug ?? "cultivation";
    const destinations = allDestinations.filter(d => d.slug !== fromWorldSlug);

    if (!destinations.length) {
      return res.status(400).json({ error: "Không có thế giới nào để xuyên không tới" });
    }

    // Random chọn thế giới đích
    const target = destinations[Math.floor(Math.random() * destinations.length)];
    const isekaiClass = pickIsekaiClass(target.genre);
    const charName = char.name;
    const fromWorld = BUILTIN_WORLDS.find(w => w.slug === fromWorldSlug)?.name ?? fromWorldSlug;

    // AI sinh narrative xuyên không
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const prompt = `Viết cảnh "xuyên không" kiểu isekai anime cho game nhập vai:
Nhân vật: ${charName} (Lv.${char.level}) từ thế giới "${fromWorld}"
Thế giới đích: "${target.name}" (${target.genre})
Lore đích: ${target.lore}
Danh hiệu mới trong thế giới đích: ${isekaiClass}

Trả về JSON (không markdown):
{
  "isekaiName": "<tên mới của nhân vật trong thế giới đích — phù hợp văn hóa thế giới đó>",
  "openingNarrative": "<cảnh xuyên không — 4-5 câu: khoảnh khắc bị hút vào cổng, cảm giác, lúc tỉnh dậy thấy gì, mọi người xung quanh phản ứng thế nào. Kịch tính, cinematic>",
  "systemGrant": "<System thông báo — 2-3 dòng kiểu 'DING! [HỆ THỐNG]: Xác nhận xuyên không thành công. Thiên phú đặc biệt đã được cấp phát...'. Phù hợp lore thế giới đích>",
  "systemAbility": "<tên 1 khả năng đặc biệt được cấp khi xuyên không — ngắn gọn, phù hợp thế giới đích>",
  "worldReaction": "<1-2 câu: NPC/người dân xung quanh phản ứng ra sao khi thấy người lạ xuất hiện>"
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/```json\n?|\n?```/g, "");
    let aiData: any;
    try { aiData = JSON.parse(raw); } catch {
      aiData = {
        isekaiName: `${charName} Dị Giới`,
        openingNarrative: `${charName} bị ánh sáng trắng nuốt chửng, tỉnh dậy giữa ${target.name}. Mọi thứ xa lạ, không khí khác biệt, nhưng bản năng chiến đấu vẫn còn đó.`,
        systemGrant: "[HỆ THỐNG]: Xuyên không thành công. Thiên phú đặc biệt đã được cấp phát.",
        systemAbility: "Ký Ức Dị Giới",
        worldReaction: "Người dân địa phương nhìn chằm chằm vào kẻ lạ vừa xuất hiện từ hư không.",
      };
    }

    const [record] = await db.insert(isekaiRecords).values({
      userId,
      fromCharacterId: char.id,
      fromWorldSlug,
      toWorldSlug: target.slug,
      isekaiName: (aiData.isekaiName ?? `${charName} Dị Giới`).slice(0, 64),
      isekaiClass,
      openingNarrative: aiData.openingNarrative ?? "",
      systemGrant: aiData.systemGrant ?? "",
      systemAbility: (aiData.systemAbility ?? "Ký Ức Dị Giới").slice(0, 128),
      worldReaction: aiData.worldReaction ?? "",
      metadata: {
        fromCharName: charName,
        fromCharLevel: char.level,
        toWorldName: target.name,
        toWorldGenre: target.genre,
      },
    }).returning();

    // Tạo world event ở thế giới đích (người lạ xuất hiện)
    try {
      await db.insert(worldEvents).values({
        worldSlug: target.slug,
        eventType: "isekai_arrival",
        title: `⚡ Dị Khách Xuyên Không: ${aiData.isekaiName ?? charName}`,
        description: aiData.worldReaction ?? `${charName} từ thế giới khác vừa xuất hiện.`,
        karmaEffect: 5,
        active: true,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      } as any);
    } catch (_) {}

    res.json({ record, targetWorld: target });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi kích hoạt cổng xuyên không" });
  }
});

export default router;
