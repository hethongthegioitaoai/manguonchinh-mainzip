import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Crown, Coins, Users, Shield, TrendingUp,
  RefreshCw, Loader2, ScrollText, ChevronDown, ChevronUp,
  Landmark, Scale, BarChart3, FileText, Zap, X, CheckCircle,
  Brain, History,
} from "lucide-react";

const WORLDS = [
  { slug: "cultivation", label: "TU TIÊN",  color: "#06b6d4" },
  { slug: "cyberpunk",   label: "CYBERPUNK", color: "#a855f7" },
  { slug: "wasteland",   label: "HOANG PHẾ", color: "#ef4444" },
] as const;
type WorldSlug = "cultivation" | "cyberpunk" | "wasteland";

interface GovLeader  { id: string; name: string; occupation: string; money: number }
interface GovLog     { id: string; event: string; createdAt: string }
interface Territory  { id: string; name: string; type: string; population: number; prosperity: number; security: number }
interface Government {
  id: string; territoryId: string; govType: string; govTypeLabel: string; govTypeIcon: string;
  leaderNpcId: string | null; treasury: number; approvalRate: number; taxRate: number; createdAt: string;
  territory: Territory | null; leader: GovLeader | null; logs: GovLog[];
}

interface PolicyEffects {
  taxAdjust: number; approvalAdjust: number; foodAdjust: number;
  securityAdjust: number; prosperityAdjust: number; tradeAdjust: number;
  treasuryCostPerTick: number;
}
interface Policy { id: string; name: string; category: string; description: string; effects: PolicyEffects }
interface ActivePolicy { activeId: string; policyId: string; name: string; category: string; description: string; effects: PolicyEffects; activatedAt: string }
interface PolicyHistoryEntry { id: string; policyName: string; leaderName: string; action: string; activatedAt: string; deactivatedAt: string | null }

const GOV_COLOR: Record<string, string> = {
  village_council: "#22c55e", city_authority: "#06b6d4", kingdom: "#f59e0b", republic: "#a855f7",
};

const CAT_COLOR: Record<string, string> = {
  kinh_tế: "#f59e0b", phúc_lợi: "#22c55e", quân_sự: "#ef4444",
  hạ_tầng: "#06b6d4", thương_mại: "#a855f7",
};

const CAT_ICON: Record<string, string> = {
  kinh_tế: "💰", phúc_lợi: "🌾", quân_sự: "⚔️", hạ_tầng: "🏗️", thương_mại: "🛒",
};

function EffectTag({ label, value, color }: { label: string; value: number; color: string }) {
  if (value === 0) return null;
  const sign = value > 0 ? "+" : "";
  return (
    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: color + "22", color }}>
      {label} {sign}{value}
    </span>
  );
}

function ApprovalBar({ value }: { value: number }) {
  const color = value >= 70 ? "#22c55e" : value >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
      <motion.div className="h-full rounded-full" style={{ background: color }}
        initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.7 }} />
    </div>
  );
}

function StatPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-gray-900/60 rounded-lg px-2.5 py-1.5 border border-gray-800/50">
      <span style={{ color }}>{icon}</span>
      <span className="text-gray-400 text-xs">{label}</span>
      <span className="text-white text-xs font-bold">{value}</span>
    </div>
  );
}

/* ─── Policy panel inside expanded GovCard ─── */
function PolicyPanel({ gov }: { gov: Government }) {
  const [tab, setTab]         = useState<"active" | "catalog" | "history">("active");
  const [catalog, setCatalog] = useState<Policy[]>([]);
  const [activePolicies, setActivePolicies] = useState<ActivePolicy[]>([]);
  const [history, setHistory] = useState<PolicyHistoryEntry[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadPolicies = useCallback(async () => {
    setLoadingPolicies(true);
    try {
      const [catalogRes, activeRes] = await Promise.all([
        fetch("/api/npc-policy/catalog",              { credentials: "include" }),
        fetch(`/api/npc-policy/active/${gov.id}`,     { credentials: "include" }),
      ]);
      const catalogJ = await catalogRes.json();
      const activeJ  = await activeRes.json();
      setCatalog(catalogJ.policies ?? []);
      setActivePolicies(activeJ.activePolicies ?? []);
      setHistory(activeJ.history ?? []);
    } catch {}
    setLoadingPolicies(false);
  }, [gov.id]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  const flashMsg = (m: string) => { setActionMsg(m); setTimeout(() => setActionMsg(null), 3000); };

  const activate = async (policyId: string) => {
    const r = await fetch(`/api/npc-policy/activate/${gov.id}/${policyId}`, { method: "POST", credentials: "include" });
    const j = await r.json();
    flashMsg(j.message ?? "Đã kích hoạt");
    loadPolicies();
  };

  const deactivate = async (policyId: string) => {
    const r = await fetch(`/api/npc-policy/deactivate/${gov.id}/${policyId}`, { method: "DELETE", credentials: "include" });
    const j = await r.json();
    flashMsg(j.message ?? "Đã hủy");
    loadPolicies();
  };

  const activeIds = new Set(activePolicies.map(p => p.policyId));

  return (
    <div className="space-y-2">
      {/* Sub-tabs */}
      <div className="flex gap-1.5">
        {([["active", "ĐANG HOẠT ĐỘNG", Zap], ["catalog", "DANH MỤC", FileText], ["history", "LỊCH SỬ", History]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all border"
            style={tab === key
              ? { background: "#06b6d422", borderColor: "#06b6d4", color: "#06b6d4" }
              : { borderColor: "#374151", color: "#6b7280" }}>
            <Icon className="w-3 h-3" />{label}
          </button>
        ))}
      </div>

      {/* Flash */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-xs bg-cyan-900/30 border border-cyan-700/40 rounded px-3 py-1.5 text-cyan-300 text-center">
            {actionMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {loadingPolicies ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-cyan-500 animate-spin" /></div>
      ) : tab === "active" ? (
        <div className="space-y-1.5">
          {activePolicies.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-3">Chưa có chính sách nào đang hoạt động.</p>
          ) : activePolicies.map(p => {
            const e = p.effects;
            return (
              <div key={p.activeId} className="bg-gray-800/60 rounded-lg p-2.5 border border-green-800/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs">{CAT_ICON[p.category]}</span>
                      <span className="text-white text-xs font-bold">{p.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: CAT_COLOR[p.category] + "22", color: CAT_COLOR[p.category] }}>
                        {p.category.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <EffectTag label="Thuế"      value={e.taxAdjust}        color="#f59e0b" />
                      <EffectTag label="Ủng hộ"    value={e.approvalAdjust}   color="#22c55e" />
                      <EffectTag label="Thực phẩm" value={e.foodAdjust}       color="#84cc16" />
                      <EffectTag label="An ninh"   value={e.securityAdjust}   color="#ef4444" />
                      <EffectTag label="Thịnh vượng" value={e.prosperityAdjust} color="#06b6d4" />
                      <EffectTag label="Thương mại" value={e.tradeAdjust}     color="#a855f7" />
                      {e.treasuryCostPerTick > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">
                          −{e.treasuryCostPerTick} vàng/tick
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deactivate(p.policyId)}
                    className="text-red-500 hover:text-red-400 transition-colors shrink-0 mt-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === "catalog" ? (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {catalog.map(p => {
            const isActive = activeIds.has(p.id);
            const e = p.effects;
            return (
              <div key={p.id} className={`rounded-lg p-2.5 border transition-all ${isActive ? "bg-green-900/20 border-green-700/40" : "bg-gray-800/40 border-gray-700/40 hover:border-gray-600/60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs">{CAT_ICON[p.category]}</span>
                      <span className="text-white text-xs font-bold">{p.name}</span>
                      {isActive && <CheckCircle className="w-3 h-3 text-green-500" />}
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5 leading-snug">{p.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <EffectTag label="Thuế"      value={e.taxAdjust}        color="#f59e0b" />
                      <EffectTag label="Ủng hộ"    value={e.approvalAdjust}   color="#22c55e" />
                      <EffectTag label="Thực phẩm" value={e.foodAdjust}       color="#84cc16" />
                      <EffectTag label="An ninh"   value={e.securityAdjust}   color="#ef4444" />
                      <EffectTag label="Thịnh vượng" value={e.prosperityAdjust} color="#06b6d4" />
                      <EffectTag label="Thương mại" value={e.tradeAdjust}     color="#a855f7" />
                      {e.treasuryCostPerTick > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">
                          −{e.treasuryCostPerTick}/tick
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => isActive ? deactivate(p.id) : activate(p.id)}
                    className={`shrink-0 text-xs px-2 py-1 rounded border font-bold transition-all ${
                      isActive
                        ? "border-red-700/50 text-red-400 hover:bg-red-900/20"
                        : "border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/20"
                    }`}>
                    {isActive ? "HỦY" : "BAN HÀNH"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {history.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-3">Chưa có lịch sử chính sách.</p>
          ) : history.map(h => (
            <div key={h.id} className="text-xs bg-gray-800/40 rounded px-2.5 py-1.5 border-l-2 border-gray-700/60">
              <div className="flex items-center gap-1.5">
                <span className={h.action === "activate" ? "text-green-500" : "text-red-400"}>
                  {h.action === "activate" ? "✅" : "❌"}
                </span>
                <span className="text-white font-semibold">{h.policyName}</span>
                <span className="text-gray-600">— {h.leaderName}</span>
              </div>
              <div className="text-gray-600 mt-0.5">
                {new Date(h.activatedAt).toLocaleDateString("vi-VN")}
                {h.deactivatedAt && ` → ${new Date(h.deactivatedAt).toLocaleDateString("vi-VN")}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── GovCard ─── */
function GovCard({ gov, expanded, onToggle, expandedSection, onSectionToggle }: {
  gov: Government; expanded: boolean; onToggle: () => void;
  expandedSection: "info" | "policy"; onSectionToggle: (s: "info" | "policy") => void;
}) {
  const typeColor = GOV_COLOR[gov.govType] ?? "#06b6d4";
  return (
    <motion.div layout className="border border-gray-700/50 rounded-xl overflow-hidden bg-gray-900/40 backdrop-blur-sm">
      <button className="w-full text-left p-4" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{gov.govTypeIcon}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white">{gov.territory?.name ?? "Lãnh thổ"}</span>
                <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: typeColor, borderColor: typeColor + "55", background: typeColor + "11" }}>
                  {gov.govTypeLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Crown className="w-3 h-3 text-yellow-500" />
                <span className="text-xs text-gray-400">
                  {gov.leader ? gov.leader.name : "Chưa có lãnh đạo"}
                  {gov.leader && <span className="text-gray-600 ml-1">— {gov.leader.occupation}</span>}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className="text-xs text-gray-400">Ủng hộ</div>
              <div className="text-sm font-bold" style={{ color: gov.approvalRate >= 70 ? "#22c55e" : gov.approvalRate >= 40 ? "#f59e0b" : "#ef4444" }}>
                {Math.round(gov.approvalRate)}%
              </div>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </div>
        <div className="mt-3"><ApprovalBar value={gov.approvalRate} /></div>
        <div className="flex flex-wrap gap-2 mt-3">
          <StatPill icon={<Coins className="w-3.5 h-3.5" />}    label="Ngân quỹ"     value={`${gov.treasury.toLocaleString()} vàng`} color="#f59e0b" />
          <StatPill icon={<Scale className="w-3.5 h-3.5" />}    label="Thuế suất"    value={`${gov.taxRate}%`}                       color="#06b6d4" />
          <StatPill icon={<Users className="w-3.5 h-3.5" />}    label="Dân số"       value={gov.territory?.population ?? 0}          color="#a855f7" />
          <StatPill icon={<TrendingUp className="w-3.5 h-3.5" />} label="Thịnh vượng" value={gov.territory?.prosperity ?? 0}        color="#22c55e" />
          <StatPill icon={<Shield className="w-3.5 h-3.5" />}   label="An ninh"      value={gov.territory?.security ?? 0}            color="#ef4444" />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="border-t border-gray-700/40">
              {/* Section tabs */}
              <div className="flex border-b border-gray-800/60">
                <button onClick={() => onSectionToggle("info")}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide transition-all ${expandedSection === "info" ? "text-cyan-400 border-b-2 border-cyan-500 bg-cyan-900/10" : "text-gray-600 hover:text-gray-400"}`}>
                  TỔNG QUAN
                </button>
                <button onClick={() => onSectionToggle("policy")}
                  className={`flex-1 py-2 text-xs font-bold tracking-wide transition-all ${expandedSection === "policy" ? "text-purple-400 border-b-2 border-purple-500 bg-purple-900/10" : "text-gray-600 hover:text-gray-400"}`}>
                  CHÍNH SÁCH
                </button>
              </div>

              <div className="p-4 space-y-3">
                {expandedSection === "info" ? (
                  <>
                    {gov.leader && (
                      <div className="bg-gray-800/50 rounded-lg p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
                          style={{ background: typeColor + "22", border: `1px solid ${typeColor}44` }}>👤</div>
                        <div>
                          <div className="text-white font-semibold">{gov.leader.name}</div>
                          <div className="text-gray-400 text-xs">{gov.leader.occupation}</div>
                          <div className="text-yellow-500 text-xs mt-0.5">💰 {gov.leader.money.toLocaleString()} vàng tài sản</div>
                        </div>
                      </div>
                    )}
                    {gov.logs.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <ScrollText className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wide">Kỷ Niệm Chính Phủ</span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {gov.logs.map(log => (
                            <div key={log.id} className="text-xs text-gray-300 bg-gray-800/40 rounded px-2.5 py-1.5 border-l-2 border-cyan-800/60">
                              <span className="text-gray-500 mr-1.5">{new Date(log.createdAt).toLocaleDateString("vi-VN")}</span>
                              {log.event}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <PolicyPanel gov={gov} />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Main page ─── */
export default function NpcGovernmentPage() {
  const [, setLocation] = useLocation();
  const [activeWorld, setActiveWorld] = useState<WorldSlug>("cultivation");
  const [data, setData]               = useState<{ governments: Government[] } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<Record<string, "info" | "policy">>({});

  const [estLoading,      setEstLoading]      = useState(false);
  const [taxLoading,      setTaxLoading]      = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [autoLoading,     setAutoLoading]     = useState(false);
  const [seedLoading,     setSeedLoading]     = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const worldColor = WORLDS.find(w => w.slug === activeWorld)?.color ?? "#06b6d4";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/npc-government/${activeWorld}`, { credentials: "include" });
      setData(await r.json());
    } catch { setData(null); }
    setLoading(false);
  }, [activeWorld]);

  useEffect(() => { loadData(); }, [loadData]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  const action = async (url: string, method: string, setL: (v: boolean) => void, fallback: string) => {
    setL(true);
    try {
      const r = await fetch(url, { method, credentials: "include" });
      const j = await r.json();
      flash(j.message ?? fallback);
      loadData();
    } catch { flash(fallback); }
    setL(false);
  };

  const govs = data?.governments ?? [];
  const totalTreasury   = govs.reduce((s, g) => s + g.treasury, 0);
  const avgApproval     = govs.length ? govs.reduce((s, g) => s + g.approvalRate, 0) / govs.length : 0;
  const totalPopulation = govs.reduce((s, g) => s + (g.territory?.population ?? 0), 0);
  const avgTax          = govs.length ? govs.reduce((s, g) => s + g.taxRate, 0) / govs.length : 0;

  const toggleSection = (govId: string, section: "info" | "policy") => {
    setExpandedSection(prev => ({ ...prev, [govId]: section }));
  };

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
              <Landmark className="w-5 h-5" style={{ color: worldColor }} />
              <span className="font-bold tracking-wider" style={{ color: worldColor }}>CHÍNH PHỦ NPC</span>
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
            <button key={w.slug} onClick={() => setActiveWorld(w.slug as WorldSlug)}
              className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wider border transition-all"
              style={activeWorld === w.slug
                ? { background: w.color + "22", borderColor: w.color, color: w.color }
                : { borderColor: "#374151", color: "#6b7280" }}>
              {w.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        {govs.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: <Coins className="w-4 h-4" />,    label: "Tổng Ngân Quỹ", value: `${totalTreasury.toLocaleString()} vàng`,  color: "#f59e0b" },
              { icon: <BarChart3 className="w-4 h-4" />, label: "TB Ủng Hộ",    value: `${Math.round(avgApproval)}%`,             color: avgApproval >= 60 ? "#22c55e" : "#ef4444" },
              { icon: <Users className="w-4 h-4" />,    label: "Tổng Dân Số",   value: totalPopulation,                           color: "#a855f7" },
              { icon: <Scale className="w-4 h-4" />,    label: "TB Thuế Suất",  value: `${avgTax.toFixed(1)}%`,                   color: "#06b6d4" },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-3 text-center">
                <div className="flex justify-center mb-1" style={{ color: stat.color }}>{stat.icon}</div>
                <div className="text-xs text-gray-500 mb-0.5">{stat.label}</div>
                <div className="font-bold text-sm" style={{ color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons — row 1 */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => action(`/api/npc-government/establish/${activeWorld}`, "POST", setEstLoading, "Lỗi thành lập")}
            disabled={estLoading}
            className="py-2 px-3 rounded-lg text-xs font-bold border border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {estLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Landmark className="w-3.5 h-3.5" />}
            THÀNH LẬP
          </button>
          <button onClick={() => action(`/api/npc-government/collect-taxes/${activeWorld}`, "POST", setTaxLoading, "Lỗi thu thuế")}
            disabled={taxLoading}
            className="py-2 px-3 rounded-lg text-xs font-bold border border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {taxLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
            THU THUẾ
          </button>
          <button onClick={() => action(`/api/npc-government/update-approval/${activeWorld}`, "POST", setApprovalLoading, "Lỗi cập nhật")}
            disabled={approvalLoading}
            className="py-2 px-3 rounded-lg text-xs font-bold border border-purple-700/50 text-purple-400 hover:bg-purple-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {approvalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
            CẬP NHẬT
          </button>
        </div>

        {/* Action buttons — row 2 */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => action(`/api/npc-policy/seed`, "POST", setSeedLoading, "Lỗi tạo chính sách")}
            disabled={seedLoading}
            className="py-2 px-3 rounded-lg text-xs font-bold border border-gray-700/50 text-gray-400 hover:bg-gray-800/40 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {seedLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            TẠO CHÍNH SÁCH MẶC ĐỊNH
          </button>
          <button onClick={() => action(`/api/npc-policy/auto-decide/${activeWorld}`, "POST", setAutoLoading, "Lỗi tự động quyết định")}
            disabled={autoLoading}
            className="py-2 px-3 rounded-lg text-xs font-bold border border-green-700/50 text-green-400 hover:bg-green-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {autoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            LÃNH ĐẠO TỰ QUYẾT ĐỊNH
          </button>
        </div>

        {/* Flash message */}
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-cyan-900/30 border border-cyan-700/50 rounded-lg px-4 py-2 text-cyan-300 text-sm text-center">
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Government list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          </div>
        ) : govs.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <Landmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chưa có chính phủ nào.</p>
            <p className="text-xs mt-1">Nhấn <span className="text-yellow-400">"THÀNH LẬP"</span> để tạo chính phủ từ các lãnh thổ.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <span className="text-xs text-gray-500 uppercase tracking-wider">{govs.length} chính phủ</span>
            {govs.map(gov => (
              <GovCard
                key={gov.id}
                gov={gov}
                expanded={expandedId === gov.id}
                onToggle={() => setExpandedId(expandedId === gov.id ? null : gov.id)}
                expandedSection={expandedSection[gov.id] ?? "info"}
                onSectionToggle={(s) => toggleSection(gov.id, s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
