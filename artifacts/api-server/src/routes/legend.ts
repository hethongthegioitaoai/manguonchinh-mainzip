import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { legends, legendVotes, characters, characterAchievements } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const BUILTIN_WORLDS: Record<string, string> = {
  cultivation: "Tu Tiên Giới",
  cyberpunk: "Thế Giới Cyberpunk",
  wasteland: "Vùng Hoang Phế",
};

async function checkEligibility(char: any, achievementCount: number): Promise<{ eligible: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  if ((char.level ?? 1) >= 50) reasons.push(`Cấp độ ${char.level} (≥50)`);
  if ((char.battleWins ?? 0) >= 1000) reasons.push(`${char.battleWins} chiến thắng (≥1000)`);
  if (achievementCount >= 20) reasons.push(`${achievementCount} thành tựu (≥20)`);
  return { eligible: reasons.length > 0, reasons };
}

async function generateEpicStory(char: any, worldName: string, reasons: string[]): Promise<{ title: string; story: string }> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const reasonStr = reasons.join(", ");
    const prompt = `Viết câu chuyện sử thi (6-8 câu, tiếng Việt) về huyền thoại "${char.name}" - ${char.system ?? "Kiếm Thần"} của thế giới "${worldName}". Thành tựu: ${reasonStr}. Cấp ${char.level}. Phong cách thơ văn lãng mạn-huyền bí. Bắt đầu bằng mô tả khí chất, kết thúc bằng lời truyền đời. Chỉ trả câu chuyện.`;
    const result = await model.generateContent(prompt);
    const story = result.response.text().trim();

    const titleRes = await model.generateContent(
      `Tạo danh hiệu huyền thoại (4-6 từ tiếng Việt, oai hùng) cho nhân vật "${char.name}" cấp ${char.level}. Chỉ trả danh hiệu.`
    );
    const title = titleRes.response.text().trim().slice(0, 100);
    return { title, story };
  } catch {
    return {
      title: `Huyền Thoại ${char.name}`,
      story: `${char.name} — một ${char.system ?? "chiến binh"} lừng danh đã vượt qua vô số thử thách trong ${worldName}. Tên tuổi họ được khắc vào lịch sử, là ánh sáng soi đường cho những thế hệ sau.`,
    };
  }
}

/* ─────────────────────────────────────────────────────
   GET /api/legends — điện truyền thuyết
───────────────────────────────────────────────────── */
router.get("/api/legends", isAuthenticated, async (req, res) => {
  try {
    const list = await db.select().from(legends).orderBy(desc(legends.votes), desc(legends.inducedAt)).limit(50);
    res.json(list);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/legends/check/:characterId — kiểm tra điều kiện
───────────────────────────────────────────────────── */
router.get("/api/legends/check", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const achs = await db.select().from(characterAchievements).where(eq(characterAchievements.characterId, char.id));
    const { eligible, reasons } = await checkEligibility(char, achs.length);

    const alreadyInducted = await db.select().from(legends).where(eq(legends.characterId, char.id));

    res.json({ eligible, reasons, alreadyInducted: alreadyInducted.length > 0, character: { name: char.name, level: char.level, system: (char.stats as any)?.system } });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/legends/induct — tự phong huyền thoại
───────────────────────────────────────────────────── */
router.post("/api/legends/induct", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const alreadyInducted = await db.select().from(legends).where(eq(legends.characterId, char.id));
    if (alreadyInducted.length > 0) return res.status(400).json({ message: "Nhân vật của bạn đã được phong huyền thoại!" });

    const achs = await db.select().from(characterAchievements).where(eq(characterAchievements.characterId, char.id));
    const { eligible, reasons } = await checkEligibility(char, achs.length);
    if (!eligible) return res.status(400).json({
      message: "Chưa đủ điều kiện phong huyền thoại",
      conditions: "Cần: cấp ≥50, HOẶC ≥1000 chiến thắng, HOẶC ≥20 thành tựu",
    });

    const charStats = char.stats as any ?? {};
    const worldSlug = charStats.world_slug ?? "cultivation";
    const worldName = BUILTIN_WORLDS[worldSlug] ?? worldSlug;
    const { title, story } = await generateEpicStory(char, worldName, reasons);

    const [legend] = await db.insert(legends).values({
      characterId: char.id, characterName: char.name, userId,
      worldSlug, worldName, system: charStats.system ?? "Kiếm Thần",
      level: char.level ?? 1, legendTitle: title, epicStory: story,
      achievements: achs.map(a => a.achievementKey),
      stats: { str: charStats.str ?? 1, dex: charStats.dex ?? 1, int: charStats.int ?? 1, vit: charStats.vit ?? 1, lck: charStats.lck ?? 1, cha: charStats.cha ?? 1 },
    }).returning();

    res.json({ legend, message: `${char.name} đã được phong "Huyền Thoại"! Câu chuyện lưu mãi mãi!` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/legends/vote/:legendId — bình chọn anh hùng
───────────────────────────────────────────────────── */
router.post("/api/legends/vote/:legendId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { legendId } = req.params as Record<string, string>;

    const already = await db.select().from(legendVotes).where(and(eq(legendVotes.legendId, legendId), eq(legendVotes.userId, userId)));
    if (already.length > 0) return res.status(400).json({ message: "Bạn đã bình chọn anh hùng này rồi" });

    await db.insert(legendVotes).values({ legendId, userId });
    await db.update(legends).set({ votes: sql`votes + 1` }).where(eq(legends.id, legendId));

    res.json({ message: "Đã tôn vinh anh hùng!" });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/legends/:legendId — chi tiết 1 legend
───────────────────────────────────────────────────── */
router.get("/api/legends/:legendId", isAuthenticated, async (req, res) => {
  try {
    const { legendId } = req.params as Record<string, string>;
    const userId = (req as any).userId;
    const [legend] = await db.select().from(legends).where(eq(legends.id, legendId));
    if (!legend) return res.status(404).json({ message: "Không tìm thấy" });

    await db.update(legends).set({ viewed: (legend.viewed ?? 0) + 1 }).where(eq(legends.id, legendId));
    const voted = await db.select().from(legendVotes).where(and(eq(legendVotes.legendId, legendId), eq(legendVotes.userId, userId)));

    res.json({ legend, hasVoted: voted.length > 0 });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
