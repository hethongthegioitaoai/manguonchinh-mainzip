import { Router } from "express";
import { db } from "@workspace/db";
import { divineArenaMatches, divineArenaRankings } from "@workspace/db/schema";
import { eq, desc, asc, or } from "drizzle-orm";

const router = Router();

const TIERS = [
  { id: "bronze",   label: "Đồng",     color: "#d97706", minPts: 0    },
  { id: "silver",   label: "Bạc",      color: "#9ca3af", minPts: 200  },
  { id: "gold",     label: "Vàng",     color: "#eab308", minPts: 500  },
  { id: "platinum", label: "Bạch Kim", color: "#06b6d4", minPts: 1000 },
  { id: "diamond",  label: "Kim Cương",color: "#a855f7", minPts: 2000 },
  { id: "divine",   label: "Thần",     color: "#ef4444", minPts: 5000 },
];

const RULE_SETS: Record<string, { label: string; desc: string; icon: string }> = {
  cultivation_duel:   { label: "Kiếm Khí Tu Tiên",  desc: "Đấu pháp dùng linh lực — phân thắng bại qua chiêu thức", icon: "⚔️" },
  cyber_duel:         { label: "Mech Cyber Duel",     desc: "Mech vs Mech — firepower, shields và hệ thống hack",     icon: "🤖" },
  wasteland_survival: { label: "Sinh Tồn Hoang Phế",  desc: "Ai sống sót sau 24h trong vùng đất chết thì thắng",     icon: "💀" },
  cross_world:        { label: "Liên Giới Đại Chiến",  desc: "Quy tắc hỗn hợp — phong cách chiến đấu chéo thế giới", icon: "🌌" },
};

const WORLD_FIGHTERS: Record<string, string[]> = {
  cultivation: ["Kiếm Vương","Đạo Tổ","Thiên Nữ","Hắc Long","Hỏa Tiên","Băng Đế","Lôi Thần","Phong Vũ","Long Tộc Thủ Lĩnh","Vạn Hoa Ma Tôn"],
  cyberpunk:   ["Ghost","Zero Cool","Data_Reaper","NanoKnight","Cipher","Rogue AI","Chrome Fist","Hack Queen","Mech Master","Binary"],
  wasteland:   ["Scavenger King","Rust Lord","Blood Sun","Iron Fang","Dust Rider","Radiant Wolf","Chain Breaker","Ash Queen","Bone Crusher","Mutant Alpha"],
};

const NARRATIVES: Record<string, string[]> = {
  cultivation_duel: [
    "Hai luồng linh lực khổng lồ va chạm, bầu trời rực sáng ánh đao quang. {winner} với chiêu pháp bí truyền đã áp đảo {loser} chỉ trong 7 chiêu.",
    "{winner} khai mở cảnh giới trong giây khắc sinh tử, linh lực đột phá tung ra một chưởng hóa Thiên Lôi, {loser} không kịp phản ứng đã bại dưới tay.",
    "Trận chiến kéo dài 3 giờ đồng hồ, đất trời rung chuyển. Cuối cùng {winner} dùng kiếm pháp Tuyệt Diệt để kết thúc — {loser} tâm phục khẩu phục bái lạy.",
  ],
  cyber_duel: [
    "{winner} kích hoạt giao thức Omega, liên tiếp hack hệ thống phòng thủ của {loser}. Trong 3 giây, toàn bộ mech của {loser} đứng im như tượng đá.",
    "Pháo laser đan chéo xé toạc không gian. {winner} sử dụng chiến thuật bất ngờ — bay lên cao rồi thả bom EMP — {loser} mất điện hoàn toàn.",
    "{winner} dùng nano-bots xâm nhập vỏ giáp của {loser} từ bên trong. Khi {loser} nhận ra thì đã quá muộn — hệ thống lõi phát nổ từ bên trong.",
  ],
  wasteland_survival: [
    "Trong cồn cát phóng xạ, {winner} đặt bẫy từ đêm hôm trước. Khi {loser} tiến vào, một mạng lưới thép gai và bom tự chế kích nổ — {loser} không còn đường thoát.",
    "{winner} tìm được nguồn nước ngầm ẩn và bí mật dự trữ. Khi {loser} kiệt sức sau 12 giờ không có nước, {winner} tấn công thời điểm yếu nhất.",
    "Cả hai chiến đấu liên tục trong 24 giờ. {winner} cuối cùng thắng nhờ kỹ thuật đột biến tự nguyện — tăng tốc độ hồi phục gấp đôi trong trận.",
  ],
  cross_world: [
    "{winner} với kinh nghiệm đa thế giới đã nhanh chóng thích nghi với quy tắc liên giới. {loser} mạnh trong thế giới của mình, nhưng tại Vũ Đài Thần Lực — {winner} là bá chủ.",
    "Sự kết hợp giữa pháp thuật Tu Tiên và công nghệ Cyberpunk của {winner} khiến {loser} không thể đoán trước. Một trận đấu đi vào huyền thoại của Vũ Đài.",
  ],
};

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function getTier(pts: number): string {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (pts >= TIERS[i].minPts) return TIERS[i].id;
  }
  return "bronze";
}

function generateNarrative(ruleSet: string, winnerName: string, loserName: string): string {
  const pool = NARRATIVES[ruleSet] ?? NARRATIVES["cross_world"];
  const template = pickRandom(pool);
  return template.replace(/{winner}/g, winnerName).replace(/{loser}/g, loserName);
}

function randomFighter(worldSlug: string): { id: string; name: string; world: string } {
  const pool = WORLD_FIGHTERS[worldSlug] ?? WORLD_FIGHTERS["cultivation"];
  return {
    id:    `npc-${worldSlug}-${Math.floor(Math.random() * 9000) + 1000}`,
    name:  pickRandom(pool),
    world: worldSlug,
  };
}

/* GET /api/divine-arena */
router.get("/api/divine-arena", async (req, res) => {
  try {
    const matches = await db.select().from(divineArenaMatches)
      .orderBy(desc(divineArenaMatches.matchedAt)).limit(30);

    const rankings = await db.select().from(divineArenaRankings)
      .orderBy(asc(divineArenaRankings.rank)).limit(50);

    const totalMatches = matches.length;
    const completedMatches = matches.filter(m => m.completedAt).length;

    res.json({ matches, rankings, totalMatches, completedMatches, tiers: TIERS, ruleSets: RULE_SETS });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/divine-arena/match — create + resolve a single match */
router.post("/api/divine-arena/match", async (req, res) => {
  try {
    const { challengerWorld, defenderWorld, ruleSet } = req.body as {
      challengerWorld?: string; defenderWorld?: string; ruleSet?: string;
    };

    const worlds = ["cultivation","cyberpunk","wasteland"];
    const cWorld = challengerWorld ?? pickRandom(worlds);
    const dWorld = defenderWorld   ?? pickRandom(worlds.filter(w => w !== cWorld) as string[]);
    const rs     = ruleSet ?? (cWorld === dWorld ? `${cWorld}_duel` : "cross_world");

    const challenger = randomFighter(cWorld);
    const defender   = randomFighter(dWorld);

    /* Simulate fight: weighted by world advantage on same-world duel */
    const challengerScore = Math.random() * 100 + (cWorld === dWorld ? 10 : 0);
    const defenderScore   = Math.random() * 100;
    const winner   = challengerScore >= defenderScore ? challenger : defender;
    const loser    = winner.id === challenger.id       ? defender  : challenger;

    const expReward  = Math.floor(Math.random() * 500) + 100;
    const goldReward = Math.floor(Math.random() * 300) + 50;
    const narrative  = generateNarrative(rs, winner.name, loser.name);

    const [match] = await db.insert(divineArenaMatches).values({
      challengerId: challenger.id, challengerName: challenger.name, challengerWorld: cWorld,
      defenderId:   defender.id,   defenderName:   defender.name,   defenderWorld: dWorld,
      ruleSet: rs, winnerId: winner.id, winnerName: winner.name,
      aiNarrative: narrative, expReward, goldReward, completedAt: new Date(),
    }).returning();

    /* Update rankings */
    for (const fighter of [challenger, defender]) {
      const isWinner = fighter.id === winner.id;
      const existing = await db.select().from(divineArenaRankings)
        .where(eq(divineArenaRankings.characterId, fighter.id)).limit(1);

      const ptsGain = isWinner ? expReward / 5 : -20;
      if (existing.length > 0) {
        const cur = existing[0];
        const newPts = Math.max(0, cur.divinePoints + ptsGain);
        await db.update(divineArenaRankings).set({
          wins:         isWinner ? cur.wins + 1 : cur.wins,
          losses:       isWinner ? cur.losses : cur.losses + 1,
          divinePoints: Math.round(newPts),
          tier:         getTier(newPts),
          updatedAt:    new Date(),
        }).where(eq(divineArenaRankings.id, cur.id));
      } else {
        const initPts = isWinner ? Math.round(expReward / 5) : 0;
        await db.insert(divineArenaRankings).values({
          characterId: fighter.id, characterName: fighter.name, worldSlug: fighter.world,
          wins: isWinner ? 1 : 0, losses: isWinner ? 0 : 1,
          divinePoints: initPts, tier: getTier(initPts), rank: 9999,
        });
      }
    }

    /* Recalculate ranks */
    const allRankings = await db.select().from(divineArenaRankings)
      .orderBy(desc(divineArenaRankings.divinePoints));
    for (let i = 0; i < allRankings.length; i++) {
      await db.update(divineArenaRankings).set({ rank: i + 1 }).where(eq(divineArenaRankings.id, allRankings[i].id));
    }

    res.json({ message: `⚔️ ${winner.name} chiến thắng ${loser.name}!`, match, winner, loser });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/divine-arena/tournament — run 5 matches at once */
router.post("/api/divine-arena/tournament", async (req, res) => {
  try {
    const worlds = ["cultivation","cyberpunk","wasteland"];
    const results: any[] = [];

    for (let i = 0; i < 5; i++) {
      const cWorld = pickRandom(worlds);
      const dWorld = pickRandom(worlds);
      const rs     = cWorld === dWorld ? `${cWorld}_duel` : "cross_world";
      const challenger = randomFighter(cWorld);
      const defender   = randomFighter(dWorld);

      const cScore = Math.random() * 100;
      const dScore = Math.random() * 100;
      const winner   = cScore >= dScore ? challenger : defender;
      const loser    = winner.id === challenger.id ? defender : challenger;

      const expReward  = Math.floor(Math.random() * 500) + 100;
      const goldReward = Math.floor(Math.random() * 300) + 50;
      const narrative  = generateNarrative(rs, winner.name, loser.name);

      const [match] = await db.insert(divineArenaMatches).values({
        challengerId: challenger.id, challengerName: challenger.name, challengerWorld: cWorld,
        defenderId:   defender.id,   defenderName:   defender.name,   defenderWorld: dWorld,
        ruleSet: rs, winnerId: winner.id, winnerName: winner.name,
        aiNarrative: narrative, expReward, goldReward, completedAt: new Date(),
      }).returning();

      results.push({ match, winner, loser });

      for (const fighter of [challenger, defender]) {
        const isWinner = fighter.id === winner.id;
        const existing = await db.select().from(divineArenaRankings)
          .where(eq(divineArenaRankings.characterId, fighter.id)).limit(1);
        const ptsGain = isWinner ? expReward / 5 : -20;
        if (existing.length > 0) {
          const cur = existing[0];
          const newPts = Math.max(0, cur.divinePoints + ptsGain);
          await db.update(divineArenaRankings).set({
            wins: isWinner ? cur.wins + 1 : cur.wins,
            losses: isWinner ? cur.losses : cur.losses + 1,
            divinePoints: Math.round(newPts), tier: getTier(newPts), updatedAt: new Date(),
          }).where(eq(divineArenaRankings.id, cur.id));
        } else {
          const initPts = isWinner ? Math.round(expReward / 5) : 0;
          await db.insert(divineArenaRankings).values({
            characterId: fighter.id, characterName: fighter.name, worldSlug: fighter.world,
            wins: isWinner ? 1 : 0, losses: isWinner ? 0 : 1,
            divinePoints: initPts, tier: getTier(initPts), rank: 9999,
          });
        }
      }
    }

    const allRankings = await db.select().from(divineArenaRankings)
      .orderBy(desc(divineArenaRankings.divinePoints));
    for (let i = 0; i < allRankings.length; i++) {
      await db.update(divineArenaRankings).set({ rank: i + 1 }).where(eq(divineArenaRankings.id, allRankings[i].id));
    }

    res.json({ message: `Giải đấu hoàn thành — ${results.length} trận đã kết thúc!`, results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
