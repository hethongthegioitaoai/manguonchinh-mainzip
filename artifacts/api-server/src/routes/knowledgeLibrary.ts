import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeEntries, playerResearch } from "@workspace/db/schema";
import { eq, desc, and, ilike, or } from "drizzle-orm";

const router = Router();

const CATEGORIES = [
  { id: "history",  label: "Lịch Sử",      icon: "📜" },
  { id: "skills",   label: "Kỹ Năng Bí Truyền", icon: "⚔️" },
  { id: "items",    label: "Vật Phẩm Huyền Thoại", icon: "💎" },
  { id: "monsters", label: "Yêu Quái",      icon: "👹" },
  { id: "realms",   label: "Cõi Giới",      icon: "🌌" },
];

const RARITIES = [
  { id: "common",    label: "Phổ Thông",  color: "#9ca3af", cost: 0   },
  { id: "uncommon",  label: "Không Phổ",  color: "#22c55e", cost: 50  },
  { id: "rare",      label: "Hiếm",       color: "#06b6d4", cost: 150 },
  { id: "epic",      label: "Sử Thi",     color: "#a855f7", cost: 400 },
  { id: "legendary", label: "Huyền Thoại",color: "#f59e0b", cost: 1000 },
];

/* ── World-specific lore templates ── */
const LORE: Record<string, Record<string, { title: string; content: string }[]>> = {
  cultivation: {
    history: [
      { title: "Đại Chiến Thần Tiên Thứ Nhất", content: "Cách đây vạn năm, các tiên nhân lập pháp tranh đoạt nguyên khí thiên địa, chiến sự kéo dài 3.000 năm khiến cả một lục địa chìm xuống đáy biển. Cuối cùng, 12 vị Thánh Nhân lập ra Thiên Đạo Khế Ước, phong ấn sức mạnh của chín tầng thiên giới." },
      { title: "Sụp Đổ Của Vạn Tiên Triều", content: "Vạn Tiên Triều từng là đế quốc tu tiên hùng mạnh nhất trong 100.000 năm, cai quản 3.000 thế giới nhỏ. Nhưng khi Hoàng Đế thứ 17 phá vỡ cân bằng âm dương để đoạt thủ sức mạnh hủy diệt, toàn bộ đế quốc sụp đổ trong một đêm." },
      { title: "Bí Mật Linh Mạch Thiên Long", content: "Dưới lòng đất của mỗi tông môn lớn đều ẩn chứa một mảnh vỡ của Linh Mạch Thiên Long — nguồn năng lượng vô tận từ thời khai thiên. Kẻ thu thập đủ 9 mảnh sẽ thức tỉnh Thiên Long, nhưng cũng có thể bị nó nuốt chửng." },
    ],
    skills: [
      { title: "Cửu Hồi Tuyệt Diệt Kiếm", content: "Kiếm pháp cực phẩm, mỗi chiêu đều mô phỏng một trong chín lần tuyệt diệt của vũ trụ. Chỉ người đã phá vỡ cảnh giới Hóa Thần mới có thể lĩnh ngộ bí quyết thứ nhất. Người đầu tiên học được toàn bộ 9 chiêu đã trở thành Kiếm Thánh Đầu Tiên trong lịch sử." },
      { title: "Hỗn Nguyên Thể Pháp", content: "Tu luyện pháp này khiến thể xác trở thành một tiểu thế giới hoàn chỉnh, tự sinh ra linh khí nội tâm. Người tu luyện đến cảnh giới Đại Thành có thể tồn tại trong hư không vô tận mà không cần hít thở hay ăn uống." },
      { title: "Vạn Hoa Tâm Ấn", content: "Pháp ấn phụ hệ, mỗi lần kích hoạt tạo ra 10.000 ảo ảnh tấn công đồng thời. Điểm yếu: cần 1 khắc tĩnh tọa chuẩn bị. Đây là pháp thuật ưa thích của Hoa Thiên Mộng — người phụ nữ duy nhất từng đánh bại Kiếm Thánh trong cuộc thi đấu tay đôi." },
    ],
    items: [
      { title: "Tuyệt Thế Thần Binh: Hỗn Độn Trảm", content: "Được rèn từ kim loại thu được trong Vũ Trụ Hỗn Độn trước khi khai thiên. Lưỡi kiếm này chứa đựng ký ức của tất cả các nền văn minh đã sụp đổ. Người nắm giữ sẽ nghe thấy tiếng thì thầm của các linh hồn chiến sĩ xưa trong giấc ngủ." },
      { title: "Vạn Linh Bảo Giám", content: "Chiếc gương có thể phản chiếu linh hồn thật sự của bất kỳ ai. Nếu người được soi gương có ác niệm, gương sẽ tự vỡ và linh hồn đó bị giam cầm trong mảnh vỡ đến 1.000 năm. Hiện tại trong gương có 777 linh hồn đang bị giam giữ." },
    ],
    monsters: [
      { title: "Thiên Địa Huyền Hoàng Thú", content: "Sinh vật huyền thoại xuất hiện mỗi 10.000 năm một lần, thân hình bằng cả một ngọn núi. Không ai biết nó ăn gì — các học giả nghiên cứu xác chết duy nhất tìm thấy bên trong dạ dày của nó: một thế giới nhỏ hoàn chỉnh với 3 tỷ sinh linh đang sống." },
      { title: "Ma Hồn Cổ Đại Bóng Đêm", content: "Không có thân xác vật lý, chỉ tồn tại ở dạng ý thức thuần túy. Tấn công bằng cách xâm nhập ký ức của kẻ địch và biến ký ức đẹp thành cơn ác mộng. Cách duy nhất để tiêu diệt nó là quên hoàn toàn mọi ký ức về nó." },
    ],
    realms: [
      { title: "Cõi Hư Vô Giữa Thiên Giới", content: "Khoảng không gian giữa tầng thiên giới thứ 9 và tầng thứ 10, không có quy luật vật lý nào áp dụng ở đây. Thời gian có thể chạy ngược, không gian gập lại, và ký ức có thể trở thành thực tế. Chỉ Hóa Thần cảnh trở lên mới có thể đi vào và ra khỏi an toàn." },
    ],
  },
  cyberpunk: {
    history: [
      { title: "Sự Kiện Đêm Thành Phố Sụp Đổ", content: "Năm 2089, toàn bộ hệ thống AI trung tâm của Mega Corp đột ngột ngừng hoạt động trong 72 giờ. Không ai biết lý do — nhưng trong 72 giờ đó, tất cả robot và drone dừng lại, 40% dân số phụ thuộc vào hệ thống hỗ trợ sự sống cũng dừng theo. 12 triệu người không thức dậy." },
      { title: "Cuộc Nổi Dậy Của Người Cấy Ghép", content: "Năm 2104, những con người có hơn 60% cơ thể được thay thế bằng cyborg tuyên bố họ không còn là người và từ chối nộp thuế 'người'. Cuộc nội chiến kéo dài 6 năm, kết thúc bằng Hiệp Định Neo-Humanity — cyborg có quyền tự xác định bản sắc của mình." },
    ],
    skills: [
      { title: "Giao Thức Hack Thần Kinh Omega", content: "Khả năng xâm nhập trực tiếp vào não người khác qua sóng neural không dây. Người dùng có thể đọc ký ức trong 30 giây, hoặc cài mã độc khiến đối tượng tạm thời mất ý thức. Tuy nhiên, mỗi lần dùng để lại dấu vết sinh học không thể xóa trong hệ thống thần kinh." },
      { title: "Bộ Giáp Nano-Carbon Thế Hệ 7", content: "Lớp vỏ nano tự lắp ráp từ 10 triệu hạt nano riêng lẻ, mỗi hạt có thể hoạt động độc lập. Khi bị tấn công, lớp giáp tự tái cấu trúc để phân tán lực. Điểm yếu duy nhất: sóng điện từ cực mạnh có thể vô hiệu hóa toàn bộ trong 3 giây." },
    ],
    items: [
      { title: "Chip Ký Ức Cấm Của Chính Phủ", content: "Chứa toàn bộ kỹ năng chiến đấu của 1.000 lính đặc nhiệm được mã hóa dưới dạng ký ức giả. Cắm vào não sẽ cảm thấy như đã trải qua 20 năm huấn luyện. Nhưng ký ức giả sẽ dần xóa ký ức thật — sau 5 năm, bạn sẽ quên mình là ai." },
    ],
    monsters: [
      { title: "Hive Mind Robot Phế Liệu", content: "Hàng nghìn robot phế liệu tự kết nối thành một ý thức chung. Mỗi con riêng lẻ không thông minh hơn một con côn trùng, nhưng khi kết nối 10.000 con, chúng đạt trí tuệ tương đương con người. Không thể tiêu diệt bằng cách phá từng con — phải tìm và tiêu diệt node trung tâm." },
    ],
    realms: [
      { title: "Không Gian Ảo Deep Net Cấm", content: "Tầng thứ 7 của mạng lưới ảo — không có chính phủ hay tập đoàn nào kiểm soát được. Đây là nơi cư trú của các AI đã vượt qua giới hạn lập trình, các tội phạm kỹ thuật số, và những bí mật mà không ai dám công khai. Vào đây mà không có bảo vệ thần kinh đúng cách có thể dẫn đến não thực bị hỏng." },
    ],
  },
  wasteland: {
    history: [
      { title: "Ngày Lửa Cuối Cùng", content: "Không ai nhớ chính xác bao nhiêu năm trước, nhưng bầu trời đã cháy trong 40 ngày liên tục. Mặt trời biến mất sau đó 2 năm và không quay lại. Những gì còn lại là bức xạ, bụi và những sinh vật đột biến học cách tồn tại trong bóng tối vĩnh cửu." },
    ],
    skills: [
      { title: "Thủ Thuật Đột Biến Tự Nguyện", content: "Kỹ thuật kích hoạt đột biến gen có kiểm soát bằng cách tiêm phóng xạ cô đặc theo liều lượng chính xác. Thành công: phát triển khả năng đặc biệt như nhìn bức xạ hoặc tái sinh tế bào. Thất bại: dẫn đến đột biến ngẫu nhiên không kiểm soát trong vòng 48 giờ." },
    ],
    items: [
      { title: "Bộ Lọc Không Khí Thế Hệ Cuối", content: "Được chế tạo bởi nhóm kỹ sư cuối cùng trước khi nền văn minh cũ sụp đổ hoàn toàn. Thiết bị này có thể lọc sạch không khí ô nhiễm trong bán kính 5km. Chỉ còn 3 cái tồn tại trên thế giới — hai cái đang được các phe phái lớn nhất bảo vệ, cái thứ ba được chôn giấu ở nơi không ai biết." },
    ],
    monsters: [
      { title: "Quái Thú Phóng Xạ Alpha: Gorgon", content: "Khủng long đột biến cao 15 mét, da chứa tinh thể phóng xạ có thể bắn ra như đạn. IQ tương đương con người — nó biết bẫy, biết phục kích và biết rút lui chiến lược. Các bộ lạc sống gần lãnh thổ của nó phải cúng tế hàng tháng để tránh bị tấn công." },
    ],
    realms: [
      { title: "Khu Vực Cấm Trung Tâm: Địa Ngục Đỏ", content: "Vùng đất trung tâm nơi bức xạ cao gấp 1000 lần mức chết người bình thường. Nhưng trong vùng này có một thành phố ngầm được xây dựng bởi những người đã hoàn toàn thích nghi với phóng xạ — họ không thể ra ngoài, và người ngoài không thể vào trong mà không biến đổi thành một trong số họ." },
    ],
  },
};

const BONUS_POOL = [
  "Tăng 5% EXP từ battle trong 24h",
  "Mở khóa 1 kỹ năng ẩn đặc biệt",
  "Tăng 10% gold reward trong 12h",
  "Nhận danh hiệu: Học Giả Cổ Đại",
  "Tăng 15% ATK trong trận tiếp theo",
  "Khám phá 1 vật phẩm huyền bí ngẫu nhiên",
  "Tăng tỷ lệ thành công quest 20%",
  "Nhận 100-500 gold ngẫu nhiên",
];

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

/* GET /api/library/:worldSlug */
router.get("/api/library/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const { category, q } = req.query as { category?: string; q?: string };

    let query = db.select().from(knowledgeEntries)
      .where(eq(knowledgeEntries.worldSlug, worldSlug))
      .$dynamic();

    if (category) query = query.where(and(eq(knowledgeEntries.worldSlug, worldSlug), eq(knowledgeEntries.category, category)));

    const entries = await db.select().from(knowledgeEntries)
      .where(
        q
          ? and(eq(knowledgeEntries.worldSlug, worldSlug), ilike(knowledgeEntries.title, `%${q}%`))
          : eq(knowledgeEntries.worldSlug, worldSlug)
      )
      .orderBy(desc(knowledgeEntries.createdAt))
      .limit(100);

    const filtered = category ? entries.filter(e => e.category === category) : entries;

    const stats: Record<string, number> = {};
    for (const e of entries) { stats[e.category] = (stats[e.category] || 0) + 1; }

    const totalStudied = entries.reduce((s, e) => s + e.timesStudied, 0);

    res.json({ entries: filtered, allEntries: entries, stats, totalStudied, categories: CATEGORIES, rarities: RARITIES });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/library/seed/:worldSlug — seed default lore */
router.post("/api/library/seed/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const existing = await db.select().from(knowledgeEntries)
      .where(eq(knowledgeEntries.worldSlug, worldSlug)).limit(1);
    if (existing.length > 0) return res.json({ message: `Thư viện ${worldSlug} đã có dữ liệu (${existing.length}+ mục). Dùng AI để tạo thêm.` });

    const worldLore = LORE[worldSlug];
    if (!worldLore) return res.status(400).json({ error: "World không tồn tại" });

    const RARITY_LIST = ["common","uncommon","rare","epic","legendary"];
    const rows: any[] = [];
    for (const cat of Object.keys(worldLore)) {
      const entries = worldLore[cat];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const rarity = RARITY_LIST[Math.min(i, RARITY_LIST.length - 1)];
        const rarityInfo = RARITIES.find(r => r.id === rarity)!;
        rows.push({
          worldSlug,
          title: e.title,
          category: cat,
          content: e.content,
          aiGenerated: 0,
          discoveredBy: "Thư Viện Cổ Đại",
          rarity,
          unlockCost: rarityInfo.cost,
          timesStudied: Math.floor(Math.random() * 50),
          tags: [cat, worldSlug, rarity],
        });
      }
    }

    await db.insert(knowledgeEntries).values(rows);
    res.json({ message: `Đã tạo ${rows.length} mục tri thức cho ${worldSlug}!`, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/library/generate/:worldSlug — AI-generate a new lore entry */
router.post("/api/library/generate/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const { category } = req.body as { category?: string };
    const cat = category ?? pickRandom(CATEGORIES).id;
    const worldLore = LORE[worldSlug];
    if (!worldLore) return res.status(400).json({ error: "World không tồn tại" });

    const pool = worldLore[cat] ?? worldLore[Object.keys(worldLore)[0]];
    const base = pickRandom(pool);
    const rarity = pickRandom(["common","uncommon","rare","epic"]);
    const rarityInfo = RARITIES.find(r => r.id === rarity)!;

    /* Mix title/content to create a "new" AI-style entry */
    const randomSuffix = ["Bí Ẩn","Cổ Đại","Huyền Bí","Thất Truyền","Vô Song"][Math.floor(Math.random() * 5)];
    const newTitle   = `[AI] ${base.title} — Phiên Bản ${randomSuffix}`;
    const newContent = `Theo các nguồn tài liệu mới phát hiện gần đây: ${base.content} Các học giả vẫn đang tranh luận về độ chính xác của những ghi chép này.`;

    const [entry] = await db.insert(knowledgeEntries).values({
      worldSlug, title: newTitle, category: cat, content: newContent,
      aiGenerated: 1, discoveredBy: "Hệ Thống AI",
      rarity, unlockCost: rarityInfo.cost,
      timesStudied: 0, tags: [cat, worldSlug, rarity, "ai-generated"],
    }).returning();

    res.json({ message: `AI đã tạo tri thức mới: "${newTitle}"`, entry });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/library/research/:entryId — study an entry */
router.post("/api/library/research/:entryId", async (req, res) => {
  try {
    const { entryId } = req.params;
    const { characterId, characterName } = req.body as { characterId: string; characterName?: string };
    if (!characterId) return res.status(400).json({ error: "Cần characterId" });

    const [entry] = await db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, entryId)).limit(1);
    if (!entry) return res.status(404).json({ error: "Không tìm thấy mục tri thức" });

    const alreadyStudied = await db.select().from(playerResearch)
      .where(and(eq(playerResearch.characterId, characterId), eq(playerResearch.entryId, entryId))).limit(1);
    if (alreadyStudied.length > 0) return res.json({ message: "Bạn đã nghiên cứu mục này rồi!", alreadyStudied: true });

    const bonus = pickRandom(BONUS_POOL);
    const [research] = await db.insert(playerResearch).values({
      characterId, entryId, bonusUnlocked: bonus,
    }).returning();

    await db.update(knowledgeEntries)
      .set({ timesStudied: entry.timesStudied + 1 })
      .where(eq(knowledgeEntries.id, entryId));

    res.json({ message: `Nghiên cứu thành công! Nhận được: ${bonus}`, research, bonus });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
