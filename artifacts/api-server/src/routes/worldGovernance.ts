import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import { worldConstitution, worldCouncil, worldVotes, worldDecrees, characters } from "@workspace/db/schema";
import { eq, and, sql, desc, lt } from "drizzle-orm";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function geminiText(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch { return ""; }
}

async function getOrCreateConstitution(worldSlug: string) {
  const [existing] = await db.select().from(worldConstitution).where(eq(worldConstitution.worldSlug, worldSlug));
  if (existing) return existing;
  const [created] = await db.insert(worldConstitution).values({ worldSlug }).returning();
  return created;
}

/* ─── Auto-expire votes ─── */
async function settleExpiredVotes() {
  const expired = await db.select().from(worldVotes)
    .where(and(eq(worldVotes.status, "open"), lt(worldVotes.expiresAt, new Date())));
  for (const vote of expired) {
    const passed = vote.votesFor > vote.votesAgainst;
    await db.update(worldVotes)
      .set({ status: passed ? "passed" : "failed", executedAt: passed ? new Date() : undefined })
      .where(eq(worldVotes.id, vote.id));

    if (passed && vote.proposalType === "law") {
      const constitution = await getOrCreateConstitution(vote.worldSlug);
      const laws = [...(constitution.laws as any[] || []), {
        id: vote.id, title: vote.proposalTitle, content: vote.proposalContent,
        effect: "voted", addedAt: new Date().toISOString(),
      }];
      await db.update(worldConstitution)
        .set({ laws, stability: Math.min(100, constitution.stability + 3), lastAmended: new Date() })
        .where(eq(worldConstitution.worldSlug, vote.worldSlug));
    }
  }
}

/* ─────────────────────────────────────────────────────
   GET /api/governance/:worldSlug — full governance info
───────────────────────────────────────────────────── */
router.get("/api/governance/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    await settleExpiredVotes();
    const { worldSlug } = req.params;
    const [constitution, council, openVotes, decrees] = await Promise.all([
      getOrCreateConstitution(worldSlug),
      db.select().from(worldCouncil).where(eq(worldCouncil.worldSlug, worldSlug)).orderBy(desc(worldCouncil.appointedAt)),
      db.select().from(worldVotes).where(and(eq(worldVotes.worldSlug, worldSlug), eq(worldVotes.status, "open"))).orderBy(desc(worldVotes.createdAt)),
      db.select().from(worldDecrees).where(and(eq(worldDecrees.worldSlug, worldSlug), eq(worldDecrees.isActive, true))).orderBy(desc(worldDecrees.issuedAt)).limit(10),
    ]);
    res.json({ constitution, council, openVotes, decrees });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   GET /api/governance/:worldSlug/history — lịch sử sắc lệnh + votes
───────────────────────────────────────────────────── */
router.get("/api/governance/:worldSlug/history", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const [pastVotes, pastDecrees] = await Promise.all([
      db.select().from(worldVotes).where(eq(worldVotes.worldSlug, worldSlug))
        .orderBy(desc(worldVotes.createdAt)).limit(20),
      db.select().from(worldDecrees).where(eq(worldDecrees.worldSlug, worldSlug))
        .orderBy(desc(worldDecrees.issuedAt)).limit(20),
    ]);
    res.json({ votes: pastVotes, decrees: pastDecrees });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/governance/appoint/:worldSlug — bổ nhiệm hội đồng
───────────────────────────────────────────────────── */
router.post("/api/governance/appoint/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params;
    const { characterId, role, votingPower } = z.object({
      characterId:  z.string().uuid(),
      role:         z.enum(["minister", "ambassador", "citizen_rep"]).default("citizen_rep"),
      votingPower:  z.number().int().min(1).max(5).default(1),
    }).parse(req.body);

    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${worldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(worldSlug);
    if (!ownerCheck.rows.length && !builtinOwned) {
      return res.status(403).json({ message: "Bạn không sở hữu thế giới này" });
    }

    const [char] = await db.select().from(characters).where(eq(characters.id, characterId));
    if (!char) return res.status(404).json({ message: "Không tìm thấy nhân vật" });

    const existing = await db.select().from(worldCouncil)
      .where(and(eq(worldCouncil.worldSlug, worldSlug), eq(worldCouncil.characterId, characterId)));

    let member;
    if (existing.length) {
      [member] = await db.update(worldCouncil)
        .set({ role, votingPower, appointedBy: userId })
        .where(eq(worldCouncil.id, existing[0].id)).returning();
    } else {
      [member] = await db.insert(worldCouncil).values({
        worldSlug, characterId, characterName: char.name, role, votingPower, appointedBy: userId,
      }).returning();
    }

    res.json({ member });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/governance/propose/:worldSlug — đề xuất luật/nghị quyết
───────────────────────────────────────────────────── */
router.post("/api/governance/propose/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params;
    const { proposalType, proposalTitle, proposalContent } = z.object({
      proposalType:    z.enum(["law", "tax", "war_declaration", "trade_policy", "entry_policy", "other"]),
      proposalTitle:   z.string().min(1).max(200),
      proposalContent: z.string().min(1),
    }).parse(req.body);

    // Kiểm tra user có nhân vật trong thế giới hoặc là owner
    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${worldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(worldSlug);
    const isOwner = ownerCheck.rows.length > 0 || builtinOwned;

    const userChar = await db.select().from(characters).where(
      and(eq(characters.userId, userId), eq(characters.worldSlug, worldSlug))
    );
    if (!isOwner && !userChar.length) {
      return res.status(403).json({ message: "Bạn không có nhân vật trong thế giới này" });
    }

    // Kiểm tra tư cách trong hội đồng
    if (!isOwner && userChar.length) {
      const councilMember = await db.select().from(worldCouncil)
        .where(and(eq(worldCouncil.worldSlug, worldSlug), eq(worldCouncil.characterId, userChar[0].id)));
      if (!councilMember.length) {
        return res.status(403).json({ message: "Chỉ thành viên hội đồng mới được đề xuất luật" });
      }
    }

    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
    const proposerName = userChar[0]?.name ?? "Chủ Thế Giới";

    const [vote] = await db.insert(worldVotes).values({
      worldSlug, proposedBy: userId, proposerName,
      proposalType, proposalTitle, proposalContent,
      expiresAt,
    }).returning();

    res.status(201).json({ vote });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/governance/vote/:voteId — bỏ phiếu
───────────────────────────────────────────────────── */
router.post("/api/governance/vote/:voteId", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { voteId } = req.params;
    const { support, characterId } = z.object({
      support:     z.boolean(),
      characterId: z.string().uuid(),
    }).parse(req.body);

    const [vote] = await db.select().from(worldVotes).where(eq(worldVotes.id, voteId));
    if (!vote || vote.status !== "open") return res.status(400).json({ message: "Vote không tồn tại hoặc đã đóng" });
    if (new Date(vote.expiresAt) < new Date()) return res.status(400).json({ message: "Vote đã hết hạn" });

    const voters = vote.voters as string[] || [];
    if (voters.includes(characterId)) return res.status(400).json({ message: "Nhân vật đã bỏ phiếu" });

    // Lấy voting power
    const [council] = await db.select().from(worldCouncil)
      .where(and(eq(worldCouncil.worldSlug, vote.worldSlug), eq(worldCouncil.characterId, characterId)));
    const power = council?.votingPower ?? 1;

    const [updated] = await db.update(worldVotes).set({
      votesFor:     support ? vote.votesFor + power : vote.votesFor,
      votesAgainst: !support ? vote.votesAgainst + power : vote.votesAgainst,
      voters:       [...voters, characterId],
    }).where(eq(worldVotes.id, voteId)).returning();

    res.json({ vote: updated });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   POST /api/governance/decree/:worldSlug — owner ban hành sắc lệnh
───────────────────────────────────────────────────── */
router.post("/api/governance/decree/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params;
    const { decreeName, decreeContent, effect, stabilityDelta, durationHours } = z.object({
      decreeName:     z.string().min(1).max(200),
      decreeContent:  z.string().min(1),
      effect:         z.record(z.any()).default({}),
      stabilityDelta: z.number().int().min(-30).max(30).default(0),
      durationHours:  z.number().int().min(1).max(720).optional(),
    }).parse(req.body);

    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${worldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(worldSlug);
    if (!ownerCheck.rows.length && !builtinOwned) {
      return res.status(403).json({ message: "Bạn không sở hữu thế giới này" });
    }

    // AI sinh lore text cho sắc lệnh
    const worldInfo = await db.execute(
      sql`SELECT name FROM custom_worlds WHERE slug = ${worldSlug} LIMIT 1`
    );
    const worldName = (worldInfo.rows[0] as any)?.name ?? worldSlug;
    const loreText = await geminiText(
      `Bạn là quan chép sử của thế giới "${worldName}". Viết 2-3 câu thể hiện nội dung sắc lệnh này theo phong cách sử thi/lore phù hợp thế giới đó:
      Sắc lệnh: "${decreeName}" — Nội dung: "${decreeContent}"
      Chỉ trả về đoạn văn lore, không giải thích.`
    );

    const expiresAt = durationHours ? new Date(Date.now() + durationHours * 3600 * 1000) : undefined;

    // Lấy tên người dùng
    const userResult = await db.execute(sql`SELECT username FROM users WHERE replit_id = ${userId} LIMIT 1`);
    const issuerName = (userResult.rows[0] as any)?.username ?? "Chủ Thế Giới";

    const [decree] = await db.insert(worldDecrees).values({
      worldSlug, issuedBy: userId, issuerName,
      decreeName, decreeContent, loreText: loreText || decreeContent,
      effect, stabilityDelta, expiresAt,
    }).returning();

    // Cập nhật stability
    if (stabilityDelta !== 0) {
      const constitution = await getOrCreateConstitution(worldSlug);
      await db.update(worldConstitution)
        .set({ stability: Math.max(0, Math.min(100, constitution.stability + stabilityDelta)) })
        .where(eq(worldConstitution.worldSlug, worldSlug));
    }

    res.status(201).json({ decree });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

/* ─────────────────────────────────────────────────────
   PATCH /api/governance/constitution/:worldSlug — cập nhật chính sách
───────────────────────────────────────────────────── */
router.patch("/api/governance/constitution/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { worldSlug } = req.params;
    const updates = z.object({
      entryPolicy:  z.enum(["open", "restricted", "closed"]).optional(),
      tradePolicy:  z.enum(["free", "protected", "embargo"]).optional(),
      warPolicy:    z.enum(["aggressive", "defensive", "pacifist"]).optional(),
      taxPolicy:    z.object({ rate: z.number(), target: z.string(), description: z.string() }).optional(),
    }).parse(req.body);

    const ownerCheck = await db.execute(
      sql`SELECT slug FROM custom_worlds WHERE slug = ${worldSlug} AND creator_user_id = ${userId} LIMIT 1`
    );
    const builtinOwned = ["tu-tien", "cyberpunk", "wasteland"].includes(worldSlug);
    if (!ownerCheck.rows.length && !builtinOwned) {
      return res.status(403).json({ message: "Bạn không sở hữu thế giới này" });
    }

    const constitution = await getOrCreateConstitution(worldSlug);
    const [updated] = await db.update(worldConstitution)
      .set({ ...updates, lastAmended: new Date(), amendedBy: userId })
      .where(eq(worldConstitution.worldSlug, worldSlug))
      .returning();

    res.json({ constitution: updated });
  } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

export default router;
