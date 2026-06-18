import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Award, CheckCircle2, Lock, Sparkles } from "lucide-react";

const RARITY_COLOR: Record<string, string> = {
  common: "#94a3b8", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b",
};
const RARITY_LABEL: Record<string, string> = {
  common: "Thường", uncommon: "Hiếm", rare: "Quý", epic: "Sử Thi", legendary: "Huyền Thoại",
};
const RARITY_ORDER: Record<string, number> = { legendary: 4, epic: 3, rare: 2, uncommon: 1, common: 0 };

interface TitleInfo {
  key: string; name: string; description: string; icon: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  unlocked: boolean; equipped: boolean; unlockedAt: string | null;
}
interface TitlesData {
  titles: TitleInfo[];
  equippedTitle: TitleInfo | null;
  newlyGranted: string[];
}
interface CharInfo { id: string; name: string; level: number; stats: any; }

export default function TitlesPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selectedCharId, setSelectedCharId] = useState("");
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [toastedNew, setToastedNew] = useState<Set<string>>(new Set());

  const { data: chars = [] } = useQuery<CharInfo[]>({
    queryKey: ["/api/titles/my-chars"],
    queryFn: async () => {
      const r = await fetch("/api/titles/my-chars", { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });

  const activeCharId = selectedCharId || chars[0]?.id || "";

  const { data, isLoading } = useQuery<TitlesData>({
    queryKey: ["/api/titles", activeCharId],
    enabled: !!activeCharId,
    queryFn: async () => {
      const r = await fetch(`/api/titles/${activeCharId}`, { credentials: "include" });
      return r.ok ? r.json() : { titles: [], equippedTitle: null, newlyGranted: [] };
    },
  });

  useEffect(() => {
    if (data?.newlyGranted?.length) {
      data.newlyGranted.forEach(key => {
        if (!toastedNew.has(key)) {
          const def = data.titles.find(t => t.key === key);
          if (def) toast.success(`🎖️ Danh hiệu mới: ${def.icon} ${def.name}!`);
          setToastedNew(prev => new Set([...prev, key]));
        }
      });
    }
  }, [data?.newlyGranted]);

  const equipMutation = useMutation({
    mutationFn: async ({ charId, titleKey }: { charId: string; titleKey: string }) => {
      const r = await fetch(`/api/titles/equip/${charId}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleKey }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (_, { titleKey }) => {
      const def = data?.titles.find(t => t.key === titleKey);
      toast.success(`Đã trang bị: ${def?.icon ?? ""} ${def?.name ?? titleKey}`);
      queryClient.invalidateQueries({ queryKey: ["/api/titles", activeCharId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unequipMutation = useMutation({
    mutationFn: async (charId: string) => {
      const r = await fetch(`/api/titles/unequip/${charId}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Đã gỡ danh hiệu");
      queryClient.invalidateQueries({ queryKey: ["/api/titles", activeCharId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const displayTitles = (data?.titles ?? []).filter(t => {
    if (filter === "unlocked") return t.unlocked;
    if (filter === "locked") return !t.unlocked;
    return true;
  });

  const unlockedCount = data?.titles.filter(t => t.unlocked).length ?? 0;
  const totalCount = data?.titles.length ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Courier New', monospace" }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-cyan-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              <h1 className="text-xl font-bold tracking-widest text-yellow-400">HỆ THỐNG DANH HIỆU</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wider">CHỨNG NHẬN HÀNH TRÌNH — KHẮC TÊN LỊCH SỬ</p>
          </div>
          {activeCharId && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground tracking-wider">DANH HIỆU ĐÃ MỞ</div>
              <div className="text-lg font-bold text-yellow-400 font-mono">{unlockedCount}<span className="text-muted-foreground text-sm">/{totalCount}</span></div>
            </div>
          )}
        </div>

        {/* Equipped title banner */}
        {data?.equippedTitle && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 border flex items-center gap-4"
            style={{ borderColor: `${RARITY_COLOR[data.equippedTitle.rarity]}60`, backgroundColor: `${RARITY_COLOR[data.equippedTitle.rarity]}08` }}
          >
            <div className="text-3xl">{data.equippedTitle.icon}</div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground tracking-widest mb-0.5">ĐANG TRANG BỊ</div>
              <div className="font-bold text-base font-mono" style={{ color: RARITY_COLOR[data.equippedTitle.rarity] }}>
                {data.equippedTitle.name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{data.equippedTitle.description}</div>
            </div>
            <button
              onClick={() => unequipMutation.mutate(activeCharId)}
              className="text-xs font-mono text-muted-foreground border border-border px-3 py-1.5 hover:text-red-400 hover:border-red-400/30 transition-all"
            >
              GỠ BỎ
            </button>
          </motion.div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {chars.length > 1 && (
            <select
              value={selectedCharId}
              onChange={e => setSelectedCharId(e.target.value)}
              className="bg-card border border-border text-xs font-mono px-3 py-1.5 text-foreground focus:outline-none focus:border-yellow-400/50"
            >
              {chars.map(c => <option key={c.id} value={c.id}>{c.name} (Lv.{c.level})</option>)}
            </select>
          )}
          <div className="flex gap-1">
            {(["all", "unlocked", "locked"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-mono tracking-wider border transition-all ${filter === f ? "border-yellow-400/50 text-yellow-400 bg-yellow-400/5" : "border-border text-muted-foreground hover:border-border"}`}
              >
                {f === "all" ? "TẤT CẢ" : f === "unlocked" ? "ĐÃ CÓ" : "CHƯA CÓ"}
              </button>
            ))}
          </div>
        </div>

        {/* Titles grid */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-16 text-sm tracking-widest">ĐANG KIỂM TRA ĐIỀU KIỆN...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnimatePresence>
              {displayTitles.map((title, i) => {
                const rc = RARITY_COLOR[title.rarity];
                return (
                  <motion.div
                    key={title.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={`relative border p-4 transition-all duration-200 ${title.unlocked ? "bg-card/60" : "bg-card/20 opacity-60"}`}
                    style={{
                      borderColor: title.unlocked ? `${rc}50` : "#ffffff10",
                      borderLeftColor: title.unlocked ? rc : "#ffffff15",
                      borderLeftWidth: 2,
                    }}
                  >
                    {/* New badge */}
                    {data?.newlyGranted.includes(title.key) && (
                      <span className="absolute top-2 right-2 text-xs font-mono px-1.5 py-0.5 bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">NEW</span>
                    )}
                    {/* Equipped badge */}
                    {title.equipped && (
                      <span className="absolute top-2 right-2 text-xs font-mono px-1.5 py-0.5 bg-cyan-400/20 text-cyan-400 border border-cyan-400/30">⚡ ĐANG ĐEO</span>
                    )}

                    <div className="flex items-start gap-3">
                      <div className={`text-2xl flex-shrink-0 ${!title.unlocked ? "grayscale opacity-40" : ""}`}>{title.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-sm font-mono" style={{ color: title.unlocked ? rc : "#64748b" }}>
                            {title.name}
                          </span>
                          <span className="text-xs px-1 py-0.5 border" style={{ color: rc, borderColor: `${rc}30`, backgroundColor: `${rc}08` }}>
                            {RARITY_LABEL[title.rarity]}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{title.description}</p>
                        {title.unlocked && title.unlockedAt && (
                          <p className="text-xs text-muted-foreground/50 mt-1">
                            Mở: {new Date(title.unlockedAt).toLocaleDateString("vi-VN")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    {title.unlocked && !title.equipped && (
                      <button
                        onClick={() => equipMutation.mutate({ charId: activeCharId, titleKey: title.key })}
                        disabled={equipMutation.isPending}
                        className="mt-3 w-full py-1.5 text-xs font-mono border transition-all disabled:opacity-50"
                        style={{ borderColor: `${rc}40`, color: rc }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${rc}12`)}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        TRANG BỊ
                      </button>
                    )}
                    {!title.unlocked && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/40">
                        <Lock className="w-3 h-3" /> Chưa mở khóa
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
