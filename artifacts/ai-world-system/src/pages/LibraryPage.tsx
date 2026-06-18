import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, RefreshCw, Loader2, BookOpen, Search,
  ChevronDown, ChevronUp, Zap, Sparkles, Star,
  BookMarked, FlaskConical, Swords, Ghost, Globe2,
} from "lucide-react";

const WORLDS = [
  { slug: "cultivation", label: "TU TIÊN",  color: "#06b6d4" },
  { slug: "cyberpunk",   label: "CYBERPUNK", color: "#a855f7" },
  { slug: "wasteland",   label: "HOANG PHẾ", color: "#ef4444" },
] as const;
type WorldSlug = "cultivation" | "cyberpunk" | "wasteland";

const RARITY_COLOR: Record<string, string> = {
  common: "#9ca3af", uncommon: "#22c55e", rare: "#06b6d4", epic: "#a855f7", legendary: "#f59e0b",
};
const RARITY_LABEL: Record<string, string> = {
  common: "Phổ Thông", uncommon: "Không Phổ", rare: "Hiếm", epic: "Sử Thi", legendary: "Huyền Thoại",
};

const CAT_ICON: Record<string, React.ReactNode> = {
  history:  <BookMarked className="w-3.5 h-3.5" />,
  skills:   <Swords className="w-3.5 h-3.5" />,
  items:    <FlaskConical className="w-3.5 h-3.5" />,
  monsters: <Ghost className="w-3.5 h-3.5" />,
  realms:   <Globe2 className="w-3.5 h-3.5" />,
};
const CAT_LABEL: Record<string, string> = {
  history: "Lịch Sử", skills: "Kỹ Năng", items: "Vật Phẩm", monsters: "Yêu Quái", realms: "Cõi Giới",
};
const CAT_EMOJI: Record<string, string> = {
  history: "📜", skills: "⚔️", items: "💎", monsters: "👹", realms: "🌌",
};

interface KnowledgeEntry {
  id: string; worldSlug: string; title: string; category: string; content: string;
  aiGenerated: number; discoveredBy: string | null; rarity: string;
  unlockCost: number; timesStudied: number; tags: string[]; createdAt: string;
}
interface CategoryInfo { id: string; label: string; icon: string; }

function EntryCard({ entry, expanded, onToggle, onResearch, researchLoading }: {
  entry: KnowledgeEntry; expanded: boolean; onToggle: () => void;
  onResearch: (id: string) => void; researchLoading: boolean;
}) {
  const rc  = RARITY_COLOR[entry.rarity] ?? "#9ca3af";
  const rl  = RARITY_LABEL[entry.rarity] ?? entry.rarity;

  return (
    <motion.div layout className="border rounded-xl overflow-hidden bg-gray-900/40 transition-all"
      style={{ borderColor: rc + "40" }}>
      <button className="w-full text-left p-4" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-lg">{CAT_EMOJI[entry.category] ?? "📄"}</span>
              <span className="font-bold text-white truncate">{entry.title}</span>
              {entry.aiGenerated === 1 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-900/40 border border-purple-700/40 text-purple-400">AI</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2 py-0.5 rounded-full border font-bold"
                style={{ color: rc, borderColor: rc + "55", background: rc + "11" }}>
                {rl}
              </span>
              <span className="text-gray-500">{CAT_LABEL[entry.category] ?? entry.category}</span>
              <span className="text-gray-600">· 📖 {entry.timesStudied} lần nghiên cứu</span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {entry.unlockCost > 0 && (
              <span className="text-xs text-yellow-500 font-bold">{entry.unlockCost}g</span>
            )}
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t pt-3 space-y-3" style={{ borderColor: rc + "30" }}>
              <p className="text-sm text-gray-300 leading-relaxed">{entry.content}</p>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-1.5 flex-wrap">
                  {(entry.tags as string[]).filter(t => !["common","uncommon","rare","epic","legendary"].includes(t)).map((tag, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">#{tag}</span>
                  ))}
                </div>
                <button onClick={() => onResearch(entry.id)} disabled={researchLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-40"
                  style={{ borderColor: rc + "60", color: rc, background: rc + "11" }}>
                  {researchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
                  NGHIÊN CỨU
                </button>
              </div>
              {entry.discoveredBy && (
                <div className="text-xs text-gray-600">Nguồn: {entry.discoveredBy}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function LibraryPage() {
  const [, setLocation] = useLocation();
  const [activeWorld, setActiveWorld] = useState<WorldSlug>("cultivation");
  const [data, setData] = useState<{
    entries: KnowledgeEntry[]; allEntries: KnowledgeEntry[];
    stats: Record<string, number>; totalStudied: number;
    categories: CategoryInfo[]; rarities: any[];
  } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [activeCategory, setActiveCat]= useState<string>("all");
  const [searchQ, setSearchQ]         = useState("");
  const [msg, setMsg]                 = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [genLoading, setGenLoading]   = useState(false);
  const [researchLoading, setResearchLoading] = useState<string | null>(null);
  const [genCategory, setGenCategory] = useState("history");

  const worldColor = WORLDS.find(w => w.slug === activeWorld)?.color ?? "#06b6d4";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQ) params.set("q", searchQ);
      const r = await fetch(`/api/library/${activeWorld}?${params}`, { credentials: "include" });
      setData(await r.json());
    } catch { setData(null); }
    setLoading(false);
  }, [activeWorld, searchQ]);

  useEffect(() => { loadData(); }, [loadData]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 5000); };

  const act = async (url: string, method: string, setL: (v: boolean) => void, body?: unknown) => {
    setL(true);
    try {
      const r = await fetch(url, {
        method, credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!r.ok) flash(j.error ?? "Có lỗi"); else { flash(j.message ?? "Hoàn thành"); loadData(); }
    } catch { flash("Có lỗi xảy ra"); }
    setL(false);
  };

  const handleResearch = async (entryId: string) => {
    setResearchLoading(entryId);
    try {
      const r = await fetch(`/api/library/research/${entryId}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: "player-demo", characterName: "Học Giả" }),
      });
      const j = await r.json();
      flash(j.message ?? "Hoàn thành");
      if (!j.alreadyStudied) loadData();
    } catch { flash("Có lỗi khi nghiên cứu"); }
    setResearchLoading(null);
  };

  const allEntries = data?.allEntries ?? [];
  const stats      = data?.stats ?? {};
  const totalEntries = allEntries.length;
  const totalStudied = data?.totalStudied ?? 0;

  /* Filter by category */
  const filtered = (data?.entries ?? []).filter(e =>
    activeCategory === "all" || e.category === activeCategory
  );

  const categories = ["all", "history", "skills", "items", "monsters", "realms"];

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" style={{ color: worldColor }} />
              <span className="font-bold tracking-wider" style={{ color: worldColor }}>THƯ VIỆN CỔ ĐẠI</span>
            </div>
          </div>
          <button onClick={loadData} disabled={loading} className="text-gray-400 hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* World selector */}
        <div className="flex gap-2">
          {WORLDS.map(w => (
            <button key={w.slug} onClick={() => { setActiveWorld(w.slug as WorldSlug); setActiveCat("all"); }}
              className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wider border transition-all"
              style={activeWorld === w.slug
                ? { background: w.color + "22", borderColor: w.color, color: w.color }
                : { borderColor: "#374151", color: "#6b7280" }}>
              {w.label}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <BookOpen className="w-4 h-4" />,  label: "Tổng Mục",    value: totalEntries, color: worldColor },
            { icon: <Star className="w-4 h-4" />,      label: "Đã Nghiên Cứu", value: totalStudied, color: "#f59e0b" },
            { icon: <Sparkles className="w-4 h-4" />,  label: "AI Tạo Ra",   value: allEntries.filter(e=>e.aiGenerated===1).length, color: "#a855f7" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-3 text-center">
              <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
              <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
              <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => act(`/api/library/seed/${activeWorld}`, "POST", setSeedLoading)}
            disabled={seedLoading}
            className="py-2.5 px-3 rounded-lg text-xs font-bold border border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {seedLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookMarked className="w-3.5 h-3.5" />}
            TẠO LORE MẶC ĐỊNH
          </button>
          <div className="flex gap-1.5">
            <select value={genCategory} onChange={e => setGenCategory(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-2 text-xs text-gray-300 w-full">
              {categories.filter(c => c !== "all").map(c => (
                <option key={c} value={c}>{CAT_EMOJI[c]} {CAT_LABEL[c]}</option>
              ))}
            </select>
            <button onClick={() => act(`/api/library/generate/${activeWorld}`, "POST", setGenLoading, { category: genCategory })}
              disabled={genLoading}
              className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold border border-purple-700/50 text-purple-400 hover:bg-purple-900/20 transition-all disabled:opacity-40 flex items-center gap-1">
              {genLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              AI
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Tìm kiếm tri thức..."
            className="w-full bg-gray-900/60 border border-gray-700/50 rounded-xl px-4 py-2.5 pl-9 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
          />
        </div>

        {/* Flash */}
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-cyan-900/30 border border-cyan-700/50 rounded-lg px-4 py-2 text-cyan-300 text-sm text-center">
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category filter */}
        {allEntries.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {categories.map(cat => {
              const cnt = cat === "all" ? totalEntries : (stats[cat] ?? 0);
              return (
                <button key={cat} onClick={() => setActiveCat(cat)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5"
                  style={activeCategory === cat
                    ? { background: worldColor + "22", borderColor: worldColor, color: worldColor }
                    : { borderColor: "#374151", color: "#6b7280" }}>
                  {cat !== "all" && CAT_ICON[cat]}
                  {cat === "all" ? `TẤT CẢ (${cnt})` : `${CAT_LABEL[cat]} (${cnt})`}
                </button>
              );
            })}
          </div>
        )}

        {/* Rarity legend */}
        {allEntries.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {Object.entries(RARITY_COLOR).map(([r, c]) => (
              <div key={r} className="flex items-center gap-1 text-xs" style={{ color: c }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                {RARITY_LABEL[r]}
              </div>
            ))}
          </div>
        )}

        {/* Entry list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Thư viện trống rỗng.</p>
            <p className="text-xs mt-1">Nhấn <span className="text-cyan-400">"TẠO LORE MẶC ĐỊNH"</span> để khởi tạo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <span className="text-xs text-gray-500 uppercase tracking-wider">{filtered.length} tri thức</span>
            {filtered.map(entry => (
              <EntryCard key={entry.id} entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                onResearch={handleResearch}
                researchLoading={researchLoading === entry.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
