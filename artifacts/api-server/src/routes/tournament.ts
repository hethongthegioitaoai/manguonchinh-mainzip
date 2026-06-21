import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { tournaments, tournamentParticipants, tournamentMatches, characters } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const genAI = new GoogleGenAI({ apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY, httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL } });

async function geminiText(prompt: string): Promise<string> {
  try {
    const model = { generateContent: async (p: any) => { const r = await genAI.models.generateContent({ model: "gemini-2.0-flash-lite", contents: typeof p === "string" ? p : p }); return { response: { text: () => r.text ?? "" } }; } };
    const r = await model.generateContent(prompt);
    return r.response.text().trim();
  } catch { return ""; }
}

/* ─── Tạo hoặc lấy giải đang registration ─── */
async function getOrCreateRegistration(): Promise<any> {
  const [existing] = await db.select().from(tournaments)
    .where(eq(tournaments.status, "registration"))
    .orderBy(desc(tournaments.createdAt)).limit(1);
  if (existing) return existing;

  // Lấy season hiện tại
  const seasonResult = await db.execute(sql`SELECT MAX(season) as max_season FROM tournaments`);
  const maxSeason = (seasonResult.rows[0] as any)?.max_season ?? 0;

  const startAt = new Date(Date.now() + 3 * 24 * 3600 * 1000); // 3 ngày sau
  const [created] = await db.insert(tournaments).values({
    season: maxSeason + 1,
    prizePool: 0,
    startAt,
    status: "registration",
  }).returning();
  return created;
}

/* ─── Simulate một trận đấu ─── */
async function simulateMatch(char1: any, char2: any): Promise<{ winnerId: string; winnerName: string; log: any[]; commentary: string }> {
  const c1Power = (char1.level ?? 1) * 10 + (char1.attack ?? 5) + (char1.defense ?? 5);
  const c2Power = (char2.level ?? 1) * 10 + (char2.attack ?? 5) + (char2.defense ?? 5);
  const total = c1Power + c2Power;
  const winnerIsChar1 = Math.random() * total < c1Power;
  const winner = winnerIsChar1 ? char1 : char2;
  const loser = winnerIsChar1 ? char2 : char1;

  const commentary = await geminiText(
    `Tóm tắt kịch tính trận đấu võ lâm: ${winner.name} (level ${winner.level}) thắng ${loser.name} (level ${loser.level}).
    Viết 1-2 câu mô tả chiến thắng hào hùng theo phong cách Tu Tiên Giả Bắt Đầu Từ Đây. Chỉ trả về đoạn văn ngắn.`
  );

  return {
    winnerId: winner.id,
    winnerName: winner.name,
    log: [{ round: 1, action: `${winner.name} chiến thắng!` }],
    commentary: commentary || `${winner.name} đã khuất phục ${loser.name} trong trận chiến kinh thiên!`,
  };
}

/* ─────────────────────────────────────────────────────
   GET /api/tournament/current — giải đang diễn ra hoặc đăng ký
───────────────────────────────────────────────────── */
router.get("/tournament/current", isAuthenticated, async (req, res) => {
  try {
    const tournament = await getOrCreateRegistration();
    const participants = await db.select().from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournament.id));
    const matches = await db.select().from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, tournament.id))
      .orderBy(tournamentMatches.round, tournamentMatches.matchIndex);
    res.json({ tournament, participants, matches });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/tournament/history — lịch sử các mùa
───────────────────────────────────────────────────── */
router.get("/tournament/history", isAuthenticated, async (_req, res) => {
  try {
    const list = await db.select().from(tournaments)
      .where(eq(tournaments.status, "ended"))
      .orderBy(desc(tournaments.season)).limit(10);
    res.json(list);
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/tournament/register — đăng ký tham gia
───────────────────────────────────────────────────── */
router.post("/tournament/register", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [char] = await db.select().from(characters).where(eq(characters.userId, userId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const tournament = await getOrCreateRegistration();
    if (tournament.status !== "registration") return res.status(400).json({ message: "Giải không trong giai đoạn đăng ký" });

    const existing = await db.select().from(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, tournament.id), eq(tournamentParticipants.characterId, char.id)));
    if (existing.length) return res.status(400).json({ message: "Nhân vật đã đăng ký rồi" });

    const count = await db.select().from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournament.id));
    if (count.length >= tournament.maxParticipants) return res.status(400).json({ message: "Giải đã đầy slot" });

    const [p] = await db.insert(tournamentParticipants).values({
      tournamentId: tournament.id,
      characterId: char.id,
      characterName: char.name,
      worldSlug: (char.stats as any)?.world_slug ?? "cultivation",
      seed: count.length + 1,
    }).returning();

    // Cộng vào prize pool (phí đăng ký 50 gold)
    const entryFee = 50;
    if (((char.stats as any)?.gold ?? 0) >= entryFee) {
      await db.update(characters).set({ stats: { ...(char.stats as any), gold: ((char.stats as any)?.gold ?? 0) - entryFee } }).where(eq(characters.id, char.id));
      await db.update(tournaments).set({ prizePool: tournament.prizePool + entryFee, participantCount: count.length + 1 }).where(eq(tournaments.id, tournament.id));
    }

    res.status(201).json({ participant: p, message: `Đăng ký thành công! Đã trừ ${entryFee} gold phí tham gia.` });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/tournament/simulate-round — simulate 1 vòng
───────────────────────────────────────────────────── */
router.post("/tournament/simulate-round", isAuthenticated, async (req, res) => {
  try {
    const { tournamentId } = z.object({ tournamentId: z.string().uuid() }).parse(req.body);

    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    if (!tournament) return res.status(404).json({ message: "Không tìm thấy giải" });

    const participants = await db.select().from(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.isEliminated, false)));

    if (tournament.status === "registration") {
      if (participants.length < 2) return res.status(400).json({ message: "Cần ít nhất 2 người tham gia" });
      await db.update(tournaments).set({ status: "active" }).where(eq(tournaments.id, tournamentId));
    }

    // Lấy round hiện tại
    const lastMatchResult = await db.execute(sql`SELECT MAX(round) as max_round FROM tournament_matches WHERE tournament_id = ${tournamentId}`);
    const currentRound = ((lastMatchResult.rows[0] as any)?.max_round ?? 0) + 1;

    if (participants.length <= 1) {
      // Kết thúc giải
      const winner = participants[0];
      if (winner) {
        // Trao thưởng
        const [winnerChar] = await db.select().from(characters).where(eq(characters.id, winner.characterId));
        if (winnerChar) {
          await db.update(characters).set({ stats: { ...(winnerChar.stats as any), gold: ((winnerChar.stats as any)?.gold ?? 0) + Math.floor(tournament.prizePool * 0.6) } }).where(eq(characters.id, winner.characterId));
        }
        await db.update(tournaments).set({ status: "ended", winnerId: winner.characterId, winnerName: winner.characterName, endAt: new Date() }).where(eq(tournaments.id, tournamentId));
        return res.json({ ended: true, winner, prize: Math.floor(tournament.prizePool * 0.6), message: `🏆 ${winner.characterName} là Thiên Hạ Đệ Nhất!` });
      }
    }

    // Tạo cặp đấu
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const newMatches = [];

    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const p1 = shuffled[i];
      const p2 = shuffled[i + 1];

      const [char1] = await db.select().from(characters).where(eq(characters.id, p1.characterId));
      const [char2] = await db.select().from(characters).where(eq(characters.id, p2.characterId));

      const simResult = await simulateMatch(char1 ?? { id: p1.characterId, name: p1.characterName, level: 1, attack: 5, defense: 5 }, char2 ?? { id: p2.characterId, name: p2.characterName, level: 1, attack: 5, defense: 5 });

      const [match] = await db.insert(tournamentMatches).values({
        tournamentId, round: currentRound, matchIndex: i / 2,
        char1Id: p1.characterId, char1Name: p1.characterName,
        char2Id: p2.characterId, char2Name: p2.characterName,
        winnerId: simResult.winnerId, winnerName: simResult.winnerName,
        battleLog: simResult.log,
        aiCommentary: simResult.commentary,
        status: "completed", foughtAt: new Date(),
      }).returning();
      newMatches.push(match);

      // Loại kẻ thua
      const loserId = simResult.winnerId === p1.characterId ? p2.characterId : p1.characterId;
      await db.update(tournamentParticipants)
        .set({ isEliminated: true })
        .where(and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.characterId, loserId)));
    }

    res.json({ round: currentRound, matches: newMatches, remaining: shuffled.length - Math.floor(shuffled.length / 2) });
  } catch { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
