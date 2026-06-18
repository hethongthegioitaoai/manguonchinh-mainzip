import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Crown, Star, Eye, Trophy, ChevronDown, ChevronUp, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Legend {
  id: string; characterName: string; worldName: string; worldSlug: string;
  system: string; level: number; legendTitle: string; epicStory: string;
  votes: number; viewed: number; inducedAt: string;
}
interface EligibilityCheck {
  eligible: boolean; reasons: string[]; alreadyInducted: boolean;
  character: { name: string; level: number; system: string };
}

const WORLD_COLORS: Record<string, string> = {
  cultivation: "#00ffff", cyberpunk: "#ff00ff", wasteland: "#ff6600",
};

export default function LegendPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [legends, setLegends] = useState<Legend[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [inducing, setInducing] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [legendRes, checkRes] = await Promise.all([
        fetch("/api/legends"),
        fetch("/api/legends/check"),
      ]);
      const legendData = await legendRes.json();
      const checkData = await checkRes.json();
      setLegends(Array.isArray(legendData) ? legendData : []);
      if (!checkData.message) setEligibility(checkData);
    } catch {
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleInduct() {
    setInducing(true);
    try {
      const res = await fetch("/api/legends/induct", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "👑 PHONG HUYỀN THOẠI!", description: data.message });
      loadData();
    } finally { setInducing(false); }
  }

  async function handleVote(legendId: string) {
    setVotingId(legendId);
    try {
      const res = await fetch(`/api/legends/vote/${legendId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "⭐ Đã tôn vinh!", description: data.message });
      setVotedIds(prev => new Set([...prev, legendId]));
      setLegends(prev => prev.map(l => l.id === legendId ? { ...l, votes: l.votes + 1 } : l));
    } finally { setVotingId(null); }
  }

  async function toggleExpand(legendId: string) {
    if (expandedId === legendId) { setExpandedId(null); return; }
    setExpandedId(legendId);
    await fetch(`/api/legends/${legendId}`).then(r => r.json()).catch(() => null);
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="font-mono text-cyan-400 animate-pulse">Đang tải điện truyền thuyết...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold text-yellow-400 tracking-widest">ĐIỆN TRUYỀN THUYẾT</h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">Những anh hùng bất tử · Câu chuyện sử thi AI sinh · Cộng đồng tôn vinh</p>
          </div>
        </div>

        {/* Eligibility Check Panel */}
        {eligibility && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className={`border p-5 mb-8 ${eligibility.alreadyInducted ? "border-yellow-400/40 bg-yellow-400/5" : eligibility.eligible ? "border-green-400/40 bg-green-400/5" : "border-border bg-card/30"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-orbitron text-sm font-bold text-yellow-400 mb-2">
                  {eligibility.alreadyInducted ? "👑 Nhân vật của bạn đã được phong Huyền Thoại!" : "⚔️ Điều kiện phong Huyền Thoại"}
                </div>
                <div className="font-mono text-xs text-muted-foreground mb-2">
                  {eligibility.character.name} · {eligibility.character.system ?? "Kiếm Thần"} · Cấp {eligibility.character.level}
                </div>
                {!eligibility.alreadyInducted && (
                  <div className="font-mono text-xs space-y-1">
                    {[
                      { label: "Cấp độ ≥ 50", met: (eligibility.character.level ?? 0) >= 50 },
                      { label: "≥ 1000 chiến thắng", met: eligibility.reasons.some(r => r.includes("chiến thắng")) },
                      { label: "≥ 20 thành tựu", met: eligibility.reasons.some(r => r.includes("thành tựu")) },
                    ].map((cond, i) => (
                      <div key={i} className={`flex items-center gap-2 ${cond.met ? "text-green-400" : "text-muted-foreground"}`}>
                        {cond.met ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 border border-muted-foreground rounded-full" />}
                        {cond.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {eligibility.eligible && !eligibility.alreadyInducted && (
                <Button onClick={handleInduct} disabled={inducing}
                  className="font-orbitron text-xs bg-yellow-400/20 border border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/30 flex-shrink-0">
                  {inducing ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Đang phong...</> : "👑 Phong Huyền Thoại"}
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* Hall of Legends */}
        <div className="space-y-4">
          {legends.length === 0 && (
            <div className="text-center py-16 text-muted-foreground font-mono text-sm">
              Điện Truyền Thuyết còn trống. Hãy là người đầu tiên được phong Huyền Thoại!
            </div>
          )}

          {legends.map((legend, i) => {
            const color = WORLD_COLORS[legend.worldSlug] ?? "#a855f7";
            const isExpanded = expandedId === legend.id;
            const hasVoted = votedIds.has(legend.id);
            return (
              <motion.div key={legend.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="border overflow-hidden" style={{ borderColor: `${color}40` }}
              >
                {/* Rank badge */}
                <div className="px-5 pt-4 pb-0 flex items-start justify-between gap-4 cursor-pointer" onClick={() => toggleExpand(legend.id)}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 flex items-center justify-center border flex-shrink-0 relative" style={{ borderColor: `${color}50`, backgroundColor: `${color}10` }}>
                      <Crown className="w-6 h-6" style={{ color }} />
                      {i < 3 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold text-black" style={{ backgroundColor: ["#f59e0b", "#9ca3af", "#b45309"][i] }}>
                          {i + 1}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-orbitron text-sm font-bold" style={{ color }}>{legend.legendTitle}</div>
                      <div className="font-mono text-xs text-muted-foreground">{legend.characterName} · {legend.system} · Cấp {legend.level}</div>
                      <div className="font-mono text-xs text-muted-foreground/60">{legend.worldName} · {new Date(legend.inducedAt).toLocaleDateString("vi-VN")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center font-mono text-xs">
                      <div className="text-yellow-400 font-bold">{legend.votes}</div>
                      <div className="text-muted-foreground">Phiếu</div>
                    </div>
                    <div className="text-center font-mono text-xs">
                      <div className="text-cyan-400 font-bold">{legend.viewed}</div>
                      <div className="text-muted-foreground">Lượt xem</div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 py-4 border-t" style={{ borderColor: `${color}20` }}>
                        <div className="font-mono text-xs text-muted-foreground italic leading-relaxed mb-4 border-l-2 pl-4" style={{ borderColor: color }}>
                          {legend.epicStory}
                        </div>
                        <Button size="sm" onClick={() => handleVote(legend.id)} disabled={votingId === legend.id || hasVoted}
                          className={`font-orbitron text-xs ${hasVoted ? "opacity-50 cursor-not-allowed" : ""}`}
                          style={{ backgroundColor: `${color}20`, border: `1px solid ${color}50`, color }}
                        >
                          {votingId === legend.id ? <Loader2 className="w-3 h-3 animate-spin" /> : hasVoted ? "⭐ Đã tôn vinh" : "⭐ Tôn vinh anh hùng"}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
