import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, Loader2, Eye, Sparkles, RefreshCw,
  CheckCircle2, Clock, XCircle, ScrollText, Crown,
  Star, Send, BookOpen, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface Prophecy {
  id: string; worldSlug: string; content: string; clue: string;
  reward: { exp: number; gold: number; title: string };
  isActive: boolean; fulfilledAt: string | null; generatedAt: string;
}
interface FulfilledEntry {
  prophecy: Prophecy;
  char: { id: string; name: string; level: number } | null;
}
interface ProphecyData { active: Prophecy[]; fulfilled: FulfilledEntry[] }
interface WorldInfo { id: string; slug: string; name: string; genre: string; createdBy: string }
interface CharInfo { id: string; name: string; level: number; stats: Record<string, unknown> }

const PROPHECY_COLOR = "#f59e0b";

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}p trước`;
  if (m < 1440) return `${Math.floor(m / 60)}h trước`;
  return `${Math.floor(m / 1440)} ngày trước`;
}

export default function ProphecyPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [selectedWorld, setSelectedWorld] = useState<WorldInfo | null>(null);
  const [prophecyData, setProphecyData] = useState<ProphecyData | null>(null);
  const [myChars, setMyChars] = useState<CharInfo[]>([]);
  const [myWorlds, setMyWorlds] = useState<WorldInfo[]>([]);
  const [fetching, setFetching] = useState(true);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  // Claim state
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimChar, setClaimChar] = useState("");
  const [claimProof, setClaimProof] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claimResult, setClaimResult] = useState<{ score: number; approved: boolean; msg: string } | null>(null);

  // Expanded prophecy
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading]);

  const loadWorlds = useCallback(async () => {
    setFetching(true);
    try {
      const [pubRes, myRes, cRes, godRes] = await Promise.all([
        fetch("/api/passport/worlds"),
        fetch("/api/passport/my"),
        fetch("/api/world-trade/my-chars"),
        fetch("/api/god/my-worlds"),
      ]);
      const [pub, , cData, mine] = await Promise.all([pubRes.json(), myRes.json(), cRes.json(), godRes.json()]);
      const allWorlds = [
        ...(Array.isArray(mine) ? mine : []),
        ...(Array.isArray(pub) ? pub : []),
      ];
      // Dedup by slug
      const seen = new Set<string>();
      const deduped = allWorlds.filter(w => { if (seen.has(w.slug)) return false; seen.add(w.slug); return true; });
      setWorlds(deduped);
      setMyWorlds(Array.isArray(mine) ? mine : []);
      setMyChars(Array.isArray(cData) ? cData.map((d: any) => d.char) : []);
      if (cData.length && !claimChar) setClaimChar(cData[0]?.char?.id ?? "");
    } finally { setFetching(false); }
  }, []);

  useEffect(() => { if (user) loadWorlds(); }, [user]);

  const loadProphecy = useCallback(async (worldSlug: string) => {
    const r = await fetch(`/api/prophecy/${worldSlug}`);
    if (r.ok) setProphecyData(await r.json());
  }, []);

  const handleSelectWorld = async (world: WorldInfo) => {
    setSelectedWorld(world);
    setProphecyData(null);
    setClaimingId(null);
    setClaimResult(null);
    await loadProphecy(world.slug);
  };

  const handleGenerate = async (worldSlug: string) => {
    setGeneratingFor(worldSlug);
    try {
      const r = await fetch(`/api/prophecy/generate/${worldSlug}`, { method: "POST" });
      const d = await r.json();
      if (r.ok) await loadProphecy(worldSlug);
      else alert(d.error);
    } finally { setGeneratingFor(null); }
  };

  const handleSubmitClaim = async (prophecyId: string) => {
    if (!claimChar || !claimProof.trim()) return;
    setSubmitting(true); setClaimResult(null);
    try {
      const r = await fetch(`/api/prophecy/claim/${prophecyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: claimChar, proof: claimProof }),
      });
      const d = await r.json();
      if (r.ok) {
        setClaimResult({ score: d.score, approved: d.autoApproved, msg: d.message });
        if (d.autoApproved) { setClaimingId(null); await loadProphecy(prophecyId.split("_")[0] ?? selectedWorld?.slug ?? ""); }
        await loadWorlds();
      } else {
        setClaimResult({ score: 0, approved: false, msg: d.error });
      }
    } finally { setSubmitting(false); }
  };

  const isCreator = (worldSlug: string) => myWorlds.some(w => w.slug === worldSlug);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/30 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/dashboard")} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Star className="w-5 h-5 flex-shrink-0" style={{ color: PROPHECY_COLOR }} strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <div className="font-orbitron text-sm font-bold tracking-widest" style={{ color: PROPHECY_COLOR }}>
              THẦN KHẢI & TIÊN TRI
            </div>
            <div className="font-mono text-xs text-muted-foreground/60">AI sinh lời tiên tri — giải mã để nhận reward legendary</div>
          </div>
          <button onClick={loadWorlds} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {fetching ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* World list sidebar */}
            <div className="md:col-span-1 space-y-2">
              <p className="font-mono text-xs text-muted-foreground/40 tracking-widest">CÁC THẾ GIỚI</p>
              {worlds.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground/30">Không có thế giới nào.</p>
              ) : worlds.map(w => (
                <button key={w.id} onClick={() => handleSelectWorld(w)}
                  className="w-full text-left border p-3 transition-all flex items-center gap-2"
                  style={{
                    borderColor: selectedWorld?.slug === w.slug ? PROPHECY_COLOR : "rgba(255,255,255,0.08)",
                    background: selectedWorld?.slug === w.slug ? `${PROPHECY_COLOR}10` : "transparent",
                    color: selectedWorld?.slug === w.slug ? PROPHECY_COLOR : "rgba(255,255,255,0.6)",
                  }}>
                  {isCreator(w.slug) && <Crown className="w-3 h-3 flex-shrink-0" style={{ color: PROPHECY_COLOR }} strokeWidth={1.5} />}
                  <span className="font-orbitron text-xs font-bold truncate">{w.name}</span>
                </button>
              ))}
            </div>

            {/* Prophecy panel */}
            <div className="md:col-span-2 space-y-5">
              {!selectedWorld ? (
                <div className="text-center py-20 space-y-3">
                  <ScrollText className="w-12 h-12 mx-auto opacity-15" strokeWidth={1} />
                  <p className="font-mono text-xs text-muted-foreground/30">Chọn một thế giới để xem lời tiên tri.</p>
                </div>
              ) : !prophecyData ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {/* Header world */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-orbitron text-sm font-bold">{selectedWorld.name}</div>
                      <div className="font-mono text-xs text-muted-foreground/50">{prophecyData.active.length} tiên tri active · {prophecyData.fulfilled.length} đã ứng nghiệm</div>
                    </div>
                    {isCreator(selectedWorld.slug) && (
                      <Button size="sm" disabled={generatingFor === selectedWorld.slug}
                        onClick={() => handleGenerate(selectedWorld.slug)}
                        className="rounded-none font-orbitron text-xs border h-8 px-3"
                        style={{ borderColor: PROPHECY_COLOR, background: `${PROPHECY_COLOR}15`, color: PROPHECY_COLOR }}>
                        {generatingFor === selectedWorld.slug ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3 h-3 mr-1.5" />TRIỆU TIÊN TRI</>}
                      </Button>
                    )}
                  </div>

                  {/* Char select for claim */}
                  {myChars.length > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground/50">Nhân vật claim:</span>
                      <select value={claimChar} onChange={e => setClaimChar(e.target.value)}
                        className="bg-card border border-border/40 font-mono text-xs px-2 py-1 text-foreground outline-none">
                        {myChars.map(c => <option key={c.id} value={c.id}>{c.name} Lv.{c.level}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Active prophecies */}
                  {prophecyData.active.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <Star className="w-10 h-10 mx-auto opacity-15" strokeWidth={1} />
                      <p className="font-mono text-xs text-muted-foreground/30">Chưa có lời tiên tri nào.</p>
                      {!isCreator(selectedWorld.slug) && (
                        <p className="font-mono text-xs text-muted-foreground/20">Chờ creator của thế giới này triệu gọi Oracle.</p>
                      )}
                    </div>
                  ) : prophecyData.active.map(p => (
                    <motion.div key={p.id} layout
                      className="border bg-card/30 p-5 space-y-4"
                      style={{ borderColor: `${PROPHECY_COLOR}30`, boxShadow: `inset 0 0 60px ${PROPHECY_COLOR}05` }}>
                      {/* Prophecy content */}
                      <div className="flex items-start gap-3">
                        <ScrollText className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: PROPHECY_COLOR }} strokeWidth={1.5} />
                        <div className="space-y-2 flex-1">
                          <p className="font-orbitron text-xs text-muted-foreground/40 tracking-widest">LỜI TIÊN TRI</p>
                          <p className="font-mono text-sm leading-relaxed whitespace-pre-line italic"
                            style={{ color: PROPHECY_COLOR, opacity: 0.9 }}>{p.content}</p>
                        </div>
                      </div>

                      {/* Clue */}
                      <div className="border border-amber-500/15 bg-amber-500/5 p-3 flex gap-2">
                        <Eye className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: PROPHECY_COLOR, opacity: 0.6 }} strokeWidth={1.5} />
                        <p className="font-mono text-xs text-amber-200/60 leading-relaxed">{p.clue}</p>
                      </div>

                      {/* Reward */}
                      <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground/50">
                        <span>⚡ +{p.reward.exp.toLocaleString()} EXP</span>
                        <span>💰 +{p.reward.gold.toLocaleString()} vàng</span>
                        <span>🏆 "{p.reward.title}"</span>
                        <span className="ml-auto">{timeAgo(p.generatedAt)}</span>
                      </div>

                      {/* Claim section */}
                      <div className="border-t border-border/30 pt-4 space-y-3">
                        <button onClick={() => setClaimingId(claimingId === p.id ? null : p.id)}
                          className="flex items-center gap-2 font-orbitron text-xs tracking-widest transition-all"
                          style={{ color: claimingId === p.id ? PROPHECY_COLOR : "rgba(255,255,255,0.4)" }}>
                          {claimingId === p.id ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
                          NỘP BẰNG CHỨNG GIẢI MÃ
                        </button>
                        <AnimatePresence>
                          {claimingId === p.id && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                              className="space-y-3 overflow-hidden">
                              <textarea value={claimProof} onChange={e => setClaimProof(e.target.value)}
                                placeholder="Giải thích bằng chứng của bạn — tại sao bạn nghĩ lời tiên tri đã ứng nghiệm? Mô tả sự kiện đã xảy ra..."
                                maxLength={500} rows={4}
                                className="w-full bg-transparent border-b border-border/30 font-mono text-sm text-foreground placeholder:text-muted-foreground/25 resize-none outline-none pb-1 leading-relaxed" />
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs text-muted-foreground/30">{claimProof.length}/500 · AI chấm 0-100, ≥80 tự động nhận reward</span>
                                <Button size="sm" disabled={submitting || claimProof.length < 10 || !claimChar} onClick={() => handleSubmitClaim(p.id)}
                                  className="rounded-none font-orbitron text-xs border h-8 px-3"
                                  style={{ borderColor: PROPHECY_COLOR, background: `${PROPHECY_COLOR}20`, color: PROPHECY_COLOR }}>
                                  {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 mr-1.5" />NỘP</>}
                                </Button>
                              </div>
                              <AnimatePresence>
                                {claimResult && (
                                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="border p-3 font-mono text-xs leading-relaxed"
                                    style={{
                                      borderColor: claimResult.approved ? `${PROPHECY_COLOR}40` : claimResult.score >= 50 ? "rgba(250,204,21,0.2)" : "rgba(248,113,113,0.3)",
                                      color: claimResult.approved ? PROPHECY_COLOR : claimResult.score >= 50 ? "#facc15" : "#f87171",
                                    }}>
                                    {claimResult.approved ? "✨ " : claimResult.score >= 50 ? "⏳ " : "❌ "}
                                    <span className="font-bold">Điểm: {claimResult.score}/100 — </span>
                                    {claimResult.msg}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}

                  {/* Fulfilled history */}
                  {prophecyData.fulfilled.length > 0 && (
                    <div className="space-y-3">
                      <p className="font-mono text-xs text-muted-foreground/40 tracking-widest">ĐÃ ỨNG NGHIỆM ({prophecyData.fulfilled.length})</p>
                      {prophecyData.fulfilled.map(({ prophecy, char }) => (
                        <div key={prophecy.id} className="border border-border/25 bg-card/15 p-4 space-y-2 opacity-70">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-mono text-xs italic text-muted-foreground/60 line-clamp-2">{prophecy.content}</p>
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" strokeWidth={1.5} />
                          </div>
                          {char && (
                            <div className="font-mono text-xs text-muted-foreground/40">
                              Giải mã bởi <span className="text-emerald-400/70">{char.name}</span> Lv.{char.level}
                              {prophecy.fulfilledAt && ` · ${timeAgo(prophecy.fulfilledAt)}`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
