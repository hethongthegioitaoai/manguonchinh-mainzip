import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, Loader2, Passport, Globe, CheckCircle2, XCircle,
  Clock, Eye, Users, Send, RefreshCw, BookOpen, Lock, Unlock,
  Map, UserCheck, UserX, ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface PublicWorld { id: string; slug: string; name: string; genre: string; lore: string; createdBy: string }
interface PassportEntry {
  passport: {
    id: string; characterId: string; worldSlug: string; status: string;
    requestNote: string; creatorNote: string; entryCount: number;
    bannedAt: string | null; approvedAt: string | null; createdAt: string;
  };
  world: { name: string; genre: string; slug: string; createdBy: string } | null;
  char: { id: string; name: string; level: number } | null;
}
interface VisitorEntry {
  passport: { id: string; status: string; requestNote: string; creatorNote: string; entryCount: number; createdAt: string };
  char: { id: string; name: string; level: number; userId: string };
}
interface VisitData {
  world: PublicWorld;
  npcs: { id: string; name: string; role: string; personality: string }[];
  events: { id: string; title: string; description: string; createdAt: string }[];
  welcomeNarrative: string;
  isReadOnly: boolean;
}
interface CharInfo { id: string; name: string; level: number }

const STATUS_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending:  { icon: Clock,       color: "#facc15", label: "Đang chờ phê duyệt" },
  approved: { icon: CheckCircle2,color: "#34d399", label: "Đã được phê duyệt" },
  banned:   { icon: XCircle,     color: "#f87171", label: "Bị cấm" },
  expired:  { icon: ShieldOff,   color: "#6b7280", label: "Hết hạn" },
};
const GENRE_LABELS: Record<string, string> = {
  cultivation: "Tu Tiên", cyberpunk: "Cyberpunk", zombie: "Vùng Hoang Phế",
  tu_tien: "Tu Tiên", fantasy: "Fantasy", horror: "Kinh Dị",
  scifi: "Sci-Fi", wasteland: "Hoang Phế", steampunk: "Steampunk", xianxia: "Tiên Hiệp",
};
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}p trước`;
  if (m < 1440) return `${Math.floor(m / 60)}h trước`;
  return `${Math.floor(m / 1440)}d trước`;
}

const PASSPORT_COLOR = "#818cf8";

export default function WorldPassportPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<"explore" | "mypassports" | "manage">("explore");
  const [publicWorlds, setPublicWorlds] = useState<PublicWorld[]>([]);
  const [myPassports, setMyPassports] = useState<PassportEntry[]>([]);
  const [myChars, setMyChars] = useState<CharInfo[]>([]);
  const [myWorlds, setMyWorlds] = useState<PublicWorld[]>([]);
  const [fetching, setFetching] = useState(true);

  // Request modal
  const [requestWorld, setRequestWorld] = useState<PublicWorld | null>(null);
  const [requestChar, setRequestChar] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);

  // Visitor management
  const [selectedWorld, setSelectedWorld] = useState<PublicWorld | null>(null);
  const [visitors, setVisitors] = useState<VisitorEntry[]>([]);
  const [loadingVisitors, setLoadingVisitors] = useState(false);

  // Visit view
  const [visitData, setVisitData] = useState<VisitData | null>(null);
  const [visitChar, setVisitChar] = useState<string>("");
  const [loadingVisit, setLoadingVisit] = useState(false);

  // Ban/approve actions
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading]);

  const loadAll = useCallback(async () => {
    setFetching(true);
    try {
      const [wRes, pRes, cRes, mRes] = await Promise.all([
        fetch("/api/passport/worlds"),
        fetch("/api/passport/my"),
        fetch("/api/world-trade/my-chars"),
        fetch("/api/god/my-worlds"),
      ]);
      const [wData, pData, cData, mData] = await Promise.all([wRes.json(), pRes.json(), cRes.json(), mRes.json()]);
      setPublicWorlds(Array.isArray(wData) ? wData : []);
      setMyPassports(Array.isArray(pData) ? pData : []);
      setMyChars(Array.isArray(cData) ? cData.map((d: any) => d.char) : []);
      setMyWorlds(Array.isArray(mData) ? mData : []);
      if (cData.length && !requestChar) setRequestChar(cData[0]?.char?.id ?? "");
      if (cData.length && !visitChar) setVisitChar(cData[0]?.char?.id ?? "");
    } finally { setFetching(false); }
  }, []);

  useEffect(() => { if (user) loadAll(); }, [user]);

  const loadVisitors = useCallback(async (worldSlug: string) => {
    setLoadingVisitors(true);
    try {
      const r = await fetch(`/api/passport/visitors/${worldSlug}`);
      const d = await r.json();
      setVisitors(d.passports ?? []);
    } finally { setLoadingVisitors(false); }
  }, []);

  const loadVisit = async (worldSlug: string, charId: string) => {
    setLoadingVisit(true);
    setVisitData(null);
    try {
      const r = await fetch(`/api/passport/visit/${worldSlug}?characterId=${charId}`);
      const d = await r.json();
      if (r.ok) setVisitData(d);
      else alert(d.error);
    } finally { setLoadingVisit(false); }
  };

  const handleRequest = async () => {
    if (!requestWorld || !requestChar) return;
    setRequesting(true); setRequestMsg(null);
    try {
      const r = await fetch(`/api/passport/request/${requestWorld.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: requestChar, note: requestNote }),
      });
      const d = await r.json();
      setRequestMsg(d.message ?? d.error);
      if (r.ok) { setRequestWorld(null); setRequestNote(""); await loadAll(); }
    } finally { setRequesting(false); }
  };

  const handleApprove = async (passportId: string, worldSlug: string) => {
    setActingId(passportId);
    try {
      await fetch(`/api/passport/approve/${passportId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      await loadVisitors(worldSlug);
    } finally { setActingId(null); }
  };

  const handleBan = async (passportId: string, worldSlug: string) => {
    if (!confirm("Trục xuất và cấm khách này?")) return;
    setActingId(passportId);
    try {
      await fetch(`/api/passport/ban/${passportId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      await loadVisitors(worldSlug);
    } finally { setActingId(null); }
  };

  if (visitData) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="border-b border-border/60 bg-card/30 sticky top-0 z-20 backdrop-blur">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => setVisitData(null)} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <Eye className="w-5 h-5" style={{ color: PASSPORT_COLOR }} strokeWidth={1.5} />
            <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: PASSPORT_COLOR }}>
              ĐANG THĂM: {visitData.world.name.toUpperCase()}
            </span>
            <span className="ml-auto font-mono text-xs px-2 py-0.5 border" style={{ borderColor: `${PASSPORT_COLOR}30`, color: PASSPORT_COLOR, background: `${PASSPORT_COLOR}10` }}>
              CHẾ ĐỘ QUAN SÁT
            </span>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
          {/* Welcome narrative */}
          {visitData.welcomeNarrative && (
            <div className="border border-indigo-500/20 bg-indigo-500/5 p-4"
              style={{ boxShadow: "inset 0 0 40px rgba(129,140,248,0.04)" }}>
              <div className="flex gap-3">
                <BookOpen className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: PASSPORT_COLOR }} strokeWidth={1.5} />
                <p className="font-mono text-xs text-indigo-200/80 leading-relaxed italic">{visitData.welcomeNarrative}</p>
              </div>
            </div>
          )}
          {/* Lore */}
          <div>
            <p className="font-mono text-xs text-muted-foreground/40 mb-2 tracking-widest">LORE THẾ GIỚI</p>
            <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">{visitData.world.lore?.slice(0, 400)}</p>
          </div>
          {/* NPCs */}
          <div>
            <p className="font-mono text-xs text-muted-foreground/40 mb-3 tracking-widest">NHÂN VẬT ({visitData.npcs.length})</p>
            <div className="space-y-2">
              {visitData.npcs.map(npc => (
                <div key={npc.id} className="border border-border/30 bg-card/20 p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-border/30 flex items-center justify-center text-sm">
                    {npc.role === "merchant" ? "💹" : npc.role === "sage" ? "📿" : npc.role === "warlord" ? "⚔️" : "👤"}
                  </div>
                  <div>
                    <div className="font-orbitron text-xs font-bold">{npc.name}</div>
                    <div className="font-mono text-xs text-muted-foreground/50 line-clamp-1">{npc.personality}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Events */}
          {visitData.events.length > 0 && (
            <div>
              <p className="font-mono text-xs text-muted-foreground/40 mb-3 tracking-widest">SỰ KIỆN GẦN ĐÂY</p>
              <div className="space-y-2">
                {visitData.events.map(e => (
                  <div key={e.id} className="border border-border/30 bg-card/20 p-3">
                    <div className="font-orbitron text-xs font-bold">{e.title}</div>
                    <div className="font-mono text-xs text-muted-foreground/60 mt-1 line-clamp-2">{e.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/30 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/dashboard")} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Map className="w-5 h-5 flex-shrink-0" style={{ color: PASSPORT_COLOR }} strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <div className="font-orbitron text-sm font-bold tracking-widest" style={{ color: PASSPORT_COLOR }}>HỘ CHIẾU DU HÀNH</div>
            <div className="font-mono text-xs text-muted-foreground/60">{publicWorlds.length} thế giới · {myPassports.length} hộ chiếu</div>
          </div>
          <button onClick={loadAll} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border/40">
          {([
            { id: "explore" as const, label: "KHÁM PHÁ", icon: Globe, count: publicWorlds.length },
            { id: "mypassports" as const, label: "HỘ CHIẾU CỦA TÔI", icon: Map, count: myPassports.length },
            { id: "manage" as const, label: "QUẢN LÝ KHÁCH", icon: Users, count: myWorlds.length },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 font-orbitron text-xs font-bold tracking-widest transition-all border-b-2"
              style={{
                borderColor: activeTab === tab.id ? PASSPORT_COLOR : "transparent",
                color: activeTab === tab.id ? PASSPORT_COLOR : "rgba(255,255,255,0.35)",
              }}>
              <tab.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {tab.label}
              {tab.count > 0 && (
                <span className="font-mono text-xs px-1.5 rounded-full"
                  style={{ background: `${PASSPORT_COLOR}20`, color: PASSPORT_COLOR }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {fetching ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : <>

          {/* Tab: Explore */}
          {activeTab === "explore" && (
            <div className="space-y-4">
              {/* Buyer char select */}
              {myChars.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground/50">Nhân vật du hành:</span>
                  <select value={requestChar} onChange={e => setRequestChar(e.target.value)}
                    className="bg-card border border-border/40 font-mono text-xs px-2 py-1 text-foreground outline-none">
                    {myChars.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (Lv.{c.level})</option>
                    ))}
                  </select>
                  <select value={visitChar} onChange={e => setVisitChar(e.target.value)}
                    className="bg-card border border-border/40 font-mono text-xs px-2 py-1 text-foreground outline-none">
                    {myChars.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {publicWorlds.length === 0 ? (
                <div className="text-center py-16 font-mono text-xs text-muted-foreground/40">
                  <Globe className="w-10 h-10 mx-auto mb-3 opacity-20" strokeWidth={1} />
                  Chưa có thế giới nào khác để khám phá.
                </div>
              ) : publicWorlds.map(world => {
                const myPassport = myPassports.find(p => p.passport.worldSlug === world.slug);
                const status = myPassport?.passport.status;
                const meta = status ? STATUS_META[status] : null;

                return (
                  <motion.div key={world.id} layout className="border border-border/40 bg-card/30 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-orbitron text-sm font-bold">{world.name}</div>
                        <div className="font-mono text-xs text-muted-foreground/50 mt-0.5">
                          {GENRE_LABELS[world.genre] ?? world.genre}
                        </div>
                      </div>
                      {meta && (
                        <div className="flex items-center gap-1.5 font-mono text-xs flex-shrink-0"
                          style={{ color: meta.color }}>
                          <meta.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                          {meta.label}
                        </div>
                      )}
                    </div>
                    {world.lore && (
                      <p className="font-mono text-xs text-muted-foreground/50 line-clamp-2 leading-relaxed">{world.lore}</p>
                    )}
                    <div className="flex gap-2">
                      {status === "approved" && (
                        <Button size="sm" disabled={loadingVisit || !visitChar} onClick={() => loadVisit(world.slug, visitChar)}
                          className="rounded-none font-orbitron text-xs border h-8 px-3"
                          style={{ borderColor: PASSPORT_COLOR, background: `${PASSPORT_COLOR}20`, color: PASSPORT_COLOR }}>
                          {loadingVisit ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Eye className="w-3 h-3 mr-1.5" />VÀO THĂM</>}
                        </Button>
                      )}
                      {!status && (
                        <button onClick={() => { setRequestWorld(world); setRequestMsg(null); }}
                          className="font-mono text-xs border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 px-3 py-1.5 transition-all flex items-center gap-1.5">
                          <Send className="w-3 h-3" strokeWidth={1.5} /> XIN NHẬP CẢNH
                        </button>
                      )}
                      {status === "banned" && (
                        <span className="font-mono text-xs text-red-400/60">🚫 Bị cấm</span>
                      )}
                    </div>
                    {requestMsg && requestWorld?.slug === world.slug && (
                      <p className="font-mono text-xs" style={{ color: requestMsg.includes("Đã") ? PASSPORT_COLOR : "#f87171" }}>
                        {requestMsg}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Tab: My Passports */}
          {activeTab === "mypassports" && (
            <div className="space-y-3">
              {myPassports.length === 0 ? (
                <div className="text-center py-16 font-mono text-xs text-muted-foreground/40">
                  <Map className="w-10 h-10 mx-auto mb-3 opacity-20" strokeWidth={1} />
                  Chưa có hộ chiếu nào. Khám phá và xin nhập cảnh thế giới khác!
                </div>
              ) : myPassports.map(entry => {
                const { passport, world, char } = entry;
                const meta = STATUS_META[passport.status] ?? STATUS_META.expired;
                return (
                  <div key={passport.id} className="border border-border/40 bg-card/30 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-orbitron text-sm font-bold">{world?.name ?? passport.worldSlug}</div>
                        <div className="font-mono text-xs text-muted-foreground/50 mt-0.5">
                          {char?.name} Lv.{char?.level} · Đã ghé thăm {passport.entryCount} lần · {timeAgo(passport.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-xs flex-shrink-0"
                        style={{ color: meta.color }}>
                        <meta.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {meta.label}
                      </div>
                    </div>
                    {passport.requestNote && (
                      <p className="font-mono text-xs text-muted-foreground/50 italic">
                        Lời xin: "{passport.requestNote}"
                      </p>
                    )}
                    {passport.creatorNote && (
                      <p className="font-mono text-xs" style={{ color: PASSPORT_COLOR, opacity: 0.8 }}>
                        Thần Chủ: "{passport.creatorNote}"
                      </p>
                    )}
                    {passport.status === "approved" && (
                      <button onClick={() => loadVisit(passport.worldSlug, passport.characterId)}
                        className="font-mono text-xs border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 px-3 py-1.5 transition-all flex items-center gap-1.5 mt-2">
                        {loadingVisit ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Eye className="w-3 h-3" strokeWidth={1.5} /> VÀO THĂM</>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab: Manage */}
          {activeTab === "manage" && (
            <div className="space-y-4">
              {myWorlds.length === 0 ? (
                <div className="text-center py-16 font-mono text-xs text-muted-foreground/40">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-20" strokeWidth={1} />
                  Bạn chưa tạo thế giới nào để quản lý khách.
                </div>
              ) : (
                <>
                  {/* World selector */}
                  <div className="flex gap-2 flex-wrap">
                    {myWorlds.map(w => (
                      <button key={w.id} onClick={() => { setSelectedWorld(w); loadVisitors(w.slug); }}
                        className="px-3 py-1.5 font-mono text-xs border transition-all"
                        style={{
                          borderColor: selectedWorld?.slug === w.slug ? PASSPORT_COLOR : "rgba(255,255,255,0.1)",
                          color: selectedWorld?.slug === w.slug ? PASSPORT_COLOR : "rgba(255,255,255,0.4)",
                          background: selectedWorld?.slug === w.slug ? `${PASSPORT_COLOR}15` : "transparent",
                        }}>
                        {w.name}
                      </button>
                    ))}
                  </div>

                  {selectedWorld && (
                    loadingVisitors ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : visitors.length === 0 ? (
                      <div className="text-center py-12 font-mono text-xs text-muted-foreground/40">
                        Chưa có khách nào xin nhập cảnh vào "{selectedWorld.name}".
                      </div>
                    ) : visitors.map(v => {
                      const meta = STATUS_META[v.passport.status] ?? STATUS_META.expired;
                      return (
                        <div key={v.passport.id} className="border border-border/40 bg-card/30 p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-orbitron text-xs font-bold">{v.char.name} <span className="text-muted-foreground font-mono font-normal">Lv.{v.char.level}</span></div>
                              <div className="font-mono text-xs text-muted-foreground/50 mt-0.5">
                                {timeAgo(v.passport.createdAt)} · {v.passport.entryCount} lần ghé
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-xs flex-shrink-0"
                              style={{ color: meta.color }}>
                              <meta.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                              {meta.label}
                            </div>
                          </div>
                          {v.passport.requestNote && (
                            <p className="font-mono text-xs text-muted-foreground/60 italic">
                              "{v.passport.requestNote}"
                            </p>
                          )}
                          <div className="flex gap-2">
                            {v.passport.status === "pending" && (
                              <button onClick={() => handleApprove(v.passport.id, selectedWorld.slug)} disabled={actingId === v.passport.id}
                                className="font-mono text-xs border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 px-3 py-1.5 transition-all flex items-center gap-1.5">
                                {actingId === v.passport.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserCheck className="w-3 h-3" strokeWidth={1.5} /> PHÊ DUYỆT</>}
                              </button>
                            )}
                            {v.passport.status !== "banned" && (
                              <button onClick={() => handleBan(v.passport.id, selectedWorld.slug)} disabled={actingId === v.passport.id}
                                className="font-mono text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-1.5 transition-all flex items-center gap-1.5">
                                {actingId === v.passport.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserX className="w-3 h-3" strokeWidth={1.5} /> CẤM/TRỤC XUẤT</>}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          )}
        </>}
      </div>

      {/* Request modal */}
      <AnimatePresence>
        {requestWorld && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setRequestWorld(null)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="border border-indigo-500/30 bg-card w-full max-w-md p-6 space-y-5"
              style={{ boxShadow: "0 0 60px rgba(129,140,248,0.15)" }}>
              <div>
                <div className="font-orbitron text-sm font-bold" style={{ color: PASSPORT_COLOR }}>
                  XIN NHẬP CẢNH
                </div>
                <div className="font-mono text-xs text-muted-foreground/60 mt-1">{requestWorld.name}</div>
              </div>
              {myChars.length > 1 && (
                <div>
                  <p className="font-mono text-xs text-muted-foreground/50 mb-1.5">Nhân vật du hành</p>
                  <select value={requestChar} onChange={e => setRequestChar(e.target.value)}
                    className="bg-card border border-border/40 font-mono text-xs px-2 py-1.5 text-foreground outline-none w-full">
                    {myChars.map(c => <option key={c.id} value={c.id}>{c.name} (Lv.{c.level})</option>)}
                  </select>
                </div>
              )}
              <div>
                <p className="font-mono text-xs text-muted-foreground/50 mb-1.5">Lời xin nhập cảnh (tuỳ chọn)</p>
                <textarea value={requestNote} onChange={e => setRequestNote(e.target.value)}
                  placeholder="Tôi là hành khách từ... muốn..." maxLength={200} rows={3}
                  className="w-full bg-transparent border-b border-border/30 font-mono text-sm text-foreground placeholder:text-muted-foreground/30 resize-none outline-none pb-1" />
              </div>
              {requestMsg && <p className="font-mono text-xs text-red-400">{requestMsg}</p>}
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setRequestWorld(null)}
                  className="flex-1 rounded-none font-orbitron text-xs h-9 border border-border/40">
                  HUỶ
                </Button>
                <Button disabled={!requestChar || requesting} onClick={handleRequest}
                  className="flex-1 rounded-none font-orbitron text-xs h-9 border"
                  style={{ borderColor: PASSPORT_COLOR, background: `${PASSPORT_COLOR}20`, color: PASSPORT_COLOR }}>
                  {requesting ? <Loader2 className="w-3 h-3 animate-spin" /> : "GỬI ĐƠN"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
