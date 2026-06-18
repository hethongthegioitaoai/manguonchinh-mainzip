import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, RefreshCw, Loader2, Truck, Sword, Shield,
  ChevronDown, ChevronUp, Zap, Package, Route, Scroll,
  AlertTriangle, CheckCircle, Map, BarChart3,
} from "lucide-react";

const WORLDS = [
  { slug: "cultivation", label: "TU TIÊN",  color: "#06b6d4" },
  { slug: "cyberpunk",   label: "CYBERPUNK", color: "#a855f7" },
  { slug: "wasteland",   label: "HOANG PHẾ", color: "#ef4444" },
] as const;
type WorldSlug = "cultivation" | "cyberpunk" | "wasteland";

const WORLD_LABEL: Record<string, string> = { cultivation: "Tu Tiên", cyberpunk: "Cyberpunk", wasteland: "Hoang Phế" };

interface CargoItem { id: string; label: string; baseValue: number; quantity: number; }
interface CaravanRecord {
  id: string; leaderName: string; fromWorld: string; toWorld: string;
  cargo: CargoItem[]; guards: number; status: string; route: string;
  aiNarrative: string | null; goldReward: number; riskLevel: number;
  departedAt: string; arrivesAt: string | null; arrivedAt: string | null; raidedAt: string | null;
}
interface RouteInfo { from: string; to: string; label: string; risk: number; travelHours: number; }
interface CargoType { id: string; label: string; baseValue: number; }
interface RaidRecord { id: string; caravanId: string; raiderName: string; success: number; loot: CargoItem[]; battleLog: string | null; raidedAt: string; }

const STATUS_COLOR: Record<string, string> = { traveling: "#f59e0b", arrived: "#22c55e", raided: "#ef4444" };
const STATUS_LABEL: Record<string, string>  = { traveling: "ĐANG ĐI", arrived: "ĐÃ ĐẾN", raided: "BỊ CƯỚP" };
const STATUS_ICON: Record<string, string>   = { traveling: "🚚", arrived: "✅", raided: "⚔️" };

function CaravanCard({ c, expanded, onToggle }: { c: CaravanRecord; expanded: boolean; onToggle: () => void; }) {
  const sc = STATUS_COLOR[c.status] ?? "#6b7280";
  return (
    <motion.div layout className="border border-gray-700/50 rounded-xl overflow-hidden bg-gray-900/40">
      <button className="w-full text-left p-4" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">{STATUS_ICON[c.status] ?? "📦"}</span>
              <span className="font-bold text-white truncate">{c.leaderName}</span>
              <span className="text-xs px-2 py-0.5 rounded-full border"
                style={{ color: sc, borderColor: sc + "55", background: sc + "11" }}>
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {WORLD_LABEL[c.fromWorld] ?? c.fromWorld} → {WORLD_LABEL[c.toWorld] ?? c.toWorld}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs text-gray-500">Thưởng</div>
              <div className="text-sm font-bold text-yellow-400">{c.goldReward.toLocaleString()}g</div>
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </div>
        <div className="flex gap-3 mt-2 text-xs text-gray-500">
          <span>🛡️ {c.guards} vệ binh</span>
          <span>⚠️ Rủi ro {c.riskLevel}%</span>
          <span>📦 {c.cargo.length} loại hàng</span>
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-gray-700/40 pt-3 space-y-3">
              {/* Cargo */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Package className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs text-cyan-400 font-semibold uppercase tracking-wide">Hàng Hóa</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.cargo.map((cargo, i) => (
                    <div key={i} className="bg-gray-800/60 rounded-lg px-2.5 py-1.5 text-xs">
                      <div className="text-white font-bold">{cargo.label}</div>
                      <div className="text-gray-500">×{cargo.quantity} · {cargo.baseValue}g/đv</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Narrative */}
              {c.aiNarrative && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Scroll className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs text-purple-400 font-semibold uppercase tracking-wide">Hành Trình</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed italic">{c.aiNarrative}</p>
                </div>
              )}
              {/* Timeline */}
              <div className="flex gap-4 text-xs text-gray-600">
                <div><span className="text-gray-500">Xuất phát: </span>{new Date(c.departedAt).toLocaleString("vi-VN")}</div>
                {c.arrivesAt && c.status === "traveling" && (
                  <div><span className="text-gray-500">Dự kiến đến: </span>{new Date(c.arrivesAt).toLocaleString("vi-VN")}</div>
                )}
                {c.arrivedAt && <div><span className="text-gray-500">Đến: </span>{new Date(c.arrivedAt).toLocaleString("vi-VN")}</div>}
                {c.raidedAt  && <div><span className="text-gray-500">Bị cướp: </span>{new Date(c.raidedAt).toLocaleString("vi-VN")}</div>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function CaravanPage() {
  const [, setLocation] = useLocation();
  const [activeWorld, setActiveWorld] = useState<WorldSlug>("cultivation");
  const [data, setData] = useState<{ caravans: CaravanRecord[]; routes: RouteInfo[]; cargoTypes: CargoType[]; raids: RaidRecord[]; travelingNow: number; arrived: number; raided: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "traveling" | "arrived" | "raided">("all");
  const [msg, setMsg] = useState<string | null>(null);

  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  /* dispatch form */
  const [fromWorld, setFromWorld] = useState("cultivation");
  const [toWorld, setToWorld]     = useState("cyberpunk");
  const [guards, setGuards]       = useState(2);
  const [cargoIds, setCargoIds]   = useState<string[]>([]);
  const [showForm, setShowForm]   = useState(false);

  const worldColor = WORLDS.find(w => w.slug === activeWorld)?.color ?? "#06b6d4";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/caravans/${activeWorld}`, { credentials: "include" });
      setData(await r.json());
    } catch { setData(null); }
    setLoading(false);
  }, [activeWorld]);

  useEffect(() => { loadData(); }, [loadData]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4500); };

  const act = async (url: string, method: string, setL: (v: boolean) => void, body?: unknown) => {
    setL(true);
    try {
      const r = await fetch(url, {
        method, credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!r.ok) { flash(j.error ?? "Có lỗi"); } else { flash(j.message ?? "Hoàn thành"); loadData(); }
    } catch { flash("Có lỗi xảy ra"); }
    setL(false);
  };

  const handleDispatch = () => {
    if (fromWorld === toWorld) { flash("Điểm đi và điểm đến không được giống nhau!"); return; }
    if (cargoIds.length === 0) { flash("Vui lòng chọn ít nhất 1 loại hàng hóa!"); return; }
    act(`/api/caravans/dispatch/${activeWorld}`, "POST", setDispatchLoading, { fromWorld, toWorld, cargoIds, guards });
    setShowForm(false);
  };

  const toggleCargo = (id: string) =>
    setCargoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const allC   = data?.caravans ?? [];
  const raids  = data?.raids ?? [];
  const routes = data?.routes ?? [];
  const cargos = data?.cargoTypes ?? [];
  const filtered = allC.filter(c => filterStatus === "all" || c.status === filterStatus);

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
              <Truck className="w-5 h-5" style={{ color: worldColor }} />
              <span className="font-bold tracking-wider" style={{ color: worldColor }}>CARAVAN LIÊN THẾ GIỚI</span>
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
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Route className="w-4 h-4" />,        label: "Đang Di Chuyển", value: data?.travelingNow ?? 0, color: "#f59e0b" },
            { icon: <CheckCircle className="w-4 h-4" />,  label: "Đã Đến Nơi",    value: data?.arrived ?? 0,       color: "#22c55e" },
            { icon: <AlertTriangle className="w-4 h-4" />,label: "Bị Cướp",        value: data?.raided ?? 0,        color: "#ef4444" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-3 text-center">
              <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
              <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
              <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setShowForm(!showForm)}
            className="py-2 px-3 rounded-lg text-xs font-bold border border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/20 transition-all flex items-center justify-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> TẠO CARAVAN
          </button>
          <button onClick={() => act(`/api/caravans/simulate/${activeWorld}`, "POST", setSimLoading)}
            disabled={simLoading}
            className="py-2 px-3 rounded-lg text-xs font-bold border border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {simLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Map className="w-3.5 h-3.5" />}
            MÔ PHỎNG
          </button>
          <button onClick={() => act(`/api/caravans/auto-dispatch/${activeWorld}`, "POST", setAutoLoading)}
            disabled={autoLoading}
            className="py-2 px-3 rounded-lg text-xs font-bold border border-purple-700/50 text-purple-400 hover:bg-purple-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {autoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            TỰ ĐỘNG
          </button>
        </div>

        {/* Dispatch form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <div className="bg-gray-900/60 border border-cyan-700/30 rounded-xl p-4 space-y-4">
                <div className="text-xs text-cyan-400 font-bold uppercase tracking-wide">Tạo Đoàn Caravan Mới</div>

                {/* Route selection */}
                <div>
                  <div className="text-xs text-gray-400 mb-2">Tuyến đường</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Xuất phát</div>
                      <select value={fromWorld} onChange={e => setFromWorld(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
                        {["cultivation","cyberpunk","wasteland"].map(w => (
                          <option key={w} value={w}>{WORLD_LABEL[w]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Điểm đến</div>
                      <select value={toWorld} onChange={e => setToWorld(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
                        {["cultivation","cyberpunk","wasteland"].filter(w => w !== fromWorld).map(w => (
                          <option key={w} value={w}>{WORLD_LABEL[w]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {routes.find(r => r.from === fromWorld && r.to === toWorld) && (
                    <div className="mt-2 text-xs text-gray-600">
                      Rủi ro: {routes.find(r => r.from === fromWorld && r.to === toWorld)!.risk - Math.max(0, guards * 4)}%
                      · Thời gian: {routes.find(r => r.from === fromWorld && r.to === toWorld)!.travelHours}h
                    </div>
                  )}
                </div>

                {/* Guards */}
                <div>
                  <div className="text-xs text-gray-400 mb-2">Số vệ binh: <span className="text-yellow-400 font-bold">{guards}</span></div>
                  <input type="range" min={0} max={10} value={guards} onChange={e => setGuards(+e.target.value)}
                    className="w-full accent-yellow-500" />
                  <div className="flex justify-between text-xs text-gray-700 mt-1"><span>0</span><span>10</span></div>
                </div>

                {/* Cargo */}
                <div>
                  <div className="text-xs text-gray-400 mb-2">Chọn hàng hóa (tối thiểu 1)</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {cargos.map(c => {
                      const sel = cargoIds.includes(c.id);
                      return (
                        <button key={c.id} onClick={() => toggleCargo(c.id)}
                          className={`text-left px-2.5 py-2 rounded-lg border text-xs transition-all ${sel ? "border-cyan-600 bg-cyan-900/30 text-cyan-300" : "border-gray-700 text-gray-400 hover:border-gray-600"}`}>
                          <div className="font-bold">{c.label}</div>
                          <div className="text-gray-600">{c.baseValue}g/đv</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={handleDispatch} disabled={dispatchLoading}
                    className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-cyan-700 hover:bg-cyan-600 text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                    {dispatchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                    XUẤT PHÁT
                  </button>
                  <button onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 rounded-lg text-xs font-bold border border-gray-700 text-gray-400 hover:border-gray-600 transition-all">
                    HỦY
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flash msg */}
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-cyan-900/30 border border-cyan-700/50 rounded-lg px-4 py-2 text-cyan-300 text-sm text-center">
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Route info cards */}
        {routes.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Route className="w-3.5 h-3.5" /> Tuyến Đường Khả Dụng
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {routes.slice(0, 6).map((r, i) => (
                <div key={i} className="shrink-0 bg-gray-900/50 border border-gray-800/50 rounded-xl p-3 min-w-[140px]">
                  <div className="text-xs font-bold text-white mb-0.5">{r.label}</div>
                  <div className="text-xs text-red-400">⚠️ {r.risk}% rủi ro</div>
                  <div className="text-xs text-gray-500">⏱ {r.travelHours}h</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {allC.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {(["all","traveling","arrived","raided"] as const).map(f => (
              <button key={f} onClick={() => setFilterStatus(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                style={filterStatus === f
                  ? { background: worldColor + "22", borderColor: worldColor, color: worldColor }
                  : { borderColor: "#374151", color: "#6b7280" }}>
                {f === "all" ? `TẤT CẢ (${allC.length})` :
                 f === "traveling" ? `ĐANG ĐI (${allC.filter(c=>c.status==="traveling").length})` :
                 f === "arrived"   ? `ĐÃ ĐẾN (${allC.filter(c=>c.status==="arrived").length})` :
                 `BỊ CƯỚP (${allC.filter(c=>c.status==="raided").length})`}
              </button>
            ))}
          </div>
        )}

        {/* Caravan list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chưa có caravan nào.</p>
            <p className="text-xs mt-1">Nhấn <span className="text-cyan-400">"TẠO CARAVAN"</span> hoặc <span className="text-purple-400">"TỰ ĐỘNG"</span>.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <span className="text-xs text-gray-500 uppercase tracking-wider">{filtered.length} caravan</span>
            {filtered.map(c => (
              <CaravanCard key={c.id} c={c}
                expanded={expandedId === c.id}
                onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              />
            ))}
          </div>
        )}

        {/* Recent raids */}
        {raids.length > 0 && (
          <div>
            <div className="text-xs text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sword className="w-3.5 h-3.5" /> Vụ Cướp Gần Đây
            </div>
            <div className="space-y-2">
              {raids.slice(0, 5).map(r => (
                <div key={r.id} className="bg-red-900/10 border border-red-800/30 rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-red-300">{r.raiderName}</span>
                    <span className="text-xs text-gray-600">{new Date(r.raidedAt).toLocaleDateString("vi-VN")}</span>
                  </div>
                  {r.battleLog && <p className="text-xs text-gray-500 mt-1">{r.battleLog}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
