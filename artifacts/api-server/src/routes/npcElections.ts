import { Router } from "express";
import { isAuthenticated } from "../auth/replitAuth.js";
import { db } from "@workspace/db";
import {
  npcCores, npcCoreMemories,
  territories,
  npcGovernments, npcGovernmentLogs,
  npcFactionMembers,
  elections, electionCandidates,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { broadcastUnity } from "../lib/unityWs.js";

const router = Router();

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const ELECTION_TYPE_LABELS: Record<string, string> = {
  "bầu_thị_trưởng":         "Bầu Thị Trưởng",
  "bầu_thống_đốc":          "Bầu Thống Đốc",
  "bầu_lãnh_đạo_vương_quốc": "Bầu Lãnh Đạo Vương Quốc",
};

function electionTypeForGovType(govType: string): string {
  if (govType === "kingdom")       return "bầu_lãnh_đạo_vương_quốc";
  if (govType === "republic")      return "bầu_thống_đốc";
  return "bầu_thị_trưởng";
}

/* ════════════════════════════════════════
   GET /api/npc-elections/:worldSlug
   All elections (past + open) with candidates
════════════════════════════════════════ */
router.get("/npc-elections/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    if (terrs.length === 0) return res.json({ elections: [] });

    const terrIds = terrs.map(t => t.id);
    const govs    = await db.select().from(npcGovernments).where(inArray(npcGovernments.territoryId, terrIds));
    if (govs.length === 0) return res.json({ elections: [] });

    const govIds = govs.map(g => g.id);
    const allElections = await db.select().from(elections)
      .where(inArray(elections.governmentId, govIds))
      .orderBy(desc(elections.createdAt))
      .limit(50);

    const result = await Promise.all(allElections.map(async (el) => {
      const gov  = govs.find(g => g.id === el.governmentId);
      const terr = terrs.find(t => t.id === gov?.territoryId);

      const rawCands = await db
        .select({
          id:            electionCandidates.id,
          npcId:         electionCandidates.npcId,
          factionId:     electionCandidates.factionId,
          campaignScore: electionCandidates.campaignScore,
          totalVotes:    electionCandidates.totalVotes,
          isIncumbent:   electionCandidates.isIncumbent,
          name:          npcCores.name,
          occupation:    npcCores.occupation,
          money:         npcCores.money,
          happiness:     npcCores.happiness,
        })
        .from(electionCandidates)
        .innerJoin(npcCores, eq(electionCandidates.npcId, npcCores.id))
        .where(eq(electionCandidates.electionId, el.id))
        .orderBy(desc(electionCandidates.totalVotes));

      return {
        ...el,
        territory:     terr ?? null,
        gov:           gov  ?? null,
        candidates:    rawCands,
        typeLabel:     ELECTION_TYPE_LABELS[el.electionType] ?? el.electionType,
      };
    }));

    return res.json({ elections: result });
  } catch (err) {
    console.error("[npc-elections] GET error:", err);
    return res.status(500).json({ error: "Lỗi tải bầu cử" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-elections/open/:worldSlug
   Open a new election for each government
   that doesn't have an active one.
   Pick candidates from eligible NPCs.
════════════════════════════════════════ */
router.post("/npc-elections/open/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    if (terrs.length === 0) return res.json({ opened: 0, message: "Chưa có lãnh thổ" });

    const terrIds = terrs.map(t => t.id);
    const govs    = await db.select().from(npcGovernments).where(inArray(npcGovernments.territoryId, terrIds));
    if (govs.length === 0) return res.json({ opened: 0, message: "Chưa có chính phủ" });

    /* Check which govs already have open elections */
    const openElections = await db.select({ govId: elections.governmentId })
      .from(elections)
      .where(and(inArray(elections.governmentId, govs.map(g => g.id)), eq(elections.status, "open")));
    const openGovIds = new Set(openElections.map(e => e.govId));

    const allNpcs = await db.select().from(npcCores)
      .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));

    /* Load faction memberships for candidate scoring */
    const npcIds = allNpcs.map(n => n.id);
    const factionMemberships = npcIds.length
      ? await db.select({ npcId: npcFactionMembers.npcId, factionId: npcFactionMembers.factionId })
          .from(npcFactionMembers).where(inArray(npcFactionMembers.npcId, npcIds))
      : [];
    const factionMap = Object.fromEntries(factionMemberships.map(f => [f.npcId, f.factionId]));

    /* Eligible candidates: adult NPCs with happiness >= 50 */
    const eligible = allNpcs.filter(n => n.age >= 18 && n.happiness >= 50);

    let opened = 0;
    const results: { territory: string; electionType: string; candidates: number }[] = [];

    for (const gov of govs) {
      if (openGovIds.has(gov.id)) continue;

      const terr = terrs.find(t => t.id === gov.territoryId);
      const electionType = electionTypeForGovType(gov.govType);

      /* Score candidates: money*0.4 + happiness*0.3 + age-bonus*0.3 */
      const scored = eligible.map(n => {
        const ageFactor = clamp((n.age - 18) / 30, 0, 1) * 30;
        const score     = Math.floor(n.money * 0.4 + n.happiness * 0.3 + ageFactor);
        const isIncumbent = n.id === gov.leaderNpcId ? 1 : 0;
        return { npc: n, score, isIncumbent };
      }).sort((a, b) => b.score - a.score);

      /* Pick up to 4 candidates (incumbent always included if exists) */
      let pool = scored.slice(0, 8);
      const incumbentInPool = pool.find(p => p.isIncumbent);
      if (!incumbentInPool && gov.leaderNpcId) {
        const incNpc = allNpcs.find(n => n.id === gov.leaderNpcId);
        if (incNpc) {
          const incScore = Math.floor(incNpc.money * 0.4 + incNpc.happiness * 0.3);
          pool.push({ npc: incNpc, score: incScore, isIncumbent: 1 });
        }
      }
      /* Shuffle and pick 3-4 */
      pool = pool.sort(() => Math.random() - 0.5).slice(0, Math.min(4, pool.length));

      /* Campaign scores: incumbent gets approval bonus */
      pool = pool.map(p => {
        let campaign = p.score + rand(0, 20);
        if (p.isIncumbent) campaign += Math.floor(gov.approvalRate * 0.5);
        return { ...p, campaignScore: campaign };
      });

      if (pool.length === 0) continue;

      const [newEl] = await db.insert(elections).values({
        governmentId: gov.id,
        electionType,
        status:       "open",
        startTick:    0,
        endTick:      10,
      }).returning();

      for (const p of pool) {
        await db.insert(electionCandidates).values({
          electionId:    newEl.id,
          npcId:         p.npc.id,
          factionId:     factionMap[p.npc.id] ?? null,
          campaignScore: (p as any).campaignScore,
          totalVotes:    0,
          isIncumbent:   p.isIncumbent,
        });
      }

      const logMsg = `Cuộc bầu cử "${ELECTION_TYPE_LABELS[electionType]}" được mở tại ${terr?.name ?? "lãnh thổ"} với ${pool.length} ứng viên.`;
      await db.insert(npcGovernmentLogs).values({ governmentId: gov.id, event: logMsg });

      opened++;
      results.push({ territory: terr?.name ?? gov.id, electionType: ELECTION_TYPE_LABELS[electionType], candidates: pool.length });
    }

    return res.json({ opened, elections: results, message: `Đã mở ${opened} cuộc bầu cử.` });
  } catch (err) {
    console.error("[npc-elections] open error:", err);
    return res.status(500).json({ error: "Lỗi mở bầu cử" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-elections/vote/:worldSlug
   NPCs cast votes on all open elections.
   Voting weight:
     - relationship to candidate (from npcCores happiness proxy)
     - faction affiliation
     - candidate campaign score
     - incumbent penalty/bonus from approval
════════════════════════════════════════ */
router.post("/npc-elections/vote/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    if (terrs.length === 0) return res.json({ votes: 0, message: "Không có lãnh thổ" });

    const terrIds = terrs.map(t => t.id);
    const govs    = await db.select().from(npcGovernments).where(inArray(npcGovernments.territoryId, terrIds));
    if (govs.length === 0) return res.json({ votes: 0, message: "Chưa có chính phủ" });

    const govIds = govs.map(g => g.id);
    const openEls = await db.select().from(elections)
      .where(and(inArray(elections.governmentId, govIds), eq(elections.status, "open")));

    if (openEls.length === 0) return res.json({ votes: 0, message: "Chưa có cuộc bầu cử nào đang mở" });

    const allNpcs = await db.select().from(npcCores)
      .where(and(eq(npcCores.worldSlug, worldSlug), eq(npcCores.active, 1)));

    const factionMemberships = allNpcs.length
      ? await db.select({ npcId: npcFactionMembers.npcId, factionId: npcFactionMembers.factionId })
          .from(npcFactionMembers).where(inArray(npcFactionMembers.npcId, allNpcs.map(n => n.id)))
      : [];
    const voterFactionMap = Object.fromEntries(factionMemberships.map(f => [f.npcId, f.factionId]));

    let totalVotes = 0;

    for (const el of openEls) {
      const gov = govs.find(g => g.id === el.governmentId);
      const cands = await db.select().from(electionCandidates).where(eq(electionCandidates.electionId, el.id));
      if (cands.length === 0) continue;

      const approvalBonus = (gov?.approvalRate ?? 50) - 50;

      /* Reset votes */
      for (const c of cands) {
        await db.update(electionCandidates).set({ totalVotes: 0 }).where(eq(electionCandidates.id, c.id));
      }

      /* Each NPC casts 1 vote */
      const voteTally: Record<string, number> = {};
      for (const c of cands) voteTally[c.id] = 0;

      /* Voter turnout: 60-90% of NPCs vote */
      const turnoutPct = rand(60, 90) / 100;
      const voters     = allNpcs.filter(() => Math.random() < turnoutPct);

      for (const voter of voters) {
        /* Score each candidate for this voter */
        const scoredCands = cands.map(c => {
          let score = c.campaignScore;

          /* Faction alignment bonus */
          const voterFaction = voterFactionMap[voter.id];
          if (voterFaction && c.factionId && voterFaction === c.factionId) score += rand(15, 25);

          /* Happiness of voter → bias toward incumbent if happy, challenger if unhappy */
          if (c.isIncumbent) {
            score += Math.floor(approvalBonus * 0.4);
          } else {
            score -= Math.floor(approvalBonus * 0.2);
          }

          /* Random personal preference */
          score += rand(-10, 10);

          return { id: c.id, score: Math.max(1, score) };
        });

        /* Weighted random pick */
        const total = scoredCands.reduce((s, c) => s + c.score, 0);
        let rng = Math.random() * total;
        for (const c of scoredCands) {
          rng -= c.score;
          if (rng <= 0) { voteTally[c.id]++; break; }
        }
      }

      /* Write vote tallies */
      for (const [candId, votes] of Object.entries(voteTally)) {
        await db.update(electionCandidates).set({ totalVotes: votes }).where(eq(electionCandidates.id, candId));
      }

      const elTotalVotes = Object.values(voteTally).reduce((s, v) => s + v, 0);
      const turnout      = allNpcs.length > 0 ? elTotalVotes / allNpcs.length : 0;

      await db.update(elections)
        .set({ totalVotes: elTotalVotes, turnout: Math.round(turnout * 100) })
        .where(eq(elections.id, el.id));

      totalVotes += elTotalVotes;

      /* Write voter memories (sample up to 5 voters) */
      const sampleVoters = voters.slice(0, 5);
      for (const voter of sampleVoters) {
        const topCand = cands.reduce((best, c) => voteTally[c.id] > (voteTally[best.id] ?? 0) ? c : best, cands[0]);
        const candNpc = allNpcs.find(n => n.id === topCand?.npcId);
        if (candNpc) {
          await db.insert(npcCoreMemories).values({
            npcCoreId:  voter.id,
            event:      `Đã bỏ phiếu cho ${candNpc.name} trong cuộc ${ELECTION_TYPE_LABELS[el.electionType] ?? el.electionType}.`,
            importance: 2,
          });
        }
      }
    }

    return res.json({ votes: totalVotes, message: `Tổng cộng ${totalVotes} phiếu bầu được ghi nhận.` });
  } catch (err) {
    console.error("[npc-elections] vote error:", err);
    return res.status(500).json({ error: "Lỗi bỏ phiếu" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-elections/resolve/:worldSlug
   Resolve all open elections:
   - pick winner
   - update government leader
   - write memories
════════════════════════════════════════ */
router.post("/npc-elections/resolve/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const terrs = await db.select().from(territories).where(eq(territories.worldSlug, worldSlug));
    const terrIds = terrs.map(t => t.id);
    const govs    = await db.select().from(npcGovernments).where(inArray(npcGovernments.territoryId, terrIds));
    if (govs.length === 0) return res.json({ resolved: 0, message: "Chưa có chính phủ" });

    const govIds  = govs.map(g => g.id);
    const openEls = await db.select().from(elections)
      .where(and(inArray(elections.governmentId, govIds), eq(elections.status, "open")));

    if (openEls.length === 0) return res.json({ resolved: 0, message: "Không có bầu cử nào cần xử lý" });

    const allNpcs = await db.select().from(npcCores).where(eq(npcCores.worldSlug, worldSlug));

    let resolved = 0;
    const results: { territory: string; winner: string; votes: number; pct: string }[] = [];

    for (const el of openEls) {
      const gov  = govs.find(g => g.id === el.governmentId);
      const terr = terrs.find(t => t.id === gov?.territoryId);

      const cands = await db.select().from(electionCandidates)
        .where(eq(electionCandidates.electionId, el.id))
        .orderBy(desc(electionCandidates.totalVotes));

      if (cands.length === 0) continue;

      const winner = cands[0];
      const winnerNpc = allNpcs.find(n => n.id === winner.npcId);
      if (!winnerNpc) continue;

      const totalV = el.totalVotes > 0 ? el.totalVotes : cands.reduce((s, c) => s + c.totalVotes, 0);
      const pct    = totalV > 0 ? Math.round((winner.totalVotes / totalV) * 100) : 0;

      /* Update election */
      await db.update(elections).set({
        status:      "resolved",
        winnerNpcId: winner.npcId,
        winnerName:  winnerNpc.name,
        resolvedAt:  new Date(),
      }).where(eq(elections.id, el.id));

      /* Update government leader */
      if (gov) {
        await db.update(npcGovernments)
          .set({ leaderNpcId: winner.npcId, updatedAt: new Date() })
          .where(eq(npcGovernments.id, gov.id));
      }

      /* Government log */
      const typeLabel = ELECTION_TYPE_LABELS[el.electionType] ?? el.electionType;
      await db.insert(npcGovernmentLogs).values({
        governmentId: el.governmentId,
        event: `${winnerNpc.name} giành chiến thắng trong cuộc ${typeLabel} với ${pct}% phiếu bầu. Chính quyền mới được thành lập tại ${terr?.name ?? "lãnh thổ"}.`,
      });

      /* Unity realtime broadcast */
      if (terr) {
        broadcastUnity({
          type: "election",
          worldSlug: terr.worldSlug,
          govId: el.governmentId,
          territory: terr.name,
          electionType: typeLabel,
          winner: winnerNpc.name,
        });
      }

      /* Winner memory */
      await db.insert(npcCoreMemories).values({
        npcCoreId:  winner.npcId,
        event:      `Được bầu làm lãnh đạo mới (${typeLabel}) với ${pct}% phiếu bầu.`,
        importance: 5,
      });

      /* Loser memories */
      for (const loser of cands.slice(1)) {
        const loserNpc = allNpcs.find(n => n.id === loser.npcId);
        if (!loserNpc) continue;
        const loserPct = totalV > 0 ? Math.round((loser.totalVotes / totalV) * 100) : 0;
        await db.insert(npcCoreMemories).values({
          npcCoreId:  loser.npcId,
          event:      `Thất bại trong cuộc ${typeLabel} — chỉ nhận được ${loserPct}% phiếu bầu. ${winnerNpc.name} giành chiến thắng.`,
          importance: 3,
        });
      }

      resolved++;
      results.push({ territory: terr?.name ?? gov?.id ?? "", winner: winnerNpc.name, votes: winner.totalVotes, pct: `${pct}%` });
    }

    return res.json({ resolved, results, message: `Đã công bố kết quả ${resolved} cuộc bầu cử.` });
  } catch (err) {
    console.error("[npc-elections] resolve error:", err);
    return res.status(500).json({ error: "Lỗi công bố kết quả bầu cử" });
  }
});

/* ════════════════════════════════════════
   POST /api/npc-elections/auto-election/:worldSlug
   Full pipeline: open → vote → resolve
   Used by periodic tick or manual trigger.
   Will only open new election if approval < 40
   OR there's no open election for this government.
════════════════════════════════════════ */
router.post("/npc-elections/auto-election/:worldSlug", isAuthenticated, async (req, res) => {
  try {
    const { worldSlug } = req.params as Record<string, string>;

    const openRes    = await fetch(`http://localhost:8080/api/npc-elections/open/${worldSlug}`,    { method: "POST", headers: { cookie: req.headers.cookie ?? "" } });
    const voteRes    = await fetch(`http://localhost:8080/api/npc-elections/vote/${worldSlug}`,    { method: "POST", headers: { cookie: req.headers.cookie ?? "" } });
    const resolveRes = await fetch(`http://localhost:8080/api/npc-elections/resolve/${worldSlug}`, { method: "POST", headers: { cookie: req.headers.cookie ?? "" } });

    const openJ    = await openRes.json() as any;
    const voteJ    = await voteRes.json() as any;
    const resolveJ = await resolveRes.json() as any;

    return res.json({
      ok:      true,
      opened:  openJ.opened   ?? 0,
      votes:   voteJ.votes    ?? 0,
      resolved: resolveJ.resolved ?? 0,
      message: `Bầu cử tự động: mở ${openJ.opened ?? 0}, ${voteJ.votes ?? 0} phiếu, công bố ${resolveJ.resolved ?? 0} kết quả.`,
    });
  } catch (err) {
    console.error("[npc-elections] auto-election error:", err);
    return res.status(500).json({ error: "Lỗi bầu cử tự động" });
  }
});

export default router;
