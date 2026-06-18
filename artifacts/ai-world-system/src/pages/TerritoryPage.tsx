import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Map, Users, Coins, Shield, RefreshCw, Loader2,
  ChevronDown, ChevronUp, Sprout, Anchor, Star, Scroll,
} from "lucide-react";

const WORLDS = [
  { slug: "cultivation", label: "TU TIÊN",  color: "#06b6d4" },
  { slug: "cyberpunk",   label: "CYBERPUNK", color: "#a855f7" },
  { slug: "wasteland",   label: "HOANG PHẾ", color: "#ef4444" },
] as const;
type WorldSlug = "cultivation" | "cyberpunk" | "wasteland";

interface Resource { id: string; resourceType: string; amount: number }
interface TerritoryLog { id: string; event: string; createdAt: string }
interface OwnerFaction { id: string; name: string; type: string; treasury: number }
interface Territory {
  id: string; worldSlug: string; name: string; type: string;
  ownerFactionId: string | null; population: number; prosperity: number; security: number;
  lastHarvestAt: string | null; createdAt: string;
  typeLabel: string; typeIcon: string;
  ownerFaction: OwnerFaction | null;
  resources: Resource[];
  logs: TerritoryLog[];
}
interface TerritoryResponse { territories: Territory[] }

const TYPE_COLOR: Record<string, string> = {
  village:  "#22c55e",
  district: "#06b6d4",
  city:     "#f59e0b",
  farmland: "#84cc16",
  harbor:   "#38bdf8",
};

const RESOURCE_ICON: Record<string, string> = {
  "thực phẩm": "🌾", "cá": "🐟", "gỗ": "🪵",
  "công cụ": "🔧", "vàng": "💰", "dân công": "👷",
};

function ProsperityBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <motion.div className="h-full rounded-full" style={{ background: color }}
        initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.6 }} />
    </div>
  );
}

export default function TerritoryPage() {
  const [, setLocation] = useLocation();
  const [activeWorld, setActiveWorld] = useState<WorldSlug>("cultivation");
  const [data, setData] = useState<TerritoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [harvestLoading, setHarvestLoading] = useState(false);
  const [seedMsg, setSeedMsg] = useState<{ seeded: number; message: string } | null>(null);
  const [harvestMsg, setHarvestMsg] = useState<{ harvested: number; message: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const worldColor = WORLDS.find(w => w.slug === activeWorld)?.color ?? "#06b6d4";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/territories/${activeWorld}`, { credentials: "include" });
      if (r.ok) setData(await r.json());
    } finally { setLoading(false); }
  }, [activeWorld]);

  useEffect(() => { load(); }, [load]);

  async function seedTerritories() {
    setSeedLoading(true); setSeedMsg(null);
    try {
      const r = await fetch(`/api/territories/seed/${activeWorld}`, { method: "POST", credentials: "include" });
      if (r.ok) { setSeedMsg(await r.json()); await load(); }
    } finally { setSeedLoading(false); }
  }

  async function runHarvest() {
    setHarvestLoading(true); setHarvestMsg(null);
    try {
      const r = await fetch(`/api/territories/harvest/${activeWorld}`, { method: "POST", credentials: "include" });
      if (r.ok) { setHarvestMsg(await r.json()); await load(); }
    } finally { setHarvestLoading(false); }
  }

  const terrs = data?.territories ?? [];
  const totalPop = terrs.reduce((s, t) => s + t.population, 0);
  const avgProsperity = terrs.length ? Math.round(terrs.reduce((s, t) => s + t.prosperity, 0) / terrs.length) : 0;
  const ownedCount = terrs.filter(t => t.ownerFactionId).length;

  return (
    <div className="min-h-screen bg-black text-white font-mono">

      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/dashboard")} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${worldColor}22`, border: `1px solid ${worldColor}40` }}>
          <Map size={14} style={{ color: worldColor }} />
        </div>
        <div>
          <div className="text-sm font-bold tracking-widest" style={{ color: worldColor }}>LÃNH THỔ</div>
          <div className="text-xs text-gray-600">Sở hữu · thu hoạch · thịnh vượng</div>
        </div>
        <button onClick={load} disabled={loading}
          className="ml-auto p-1.5 rounded-lg border border-gray-800 text-gray-500 hover:text-white transition-colors">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {/* World tabs */}
      <div className="flex border-b border-gray-900">
        {WORLDS.map(w => (
          <button key={w.slug} onClick={() => setActiveWorld(w.slug)}
            className="flex-1 py-2.5 text-xs font-bold tracking-widest transition-all relative"
            style={{ color: activeWorld === w.slug ? w.color : "#4b5563" }}>
            {w.label}
            {activeWorld === w.slug && (
              <motion.div layoutId="wt-terr" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: w.color }} />
            )}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Lãnh Thổ",    value: terrs.length,    icon: <Map size={14} />,     color: worldColor },
            { label: "Dân Số",       value: totalPop.toLocaleString(), icon: <Users size={14} />,   color: "#22c55e" },
            { label: "Thịnh Vượng",  value: `${avgProsperity}%`,  icon: <Star size={14} />,    color: "#f59e0b" },
            { label: "Có Chủ",       value: ownedCount,      icon: <Shield size={14} />,  color: "#a855f7" },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-gray-800 bg-gray-900/40 p-2.5 text-center">
              <div className="flex items-center justify-center mb-1" style={{ color: card.color }}>{card.icon}</div>
              <div className="text-base font-bold" style={{ color: card.color }}>{card.value}</div>
              <div className="text-xs text-gray-600 mt-0.5 leading-tight">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={seedTerritories} disabled={seedLoading}
            className="py-2.5 rounded-xl text-xs font-bold tracking-widest flex items-center justify-center gap-2 transition-all"
            style={{ background: `${worldColor}22`, border: `1px solid ${worldColor}60`, color: worldColor }}>
            {seedLoading ? <><Loader2 size={14} className="animate-spin" />Đang khởi tạo...</> : <><Map size={14} />Khởi Tạo Lãnh Thổ</>}
          </button>
          <button onClick={runHarvest} disabled={harvestLoading}
            className="py-2.5 rounded-xl text-xs font-bold tracking-widest flex items-center justify-center gap-2 transition-all"
            style={{ background: "#22c55e22", border: "1px solid #22c55e60", color: "#22c55e" }}>
            {harvestLoading ? <><Loader2 size={14} className="animate-spin" />Đang thu...</> : <><Sprout size={14} />Thu Hoạch</>}
          </button>
        </div>

        {/* Action results */}
        <AnimatePresence>
          {seedMsg && (
            <motion.div key="seed-msg" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-xs">
              <div className="font-bold" style={{ color: seedMsg.seeded > 0 ? worldColor : "#6b7280" }}>
                {seedMsg.seeded > 0 ? `✓ ${seedMsg.message}` : `ℹ ${seedMsg.message}`}
              </div>
            </motion.div>
          )}
          {harvestMsg && (
            <motion.div key="harvest-msg" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-xs">
              <div className="font-bold" style={{ color: harvestMsg.harvested > 0 ? "#22c55e" : "#6b7280" }}>
                {harvestMsg.harvested > 0 ? `✓ ${harvestMsg.message}` : `ℹ ${harvestMsg.message}`}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Territory list */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-600">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs">Đang tải...</span>
          </div>
        )}

        {!loading && terrs.length === 0 && (
          <div className="text-center py-16 text-gray-700">
            <Map size={32} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm">Chưa có lãnh thổ nào</div>
            <div className="text-xs mt-1">Nhấn <span style={{ color: worldColor }}>"Khởi Tạo Lãnh Thổ"</span> để tạo bản đồ</div>
          </div>
        )}

        {terrs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Map size={14} style={{ color: worldColor }} />
              <span className="text-xs font-bold tracking-widest" style={{ color: worldColor }}>
                BẢN ĐỒ LÃNH THỔ ({terrs.length})
              </span>
            </div>

            {terrs.map(t => {
              const typeColor = TYPE_COLOR[t.type] ?? worldColor;
              const isExpanded = expandedId === t.id;

              return (
                <motion.div key={t.id} layout
                  className="rounded-xl border border-gray-800 bg-gray-900/20 overflow-hidden">

                  {/* Territory header */}
                  <button className="w-full p-4 text-left" onClick={() => setExpandedId(isExpanded ? null : t.id)}>
                    <div className="flex items-start gap-3">
                      <div className="text-2xl mt-0.5 shrink-0">{t.typeIcon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{t.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ color: typeColor, background: `${typeColor}18`, border: `1px solid ${typeColor}40` }}>
                            {t.typeLabel}
                          </span>
                        </div>

                        {/* Owner */}
                        <div className="mt-1.5 text-xs">
                          {t.ownerFaction
                            ? <span className="flex items-center gap-1"><Shield size={10} style={{ color: "#a855f7" }} /><span style={{ color: "#a855f7" }}>{t.ownerFaction.name}</span></span>
                            : <span className="text-gray-600">Chưa có chủ sở hữu</span>
                          }
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Users size={10} />{t.population.toLocaleString()}</span>
                          <span className="flex items-center gap-1"><Star size={10} style={{ color: "#f59e0b" }} /><span style={{ color: "#f59e0b" }}>Thịnh {t.prosperity}%</span></span>
                          <span className="flex items-center gap-1"><Shield size={10} style={{ color: "#06b6d4" }} /><span style={{ color: "#06b6d4" }}>An ninh {t.security}%</span></span>
                        </div>

                        {/* Prosperity bar */}
                        <div className="mt-2">
                          <ProsperityBar value={t.prosperity} color={typeColor} />
                        </div>
                      </div>

                      <div className="text-gray-600 mt-1 shrink-0">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div key="detail"
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                        className="overflow-hidden border-t border-gray-800/60">
                        <div className="p-4 space-y-4">

                          {/* Resources */}
                          {t.resources.length > 0 && (
                            <div>
                              <div className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
                                <Sprout size={11} style={{ color: "#22c55e" }} />
                                <span style={{ color: "#22c55e" }} className="font-bold tracking-widest">TÀI NGUYÊN KHO</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {t.resources.map(r => (
                                  <div key={r.id} className="flex items-center gap-2 bg-green-400/5 border border-green-400/15 rounded-lg px-3 py-2">
                                    <span className="text-base">{RESOURCE_ICON[r.resourceType] ?? "📦"}</span>
                                    <div>
                                      <div className="text-xs text-gray-400">{r.resourceType}</div>
                                      <div className="text-sm font-bold text-green-400">{r.amount}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Owner faction detail */}
                          {t.ownerFaction && (
                            <div>
                              <div className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
                                <Shield size={11} style={{ color: "#a855f7" }} />
                                <span style={{ color: "#a855f7" }} className="font-bold tracking-widest">CHỦ SỞ HỮU</span>
                              </div>
                              <div className="flex items-center gap-3 bg-purple-400/5 border border-purple-400/20 rounded-lg p-2.5">
                                <div className="w-8 h-8 rounded-full bg-purple-400/15 flex items-center justify-center shrink-0">
                                  <Shield size={14} className="text-purple-400" />
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-white">{t.ownerFaction.name}</div>
                                  <div className="text-xs text-gray-500">Quỹ: <span className="text-yellow-400">{t.ownerFaction.treasury} vàng</span></div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Logs */}
                          {t.logs.length > 0 && (
                            <div>
                              <div className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
                                <Scroll size={11} style={{ color: "#8b5cf6" }} />
                                <span style={{ color: "#8b5cf6" }} className="font-bold tracking-widest">NHẬT KÝ LÃNH THỔ</span>
                              </div>
                              <div className="space-y-1.5">
                                {t.logs.map(log => (
                                  <div key={log.id} className="flex items-start gap-2 py-1 border-b border-gray-800/30 last:border-0">
                                    <div className="w-1 h-1 rounded-full bg-purple-500 mt-2 shrink-0" />
                                    <div className="flex-1">
                                      <div className="text-xs text-gray-400">{log.event}</div>
                                      <div className="text-xs text-gray-700 mt-0.5">
                                        {new Date(log.createdAt).toLocaleDateString("vi-VN")}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Last harvest */}
                          {t.lastHarvestAt && (
                            <div className="text-xs text-gray-700 flex items-center gap-1.5">
                              <Anchor size={10} />
                              Thu hoạch gần nhất: {new Date(t.lastHarvestAt).toLocaleDateString("vi-VN")}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
