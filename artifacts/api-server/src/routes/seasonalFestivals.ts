import { Router } from "express";
import { db } from "@workspace/db";
import { seasonalFestivals, festivalParticipations } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

/* ── Season detection (based on real month) ── */
function getCurrentSeason(): { id: string; label: string; emoji: string } {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5)  return { id: "spring", label: "Xuân",  emoji: "🌸" };
  if (month >= 6 && month <= 8)  return { id: "summer", label: "Hạ",    emoji: "☀️" };
  if (month >= 9 && month <= 11) return { id: "autumn", label: "Thu",   emoji: "🍂" };
  return                                  { id: "winter", label: "Đông",  emoji: "❄️" };
}

/* ── Festival templates per world × season ── */
const FESTIVAL_DATA: Record<string, Record<string, {
  name: string; theme: string; narrative: string;
  quests: { title: string; desc: string; reward: number }[];
  rewards: { type: string; label: string; exclusive: boolean }[];
}>> = {
  cultivation: {
    spring: {
      name: "Lễ Hội Hoa Linh Xuân",
      theme: "Linh khí sinh sôi, hoa tiên nở rộ — tu sĩ hòa hợp với thiên nhiên",
      narrative: "Vào mỗi độ xuân về, linh khí thiên địa đạt đỉnh cao nhất trong năm. Các tông môn mở cửa đón khách, linh hoa nở rộ trên đỉnh Linh Vân Sơn. Đây là thời điểm thiêng liêng để giao lưu, trao đổi bí kíp và dâng lễ vật lên Thiên Đạo.",
      quests: [
        { title: "Hái Linh Hoa Bách Niên", desc: "Thu thập 10 loại linh hoa trên Linh Vân Sơn trong 3 ngày", reward: 500 },
        { title: "Đấu Pháp Linh Xuân", desc: "Tham gia 5 trận đấu pháp thuật giao hữu", reward: 300 },
        { title: "Cúng Tế Thiên Đạo", desc: "Dâng lễ vật giá trị 1.000 gold lên bàn thờ Thiên Đạo", reward: 800 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: Hoa Linh Tu Sĩ", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Linh Hoa Xuân", exclusive: true },
        { type: "pet", label: "Thú Cưng: Hồ Linh Xuân", exclusive: false },
      ],
    },
    summer: {
      name: "Đại Hội Luyện Đan Mùa Hạ",
      theme: "Hỏa khí đỉnh điểm — luyện đan đột phá cảnh giới",
      narrative: "Mùa hạ là thời điểm hỏa khí thiên địa cực thịnh, lò luyện đan đạt hiệu suất cao nhất. Các luyện đan sư từ khắp nơi hội tụ tại Hỏa Vân Cung để tranh tài. Đơn dược xuất lò trong mùa này được cho là có linh hiệu gấp đôi.",
      quests: [
        { title: "Luyện Đan Tuyệt Phẩm", desc: "Luyện thành công 3 viên đan dược phẩm chất 'Tuyệt' trở lên", reward: 600 },
        { title: "Vượt Qua Hỏa Thử", desc: "Sống sót qua 10 làn sóng hỏa linh thú tấn công", reward: 400 },
        { title: "Bí Phương Cổ Đại", desc: "Tìm và giải mã 1 bí phương luyện đan thời Thượng Cổ", reward: 1000 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: Đan Vương Hạ Chí", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Hỏa Liên Luyện", exclusive: true },
        { type: "pet", label: "Thú Cưng: Hỏa Kỳ Lân", exclusive: false },
      ],
    },
    autumn: {
      name: "Hội Chợ Thu Hoạch Linh Điền",
      theme: "Linh điền đơm hoa, kim khí sung túc — mùa gặt của tu sĩ",
      narrative: "Mùa thu linh điền chín rộ, tu sĩ khắp nơi đổ về để thu hoạch và trao đổi linh thảo. Tại chợ thu hoạch lớn nhất thế giới tu tiên, mọi giao dịch đều được phép — kể cả những bí kíp tối mật từ thời Thái Cổ.",
      quests: [
        { title: "Thu Hoạch Linh Điền", desc: "Thu hoạch đủ 5 loại linh thảo đặc sản mùa thu", reward: 400 },
        { title: "Thương Nhân Uy Tín", desc: "Hoàn thành 10 giao dịch trao đổi tại hội chợ", reward: 350 },
        { title: "Lễ Cảm Ơn Đất Trời", desc: "Tham gia lễ cầu mùa và nhận phúc lành của tiên nhân", reward: 600 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: Linh Điền Thần Nông", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Kim Thu Thịnh Vượng", exclusive: true },
        { type: "pet", label: "Thú Cưng: Thỏ Linh Thu", exclusive: false },
      ],
    },
    winter: {
      name: "Đêm Đông Chí Vận Khí",
      theme: "Hàn băng khóa linh, nội lực đột phá — đêm thiêng nhất năm",
      narrative: "Đêm đông chí là thời điểm thiêng liêng nhất trong năm tu tiên — âm khí đạt cực đại, vũ trụ tạm dừng một nhịp thở. Tu sĩ ngồi thiền suốt đêm để hấp thụ tinh hoa của trời đất. Ai phá cảnh giới trong đêm này sẽ nhận được phúc duyên của thiên địa.",
      quests: [
        { title: "Thiền Định Suốt Đêm", desc: "Ngồi thiền liên tục 12 tiếng đồng hồ không gián đoạn", reward: 700 },
        { title: "Chiến Đấu Trong Băng Giá", desc: "Đánh bại 10 kẻ địch trong điều kiện hàn băng cực lạnh", reward: 500 },
        { title: "Tìm Kiếm Thủy Tinh Nguyệt", desc: "Tìm thấy Thủy Tinh Nguyệt — viên đá quý chỉ xuất hiện đêm đông chí", reward: 1200 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: Băng Thiên Tu Sĩ", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Hàn Băng Đông Chí", exclusive: true },
        { type: "pet", label: "Thú Cưng: Bạch Hổ Tuyết", exclusive: false },
      ],
    },
  },
  cyberpunk: {
    spring: {
      name: "Lễ Hội Khởi Động Hệ Thống Xuân",
      theme: "Neon đua sắc, mạng lưới tái khởi động sau mùa đông băng giá",
      narrative: "Khi nhiệt độ tăng lên, các trung tâm xử lý dữ liệu không còn bị quá tải vì nhiệt. Đây là thời điểm các hackers tổ chức lễ hội CTF lớn nhất năm, các tập đoàn mở bộ phận tuyển dụng, và street market neon rực rỡ đến tận bình minh.",
      quests: [
        { title: "Hack The Planet CTF", desc: "Hoàn thành 5 thử thách bảo mật CTF khác nhau", reward: 550 },
        { title: "Neon Market Hunter", desc: "Mua và bán 20 vật phẩm tại chợ đen neon", reward: 300 },
        { title: "First Boot Ceremony", desc: "Khởi động lại AI cổ đại dưới tầng hầm Mega Corp", reward: 900 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: Spring Boot Hacker", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Neon Blossom", exclusive: true },
        { type: "pet", label: "Thú Cưng: Nano Butterfly", exclusive: false },
      ],
    },
    summer: {
      name: "Cyberpunk Burning Man Festival",
      theme: "Nhiệt độ cực điểm — hệ thống quá tải, party không ngừng",
      narrative: "Giữa cái nóng khắc nghiệt của mùa hè, thành phố không ngủ. Nhạc synthwave vang lên từ mọi góc phố, drone biểu diễn ánh sáng, và các clans lớn nhất tranh tài trong giải đấu PvP mùa hè. Kẻ nào sống sót qua đêm nóng nhất sẽ trở thành legend.",
      quests: [
        { title: "Arena Survivor", desc: "Thắng 10 trận PvP liên tiếp trong nhiệt độ 45°C", reward: 700 },
        { title: "Overclock Challenge", desc: "Ép xung bộ não cyborg đến 200% trong 1 giờ mà không shutdown", reward: 500 },
        { title: "Find The Oasis", desc: "Tìm ra nguồn nước ngầm ẩn dưới thành phố", reward: 800 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: Summer Heat Champion", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Burning Neon", exclusive: true },
        { type: "pet", label: "Thú Cưng: Desert Mech Scorpion", exclusive: false },
      ],
    },
    autumn: {
      name: "Data Harvest Festival",
      theme: "Mùa thu hoạch dữ liệu — thông tin là quyền lực",
      narrative: "Các tập đoàn mở kho dữ liệu cũ để kiểm toán. Hackers tận dụng cơ hội để khai thác trước khi dữ liệu bị xóa. Chợ thông tin ngầm hoạt động hết công suất — mọi bí mật đều có giá, và mùa thu này giá cao chưa từng có.",
      quests: [
        { title: "Data Mining Pro", desc: "Khai thác 1TB dữ liệu giá trị từ server bị bỏ hoang", reward: 450 },
        { title: "Ghost Protocol", desc: "Thực hiện 5 vụ xâm nhập mà không để lại dấu vết", reward: 600 },
        { title: "Corporate Espionage", desc: "Đánh cắp kế hoạch kinh doanh bí mật của 3 tập đoàn lớn", reward: 900 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: Data Reaper Autumn", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Orange Circuit Board", exclusive: true },
        { type: "pet", label: "Thú Cưng: Shadow Drone", exclusive: false },
      ],
    },
    winter: {
      name: "Blackout Winter Protocol",
      theme: "Lưới điện sụp đổ — sống còn trong bóng tối số",
      narrative: "Mùa đông năm nay lưới điện chính thức sụp đổ lần thứ 3 liên tiếp. Thành phố chìm trong bóng tối 18 giờ mỗi ngày. Nhưng với những kẻ thích nghi — đây là thiên đường. Không có camera, không có giám sát. Chỉ có những kẻ đủ mạnh mới tồn tại.",
      quests: [
        { title: "Off-Grid Survival", desc: "Sống sót 72 giờ mà không dùng bất kỳ thiết bị điện nào", reward: 650 },
        { title: "Blackout Raider", desc: "Cướp 5 kho hàng trong bóng tối mà không bị phát hiện", reward: 550 },
        { title: "Emergency Generator", desc: "Tìm và khởi động lại máy phát điện dự phòng cho khu dân cư", reward: 1000 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: Blackout Phantom", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Dark Circuit Winter", exclusive: true },
        { type: "pet", label: "Thú Cưng: Glitch Wolf", exclusive: false },
      ],
    },
  },
  wasteland: {
    spring: {
      name: "Lễ Hội Mầm Sống Hoang Phế",
      theme: "Hiếm hoi và quý giá — mầm xanh đầu tiên sau mùa đông tàn khốc",
      narrative: "Trong thế giới hoang tàn, mùa xuân là phép màu. Khi những mầm cây đầu tiên chui lên từ đất ô nhiễm, các bộ lạc hội tụ để ăn mừng sự sống. Đây là lúc duy nhất trong năm tất cả phe phái hạ vũ khí — dù chỉ trong 3 ngày.",
      quests: [
        { title: "Tìm Hạt Giống Sạch", desc: "Thu thập 20 hạt giống không bị nhiễm xạ từ khu vực an toàn", reward: 400 },
        { title: "Lễ Hội Hòa Bình", desc: "Tham gia và duy trì hòa bình trong lễ hội 3 ngày", reward: 300 },
        { title: "Trồng Rừng Hoang Phế", desc: "Trồng thành công 50 cây ở khu đất mới khai hoang", reward: 700 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: Người Trồng Sự Sống", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Mầm Xanh Hoang Phế", exclusive: true },
        { type: "pet", label: "Thú Cưng: Cáo Đột Biến Xuân", exclusive: false },
      ],
    },
    summer: {
      name: "Blood Sun Festival",
      theme: "Mặt trời đỏ — đấu trường sinh tử mùa nóng",
      narrative: "Khi nhiệt độ vượt 60°C, mặt trời đỏ rực như máu. Các bộ lạc tranh tài trong các thử thách sinh tồn khắc nghiệt nhất. Kẻ yếu bị loại bỏ, kẻ mạnh trở thành thủ lĩnh. Đây là mùa mà huyền thoại được tạo ra.",
      quests: [
        { title: "Đấu Trường Máu Lửa", desc: "Chiến thắng 15 trận trong đấu trường ngoài trời dưới nắng 60°C", reward: 750 },
        { title: "Hunt The Alpha", desc: "Săn và hạ sát Alpha Mutant Gorgon trước khi mặt trời lặn", reward: 800 },
        { title: "Water War", desc: "Chiếm quyền kiểm soát 3 giếng nước trong 24 giờ", reward: 600 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: Blood Sun Champion", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Red Sun Wasteland", exclusive: true },
        { type: "pet", label: "Thú Cưng: Armored Desert Hawk", exclusive: false },
      ],
    },
    autumn: {
      name: "Scavenger's Great Hunt",
      theme: "Mùa thu hoạch phế liệu — ai thu thập nhiều nhất là thủ lĩnh",
      narrative: "Khi cái nóng dịu xuống, các nhóm scavenger đổ ra ngoài để thu thập phế liệu trước mùa đông. Năm nay, có tin đồn về một kho vũ khí khổng lồ từ thời trước Ngày Lửa vẫn còn nguyên vẹn. Ai tìm được sẽ thay đổi cán cân quyền lực của toàn thế giới hoang phế.",
      quests: [
        { title: "Scrap Metal King", desc: "Thu thập 500 đơn vị phế liệu kim loại trong 5 ngày", reward: 400 },
        { title: "The Lost Arsenal", desc: "Tìm ra kho vũ khí huyền thoại từ thời trước Ngày Lửa", reward: 1500 },
        { title: "Trade Caravan", desc: "Tổ chức đoàn thương nhân vận chuyển hàng hóa qua 3 khu vực nguy hiểm", reward: 550 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: Great Scavenger Autumn", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Rust & Ruin", exclusive: true },
        { type: "pet", label: "Thú Cưng: Mechanical Rat", exclusive: false },
      ],
    },
    winter: {
      name: "Survival Protocol: White Death",
      theme: "Mùa đông tàn khốc nhất — sống sót là chiến thắng",
      narrative: "Mùa đông hoang phế là sát thủ không cần vũ khí. Bão phóng xạ đóng băng, nhiệt độ xuống -30°C, và quái thú đột biến đói khát tấn công dữ dội hơn. Chỉ những bộ lạc mạnh nhất có đủ thức ăn, nhiên liệu và ý chí để vượt qua được.",
      quests: [
        { title: "Bunker Builder", desc: "Xây dựng và gia cố bunker chịu được bão phóng xạ", reward: 600 },
        { title: "Feed The Tribe", desc: "Thu thập đủ thức ăn cho bộ lạc trong 10 ngày mùa đông", reward: 500 },
        { title: "White Death Survivor", desc: "Sống sót qua đêm lạnh nhất năm ngoài trời không có trang bị đặc biệt", reward: 1200 },
      ],
      rewards: [
        { type: "title", label: "Danh hiệu: White Death Survivor", exclusive: true },
        { type: "cosmetic", label: "Khung Avatar: Frozen Wasteland", exclusive: true },
        { type: "pet", label: "Thú Cưng: Ice Mutant Wolf", exclusive: false },
      ],
    },
  },
};

/* GET /api/festivals/:worldSlug */
router.get("/api/festivals/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const festivals = await db.select().from(seasonalFestivals)
      .where(eq(seasonalFestivals.worldSlug, worldSlug))
      .orderBy(desc(seasonalFestivals.createdAt))
      .limit(20);

    const participations = await db.select().from(festivalParticipations)
      .orderBy(desc(festivalParticipations.score))
      .limit(50);

    const active = festivals.find(f => f.isActive === 1);
    const currentSeason = getCurrentSeason();

    res.json({ festivals, active, participations, currentSeason });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/festivals/create/:worldSlug — create festival for current season */
router.post("/api/festivals/create/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const { seasonOverride } = req.body as { seasonOverride?: string };
    const currentSeason = getCurrentSeason();
    const seasonId = seasonOverride ?? currentSeason.id;

    const worldFestivals = FESTIVAL_DATA[worldSlug];
    if (!worldFestivals) return res.status(400).json({ error: "Thế giới không tồn tại" });

    const template = worldFestivals[seasonId];
    if (!template) return res.status(400).json({ error: "Không có dữ liệu lễ hội cho mùa này" });

    /* Deactivate previous festivals for this world */
    await db.update(seasonalFestivals)
      .set({ isActive: 0 })
      .where(eq(seasonalFestivals.worldSlug, worldSlug));

    /* End date = 30 days from now */
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [festival] = await db.insert(seasonalFestivals).values({
      worldSlug,
      season: seasonId,
      festivalName: template.name,
      theme: template.theme,
      endDate,
      rewards: template.rewards,
      aiNarrative: template.narrative,
      quests: template.quests,
      participantCount: 0,
      isActive: 1,
    }).returning();

    res.json({ message: `Lễ hội "${template.name}" đã bắt đầu!`, festival });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/festivals/join/:festivalId */
router.post("/api/festivals/join/:festivalId", async (req, res) => {
  try {
    const { festivalId } = req.params;
    const { characterId, characterName } = req.body as { characterId: string; characterName?: string };
    if (!characterId) return res.status(400).json({ error: "Cần characterId" });

    const [festival] = await db.select().from(seasonalFestivals)
      .where(eq(seasonalFestivals.id, festivalId)).limit(1);
    if (!festival) return res.status(404).json({ error: "Lễ hội không tồn tại" });
    if (festival.isActive === 0) return res.status(400).json({ error: "Lễ hội đã kết thúc" });

    const existing = await db.select().from(festivalParticipations)
      .where(and(eq(festivalParticipations.festivalId, festivalId), eq(festivalParticipations.characterId, characterId)))
      .limit(1);
    if (existing.length > 0) return res.json({ message: "Bạn đã tham gia lễ hội này rồi!", alreadyJoined: true, participation: existing[0] });

    const [participation] = await db.insert(festivalParticipations).values({
      festivalId, characterId, characterName: characterName ?? "Phiêu Khách", tasksCompleted: 0, rewardsClaimed: 0, score: 0,
    }).returning();

    await db.update(seasonalFestivals)
      .set({ participantCount: festival.participantCount + 1 })
      .where(eq(seasonalFestivals.id, festivalId));

    res.json({ message: `Đã tham gia lễ hội "${festival.festivalName}"!`, participation });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/festivals/complete-task/:festivalId */
router.post("/api/festivals/complete-task/:festivalId", async (req, res) => {
  try {
    const { festivalId } = req.params;
    const { characterId, taskIndex } = req.body as { characterId: string; taskIndex: number };
    if (!characterId) return res.status(400).json({ error: "Cần characterId" });

    const [festival] = await db.select().from(seasonalFestivals)
      .where(eq(seasonalFestivals.id, festivalId)).limit(1);
    if (!festival) return res.status(404).json({ error: "Lễ hội không tồn tại" });

    const quests = festival.quests as any[];
    if (taskIndex < 0 || taskIndex >= quests.length) return res.status(400).json({ error: "Quest không tồn tại" });
    const quest = quests[taskIndex];

    const [participation] = await db.select().from(festivalParticipations)
      .where(and(eq(festivalParticipations.festivalId, festivalId), eq(festivalParticipations.characterId, characterId)))
      .limit(1);
    if (!participation) return res.status(400).json({ error: "Chưa tham gia lễ hội — hãy join trước" });

    const earnedScore = quest.reward + Math.floor(Math.random() * 50);
    await db.update(festivalParticipations)
      .set({
        tasksCompleted: participation.tasksCompleted + 1,
        score: participation.score + earnedScore,
      })
      .where(eq(festivalParticipations.id, participation.id));

    res.json({ message: `Hoàn thành quest "${quest.title}"! +${earnedScore} điểm lễ hội`, score: earnedScore, quest });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/festivals/end/:festivalId */
router.post("/api/festivals/end/:festivalId", async (req, res) => {
  try {
    const { festivalId } = req.params;
    const [festival] = await db.select().from(seasonalFestivals)
      .where(eq(seasonalFestivals.id, festivalId)).limit(1);
    if (!festival) return res.status(404).json({ error: "Lễ hội không tồn tại" });

    const leaderboard = await db.select().from(festivalParticipations)
      .where(eq(festivalParticipations.festivalId, festivalId))
      .orderBy(desc(festivalParticipations.score)).limit(10);

    await db.update(seasonalFestivals).set({ isActive: 0 }).where(eq(seasonalFestivals.id, festivalId));

    const winner = leaderboard[0];
    res.json({
      message: `Lễ hội "${festival.festivalName}" kết thúc! Champion: ${winner?.characterName ?? "Không ai"}`,
      leaderboard, winner,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
