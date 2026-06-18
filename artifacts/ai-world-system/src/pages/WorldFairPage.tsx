import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Star, ShoppingBag, Globe, Ticket, Trophy, Clock, Users, Sparkles, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface FairBooth {
  id: string;
  worldSlug: string;
  worldName: string;
  boothName: string;
  description: string;
  aiNarrative: string;
  entryFee: number;
  votes: number;
  visits: number;
  featured: boolean;
  ownerName: string;
}

interface WorldFair {
  id: string;
  season: number;
  theme: string;
  status: string;
  endsAt: string;
  totalVisits: number;
  winnerWorldSlug: string | null;
}

export default function WorldFairPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [fair, setFair] = useState<WorldFair | null>(null);
  const [booths, setBooths] = useState<FairBooth[]>([]);
  const [history, setHistory] = useState<WorldFair[]>([]);
  const [myVisits, setMyVisits] = useState<{ boothId: string; voted: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"fair" | "history">("fair");
  const [visitingId, setVisitingId] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [selectedBooth, setSelectedBooth] = useState<FairBooth | null>(null);
  const [registering, setRegistering] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    loadData();
  }, [user]);

  useEffect(() => {
    if (!fair) return;
    const interval = setInterval(() => {
      const diff = new Date(fair.endsAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Đã kết thúc"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${d}n ${h}g ${m}p`);
    }, 1000);
    return () => clearInterval(interval);
  }, [fair]);

  async function loadData() {
    setLoading(true);
    try {
      const [fairRes, histRes, visitRes] = await Promise.all([
        fetch("/api/fair/current"),
        fetch("/api/fair/history"),
        fetch("/api/fair/my-visits"),
      ]);
      const fairData = await fairRes.json();
      const histData = await histRes.json();
      const visitData = await visitRes.json();
      setFair(fairData.fair);
      setBooths(fairData.booths ?? []);
      setHistory(Array.isArray(histData) ? histData : []);
      setMyVisits(Array.isArray(visitData) ? visitData : []);
    } catch {
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu hội chợ", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleVisit(booth: FairBooth) {
    setVisitingId(booth.id);
    try {
      const res = await fetch(`/api/fair/visit/${booth.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "✅ Đã tham quan!", description: data.message });
      setSelectedBooth({ ...booth, aiNarrative: data.booth?.aiNarrative ?? booth.aiNarrative, visits: (booth.visits ?? 0) + 1 });
      loadData();
    } finally {
      setVisitingId(null);
    }
  }

  async function handleVote(boothId: string) {
    setVotingId(boothId);
    try {
      const res = await fetch(`/api/fair/vote/${boothId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "⭐ Bình chọn thành công!", description: data.message });
      loadData();
    } finally {
      setVotingId(null);
    }
  }

  async function handleRegister() {
    setRegistering(true);
    try {
      const res = await fetch("/api/fair/register", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "🎪 Đã đăng ký!", description: data.message });
      loadData();
    } finally {
      setRegistering(false);
    }
  }

  const isVisited = (boothId: string) => myVisits.some(v => v.boothId === boothId);
  const isVoted = (boothId: string) => myVisits.some(v => v.boothId === boothId && v.voted);

  const WORLD_COLORS: Record<string, string> = {
    cultivation: "#00ffff",
    cyberpunk: "#ff00ff",
    wasteland: "#ff6600",
  };
  const getColor = (slug: string) => WORLD_COLORS[slug] ?? "#a855f7";

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="font-mono text-cyan-400 animate-pulse">Đang tải hội chợ...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold text-cyan-400 tracking-widest">HỘI CHỢ THẾ GIỚI</h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">Giao thương — Văn hóa — Bình chọn — Thế giới xuất sắc nhất</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["fair", "history"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-orbitron text-xs px-4 py-2 border transition-all ${activeTab === tab ? "border-cyan-400 text-cyan-400 bg-cyan-400/10" : "border-border text-muted-foreground hover:border-cyan-400/50"}`}
            >
              {tab === "fair" ? "🎪 HỘI CHỢ HIỆN TẠI" : "📜 LỊCH SỬ"}
            </button>
          ))}
        </div>

        {activeTab === "fair" && fair && (
          <div className="space-y-6">
            {/* Fair Info Banner */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="border border-cyan-400/30 bg-cyan-400/5 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-orbitron text-lg font-bold text-cyan-400">Mùa {fair.season} — {fair.theme}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1">Tham quan gian hàng các thế giới · Bình chọn thế giới yêu thích · Nhận EXP</div>
                </div>
                <div className="flex gap-6 font-mono text-xs">
                  <div className="text-center">
                    <div className="text-cyan-400 font-bold text-lg">{booths.length}</div>
                    <div className="text-muted-foreground">Gian hàng</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-400 font-bold text-lg">{fair.totalVisits}</div>
                    <div className="text-muted-foreground">Lượt thăm</div>
                  </div>
                  <div className="text-center">
                    <div className="text-purple-400 font-bold text-lg">{timeLeft}</div>
                    <div className="text-muted-foreground">Còn lại</div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-3 flex-wrap">
                <Button size="sm" onClick={handleRegister} disabled={registering} className="font-orbitron text-xs bg-cyan-400/20 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/30">
                  {registering ? "Đang đăng ký..." : "🏪 Đăng ký gian hàng"}
                </Button>
                <div className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                  <Ticket className="w-3 h-3" /> Phí vào cửa: 50 gold/gian
                </div>
              </div>
            </motion.div>

            {/* Booth Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {booths.map((booth, i) => {
                const color = getColor(booth.worldSlug);
                const visited = isVisited(booth.id);
                const voted = isVoted(booth.id);
                return (
                  <motion.div key={booth.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="border bg-card/50 p-5 cursor-pointer hover:bg-card/70 transition-all relative overflow-hidden"
                    style={{ borderColor: `${color}40` }}
                    onClick={() => setSelectedBooth(selectedBooth?.id === booth.id ? null : booth)}
                  >
                    {booth.featured && (
                      <div className="absolute top-2 right-2 font-mono text-xs border px-2 py-0.5" style={{ borderColor: `${color}60`, color }}>NỔI BẬT</div>
                    )}
                    {visited && (
                      <div className="absolute top-2 left-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 flex items-center justify-center border flex-shrink-0" style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}>
                        <Globe className="w-5 h-5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-orbitron text-sm font-bold" style={{ color }}>{booth.boothName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{booth.worldName}</div>
                        {booth.ownerName !== "Hệ Thống" && (
                          <div className="font-mono text-xs text-muted-foreground/60">👤 {booth.ownerName}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-4 mt-3 font-mono text-xs text-muted-foreground">
                      <span><Users className="w-3 h-3 inline mr-1" />{booth.visits} lượt</span>
                      <span><Star className="w-3 h-3 inline mr-1 text-yellow-400" />{booth.votes} phiếu</span>
                      <span><Ticket className="w-3 h-3 inline mr-1" />{booth.entryFee} gold</span>
                    </div>

                    <AnimatePresence>
                      {selectedBooth?.id === booth.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="mt-4 overflow-hidden"
                        >
                          {booth.aiNarrative && (
                            <div className="font-mono text-xs text-muted-foreground border-t pt-3 mb-3 italic" style={{ borderColor: `${color}20` }}>
                              "{booth.aiNarrative}"
                            </div>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            {!visited ? (
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); handleVisit(booth); }}
                                disabled={visitingId === booth.id}
                                className="font-orbitron text-xs"
                                style={{ backgroundColor: `${color}20`, border: `1px solid ${color}50`, color }}
                              >
                                {visitingId === booth.id ? "Đang vào..." : `🎪 Tham quan (-${booth.entryFee} gold)`}
                              </Button>
                            ) : (
                              <span className="font-mono text-xs text-green-400">✅ Đã tham quan</span>
                            )}
                            {visited && !voted && (
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); handleVote(booth.id); }}
                                disabled={votingId === booth.id}
                                className="font-orbitron text-xs bg-yellow-400/20 border border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/30"
                              >
                                {votingId === booth.id ? "Đang bình chọn..." : "⭐ Bình chọn"}
                              </Button>
                            )}
                            {voted && <span className="font-mono text-xs text-yellow-400">⭐ Đã bình chọn</span>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {booths.length === 0 && (
              <div className="text-center py-16 text-muted-foreground font-mono text-sm">
                Chưa có gian hàng nào. Hội chợ đang chuẩn bị...
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {history.length === 0 && (
              <div className="text-center py-16 text-muted-foreground font-mono text-sm">
                Chưa có hội chợ nào kết thúc.
              </div>
            )}
            {history.map((h, i) => (
              <motion.div key={h.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="border border-border bg-card/30 p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 flex items-center justify-center border border-yellow-400/40 bg-yellow-400/10">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <div className="font-orbitron text-sm font-bold">Mùa {h.season} — {h.theme}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    Kết thúc: {new Date(h.endsAt).toLocaleDateString("vi-VN")}
                    {h.winnerWorldSlug && ` · 🏆 Thắng: ${h.winnerWorldSlug}`}
                  </div>
                </div>
                <div className="font-mono text-xs text-muted-foreground">{h.totalVisits} lượt thăm</div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
