import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldThemes } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function geminiJSON<T>(prompt: string, fallback: T): Promise<T> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(prompt + "\n\nChỉ trả về JSON thuần, không có markdown, không có backtick.");
    const text = result.response.text().trim().replace(/^```json\n?/, "").replace(/```$/, "").trim();
    return JSON.parse(text);
  } catch { return fallback; }
}

async function geminiText(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch { return ""; }
}

/* ─── 15 Preset themes ─── */
const PRESETS = [
  { id: "steampunk",     name: "Steampunk",           style: "steampunk",     icon: "⚙️",  desc: "Hơi nước, bánh răng, airship, thám tử tư" },
  { id: "space_opera",   name: "Space Opera",         style: "space_opera",   icon: "🚀",  desc: "Liên minh hành tinh, chiến hạm vũ trụ, ngoại tinh cầu" },
  { id: "medieval",      name: "Medieval Fantasy",    style: "medieval",      icon: "🏰",  desc: "Hiệp sĩ, phép thuật, rồng, vương quốc phong kiến" },
  { id: "underwater",    name: "Underwater Realm",    style: "underwater",    icon: "🌊",  desc: "Văn minh dưới đại dương, sinh vật biển, atlantis" },
  { id: "post_apocalypse", name: "Post-Apocalypse",  style: "post_apocalypse", icon: "☢️", desc: "Tàn thế giới, sinh vật đột biến, băng đảng tranh giành" },
  { id: "wuxia",         name: "Wuxia",               style: "wuxia",         icon: "⚔️",  desc: "Giang hồ, kiếm khách, nội công, bang phái võ lâm" },
  { id: "viking",        name: "Viking Age",          style: "viking",        icon: "🪓",  desc: "Chiến binh bắc âu, longship, Valhalla, rune magic" },
  { id: "ancient_egypt", name: "Ancient Egypt",       style: "ancient_egypt", icon: "🏺",  desc: "Pharaoh, kim tự tháp, thần linh Ai Cập, papyrus magic" },
  { id: "feudal_japan",  name: "Feudal Japan",        style: "feudal_japan",  icon: "🏯",  desc: "Samurai, ninja, shogun, yokai, onmyoji" },
  { id: "wild_west",     name: "Wild West",           style: "wild_west",     icon: "🤠",  desc: "Cao bồi, bounty hunter, mỏ vàng, thị trấn biên giới" },
  { id: "dinosaur_era",  name: "Dinosaur Era",        style: "dinosaur_era",  icon: "🦕",  desc: "Kỷ Jura, cưỡi khủng long, bộ lạc nguyên thủy" },
  { id: "demon_realm",   name: "Demon Realm",         style: "demon_realm",   icon: "😈",  desc: "Địa ngục, ma quỷ, hợp đồng linh hồn, tháp địa ngục" },
  { id: "celestial",     name: "Celestial Heaven",    style: "celestial",     icon: "✨",  desc: "Tiên giới, cửu trọng thiên, thần tiên, đạo pháp" },
  { id: "ant_colony",    name: "Ant Colony",          style: "ant_colony",    icon: "🐜",  desc: "Văn minh kiến khổng lồ, pheromone magic, chiến tranh tổ" },
  { id: "biopunk",       name: "Biopunk",             style: "biopunk",       icon: "🧬",  desc: "Sinh học cải biến, DNA hacking, cơ thể tiến hóa nhân tạo" },
];

const PRESET_MAP = new Map(PRESETS.map(p => [p.id, p]));

/* ─── Generator helpers ─── */
async function generateThemeFramework(themeInput: string, presetId?: string) {
  const presetData = presetId ? PRESET_MAP.get(presetId) : null;
  const themeName = presetData?.name ?? themeInput;
  const themeStyle = presetData?.style ?? "custom";

  // Chạy parallel 4 prompt cùng lúc
  const [geography, economyAndCurrency, militaryAndEnemies, cultureAndNPCs] = await Promise.all([
    geminiJSON<any>(
      `Tạo thông tin địa lý cho thế giới chủ đề "${themeName}". Trả về JSON:
      {"regions": ["tên vùng 1", "tên vùng 2", "tên vùng 3"], "capital": "tên thủ đô", "landmark": "địa danh nổi tiếng", "climate": "khí hậu đặc trưng", "terrain": "địa hình đặc trưng"}`,
      { regions: ["Vùng Trung Tâm", "Vùng Biên Giới", "Vùng Hoang Dã"], capital: "Thủ Đô", landmark: "Tháp Thiêng", climate: "Ôn Đới", terrain: "Bình Nguyên" }
    ),
    geminiJSON<any>(
      `Tạo hệ thống kinh tế và tiền tệ cho thế giới chủ đề "${themeName}". Trả về JSON:
      {"currencyName": "tên tiền tệ phù hợp lore", "currencySymbol": "ký hiệu 1-3 ký tự", "mainResource": "tài nguyên chính", "tradingStyle": "phong cách thương mại", "economyType": "loại kinh tế", "wealthGap": "chênh lệch giàu nghèo"}`,
      { currencyName: "Vàng", currencySymbol: "⬡", mainResource: "Khoáng Sản", tradingStyle: "Thương Mại Tự Do", economyType: "Phong Kiến", wealthGap: "Cao" }
    ),
    geminiJSON<any>(
      `Tạo hệ thống quân sự và các loại kẻ thù cho thế giới chủ đề "${themeName}". Trả về JSON:
      {"armyName": "tên quân đội", "weaponStyle": "phong cách vũ khí", "enemyTypes": ["tên kẻ thù 1", "tên kẻ thù 2", "tên kẻ thù 3", "tên kẻ thù 4", "tên kẻ thù 5"], "bossEnemy": "tên boss cuối", "militaryStrength": "mức độ quân sự"}`,
      { armyName: "Quân Đoàn Hoàng Gia", weaponStyle: "Kiếm Thương", enemyTypes: ["Lính Canh", "Tên Lính", "Chiến Binh", "Đội Trưởng", "Tướng Giặc"], bossEnemy: "Đại Ác Nhân", militaryStrength: "Hùng Mạnh" }
    ),
    geminiJSON<any>(
      `Tạo văn hóa và danh hiệu NPC cho thế giới chủ đề "${themeName}". Trả về JSON:
      {"socialSystem": "hệ thống xã hội", "religion": "tôn giáo/tín ngưỡng", "npcTitles": ["danh hiệu NPC 1", "danh hiệu NPC 2", "danh hiệu NPC 3", "danh hiệu NPC 4", "danh hiệu NPC 5"], "greeting": "lời chào đặc trưng", "taboo": "điều cấm kỵ"}`,
      { socialSystem: "Phân Cấp", religion: "Thần Giáo", npcTitles: ["Thương Nhân", "Chiến Binh", "Pháp Sư", "Thầy Thuốc", "Thám Tử"], greeting: "Xin Chào", taboo: "Không Có" }
    ),
  ]);

  // Items và Quests sau khi có dữ liệu cơ bản
  const [uniqueItems, uniqueQuests, history] = await Promise.all([
    geminiJSON<any[]>(
      `Tạo 6 vật phẩm đặc trưng cho thế giới chủ đề "${themeName}" với tiền tệ "${economyAndCurrency.currencyName}". Trả về JSON array:
      [{"name": "tên vật phẩm", "icon": "emoji", "rarity": "common|uncommon|rare|epic|legendary", "description": "mô tả ngắn", "price": số}]`,
      [
        { name: "Vũ Khí Cơ Bản", icon: "⚔️", rarity: "common", description: "Vũ khí tiêu chuẩn", price: 100 },
        { name: "Giáp Chiến", icon: "🛡️", rarity: "uncommon", description: "Giáp bảo vệ tốt", price: 250 },
      ]
    ),
    geminiJSON<any[]>(
      `Tạo 5 nhiệm vụ đặc trưng cho thế giới chủ đề "${themeName}". Trả về JSON array:
      [{"title": "tên quest", "description": "mô tả quest 1-2 câu theo lore thế giới", "type": "combat|exploration|social|crafting", "expReward": số, "goldReward": số}]`,
      [
        { title: "Nhiệm Vụ Đầu Tiên", description: "Khám phá vùng đất mới.", type: "exploration", expReward: 100, goldReward: 50 },
      ]
    ),
    geminiText(
      `Viết 3-4 câu lịch sử ngắn gọn, hấp dẫn cho thế giới chủ đề "${themeName}". Phù hợp lore. Không quá 100 từ.`
    ),
  ]);

  return {
    themeName,
    themeStyle,
    geography,
    history: history || `${themeName} — một thế giới với lịch sử hào hùng và bí ẩn chưa được khám phá.`,
    economy: { ...economyAndCurrency },
    military: { armyName: militaryAndEnemies.armyName, weaponStyle: militaryAndEnemies.weaponStyle, bossEnemy: militaryAndEnemies.bossEnemy, militaryStrength: militaryAndEnemies.militaryStrength },
    culture: { socialSystem: cultureAndNPCs.socialSystem, religion: cultureAndNPCs.religion, greeting: cultureAndNPCs.greeting, taboo: cultureAndNPCs.taboo },
    uniqueItems: uniqueItems.slice(0, 6),
    uniqueQuests: uniqueQuests.slice(0, 5),
    currencyName: economyAndCurrency.currencyName || "Vàng",
    currencySymbol: economyAndCurrency.currencySymbol || "⬡",
    npcTitles: cultureAndNPCs.npcTitles || [],
    enemyTypes: militaryAndEnemies.enemyTypes || [],
  };
}

/* ─────────────────────────────────────────────────────
   GET /api/world-theme/presets — 15 preset có sẵn
───────────────────────────────────────────────────── */
router.get("/world-theme/presets", isAuthenticated, async (_req, res) => {
  res.json(PRESETS);
});

/* ─────────────────────────────────────────────────────
   GET /api/world-theme/:worldSlug — theme hiện tại của thế giới
───────────────────────────────────────────────────── */
router.get("/world-theme/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;
    const [theme] = await db.select().from(worldThemes).where(eq(worldThemes.worldSlug, worldSlug));
    res.json(theme ?? null);
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/world-theme/generate — AI sinh full framework
───────────────────────────────────────────────────── */
router.post("/world-theme/generate", isAuthenticated, async (req, res) => {
  try {
    const { themeInput, presetId } = z.object({
      themeInput: z.string().min(1),
      presetId:   z.string().optional(),
    }).parse(req.body);

    const framework = await generateThemeFramework(themeInput, presetId);
    res.json({ framework, isPreset: !!presetId });
  } catch (err) { res.status(500).json({ message: "Lỗi server khi sinh theme" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/world-theme/apply/:worldSlug — áp dụng theme vào thế giới
───────────────────────────────────────────────────── */
router.post("/world-theme/apply/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params as Record<string, string>;
    const { themeInput, presetId, framework: providedFramework } = z.object({
      themeInput:        z.string().min(1),
      presetId:          z.string().optional(),
      framework:         z.any().optional(),
    }).parse(req.body);

    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${worldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(worldSlug);
    if (!ownerCheck.rows.length && !builtinOwned) {
      return res.status(403).json({ message: "Bạn không sở hữu thế giới này" });
    }

    const framework = providedFramework ?? await generateThemeFramework(themeInput, presetId);

    const existing = await db.select().from(worldThemes).where(eq(worldThemes.worldSlug, worldSlug));
    let theme;
    if (existing.length) {
      [theme] = await db.update(worldThemes).set({
        themeInput, themeName: framework.themeName, themeStyle: framework.themeStyle,
        geography: framework.geography, history: framework.history,
        economy: framework.economy, military: framework.military,
        culture: framework.culture, uniqueItems: framework.uniqueItems,
        uniqueQuests: framework.uniqueQuests, currencyName: framework.currencyName,
        currencySymbol: framework.currencySymbol, npcTitles: framework.npcTitles,
        enemyTypes: framework.enemyTypes, generatedAt: new Date(),
      }).where(eq(worldThemes.worldSlug, worldSlug)).returning();
    } else {
      [theme] = await db.insert(worldThemes).values({
        worldSlug, themeInput, ...framework,
      }).returning();
    }

    res.json({ theme, message: "Theme đã được áp dụng!" });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
