import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, Route, Plus, Trash2, RefreshCw, Loader2,
  Shield, Star, AlertTriangle, CheckCircle, Zap, Package,
  ChevronDown, ChevronUp, Clock,
} from "lucide-react";

const WORLDS = [
  { slug: "cultivation", label: "TU TIÊN",  color: "#06b6d4" },
  { slug: "cyberpunk",   label: "CYBERPUNK", color: "#a855f7" },
  { slug: "wasteland",   label: "HOANG PHẾ", color: "#ef4444" },
] as const;
type WorldSlug = typeof WORLDS[number]["slug"];

const ITEMS = ["thực phẩm", "vàng", "gỗ", "cá", "công cụ"];
const ITEM_ICON: Record<string, string> = {
  "thực phẩm": "🌾", "vàng": "💰", "gỗ": "🪵", "cá": "🐟", "công cụ": "🔧",
};

interface Territory {
  id: string; name: string; type: string;
  x: number; y: number; prosperity: number; security: number;
}
interface TradeRoute {
  id: string; worldSlug: string;
  sourceTerritoryId: string; destinationTerritoryId: string;
  item: string; amount: number; active: boolean; disrupted: boolean;
  totalTicksActive: number; totalTransferred: number;
  source: Territory | null; destination: Territory | null;
}
interface HistoryEvent {
  id: string; tradeRouteId: string | null; worldSlug: string;
  eventType: string; description: string; tick: number; createdAt: string;
}

function MapCanvas({ territories, routes, color }: { territories: Territory[]; routes: TradeRoute[]; color: string }) {
  const W = 320, H = 200;

  const xs = territories.map(t => t.x);
  const ys = territories.map(t => t.y);
  const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 100);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 100);
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
  const pad = 24;

  function px(x: number) { return pad + ((x - minX) / rangeX) * (W - pad * 2); }
  function py(y: number) { return pad + ((y - minY) / rangeY) * (H - pad * 2); }

  return (
    <svg width={W} height={H} className="w-full rounded-xl" style={{ background: "#0a0a0a", border: "1px solid #1f2937" }}>
      {/* Route lines */}
      {routes.filter(r => r.active).map(route => {
        const src  = route.source;
        const dest = route.destination;
        if (!src || !dest) return null;
        const lineColor = route.disrupted ? "#ef4444" : "#22c55e";
        const x1 = px(src.x), y1 = py(src.y), x2 = px(dest.x), y2 = py(dest.y);
        return (
          <g key={route.id}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={lineColor} strokeWidth={route.disrupted ? 1.5 : 2}
              strokeDasharray={route.disrupted ? "5,3" : "none"}
              opacity={route.disrupted ? 0.6 : 0.85} />
            {/* Arrow midpoint */}
            <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={3} fill={lineColor} opacity={0.9} />
            {/* Item label */}
            <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6}
              textAnchor="middle" fill={lineColor} fontSize={8} opacity={0.9}>
              {ITEM_ICON[route.item] ?? "📦"}
            </text>
          </g>
        );
      })}

      {/* Territory dots */}
      {territories.map(t => (
        <g key={t.id}>
          <circle cx={px(t.x)} cy={py(t.y)} r={7}
            fill={t.prosperity > 60 ? `${color}33` : "#1f2937"}
            stroke={t.prosperity > 60 ? color : "#374151"} strokeWidth={1.5} />
          <text x={px(t.x)} y={py(t.y) + 3} textAnchor="middle"
            fill={t.prosperity > 60 ? color : "#6b7280"} fontSize={7} fontWeight="bold">
            {t.prosperity > 60 ? "✦" : "·"}
          </text>
          <text x={px(t.x)} y={py(t.y) + 15} textAnchor="middle"
            fill="#9ca3af" fontSize={7}>
            {t.name.slice(0, 10)}
          </text>
        </g>
      ))}

      {territories.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="#374151" fontSize={11}>
          Chưa có lãnh thổ
        </text>
      )}
    </svg>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    trade_route_created:  { label: "Tạo tuyến",      color: "#22c55e" },
    trade_route_destroyed:{ label: "Giải tán",        color: "#ef4444" },
    route_disrupted:      { label: "Gián đoạn",       color: "#f59e0b" },
    route_restored:       { label: "Khôi phục",       color: "#06b6d4" },
  };
  const c = cfg[type] ?? { label: type, color: "#6b7280" };
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
      style={{ color: c.color, background: `${c.color}18`, border: `1px solid ${c.color}40` }}>
      {c.label}
    </span>
  );
}

export default function TradeRoutePage() {
  const [, setLocation] = useLocation();
  const [activeWorld, setActiveWorld] = useState<WorldSlug>("cultivation");
  const [routes, setRoutes]       = useState<TradeRoute[]>([]);
  const [territories, setTerrs]   = useState<Territory[]>([]);
  const [history, setHistory]     = useState<HistoryEvent[]>([]);
  const [loading, setLoading]     = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [stressLoading, setStressLoading] = useState(false);
  const [stressResult, setStressResult] = useState<any>(null);
  const [createErr, setCreateErr] = useState("");
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({ sourceId: "", destId: "", item: "thực phẩm", amount: "10" });

  const worldColor = WORLDS.find(w => w.slug === activeWorld)?.color ?? "#06b6d4";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/trade-routes/${activeWorld}`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setRoutes(d.routes ?? []);
        setTerrs(d.territories ?? []);
      }
    } finally { setLoading(false); }
  }, [activeWorld]);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const r = await fetch(`/api/trade-routes/${activeWorld}/history?limit=30`, { credentials: "include" });
      if (r.ok) setHistory((await r.json()).history ?? []);
    } finally { setHistLoading(false); }
  }, [activeWorld]);

  useEffect(() => { load(); setShowCreate(false); setShowHistory(false); setStressResult(null); }, [load]);

  async function createRoute() {
    setCreateErr("");
    if (!form.sourceId || !form.destId) { setCreateErr("Vui lòng chọn lãnh thổ nguồn và đích"); return; }
    if (form.sourceId === form.destId)  { setCreateErr("Nguồn và đích không thể giống nhau"); return; }
    const r = await fetch(`/api/trade-routes/${activeWorld}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceTerritoryId: form.sourceId, destinationTerritoryId: form.destId, item: form.item, amount: Number(form.amount) }),
    });
    const d = await r.json();
    if (!r.ok) { setCreateErr(d.error ?? "Lỗi tạo tuyến"); return; }
    setMsg("✓ Tuyến thương mại đã được tạo");
    setShowCreate(false);
    await load();
    setTimeout(() => setMsg(""), 3000);
  }

  async function deleteRoute(id: string) {
    if (!confirm("Xác nhận giải tán tuyến thương mại này?")) return;
    const r = await fetch(`/api/trade-routes/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) { setMsg("✓ Tuyến đã bị giải tán"); await load(); setTimeout(() => setMsg(""), 3000); }
  }

  async function runStressTest() {
    setStressLoading(true); setStressResult(null);
    try {
      const r = await fetch(`/api/trade-routes/${activeWorld}/stress-test`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticks: 1000 }),
      });
      const d = await r.json();
      setStressResult(d);
      await load();
    } finally { setStressLoading(false); }
  }

  const activeRoutes    = routes.filter(r => r.active && !r.disrupted);
  const disruptedRoutes = routes.filter(r => r.active && r.disrupted);
  const eligibleTerrs   = territories.filter(t => t.prosperity > 60);

  return (
    <div className="min-h-screen bg-black text-white font-mono">

      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/dashboard")} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${worldColor}22`, border: `1px solid ${worldColor}40` }}>
          <Route size={14} style={{ color: worldColor }} />
        </div>
        <div>
          <div className="text-sm font-bold tracking-widest" style={{ color: worldColor }}>TUYẾN THƯƠNG MẠI</div>
          <div className="text-xs text-gray-600">Kết nối · vận chuyển · thịnh vượng</div>
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
              <motion.div layoutId="wt-trade" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: w.color }} />
            )}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">

        {/* Status message */}
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-400 font-bold">
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Tất Cả",    value: routes.length,        icon: <Route size={13} />,         color: worldColor },
            { label: "Hoạt Động", value: activeRoutes.length,  icon: <CheckCircle size={13} />,   color: "#22c55e" },
            { label: "Gián Đoạn", value: disruptedRoutes.length, icon: <AlertTriangle size={13} />, color: "#ef4444" },
            { label: "Đủ Điều Kiện", value: eligibleTerrs.length, icon: <Star size={13} />,      color: "#f59e0b" },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-gray-800 bg-gray-900/40 p-2.5 text-center">
              <div className="flex items-center justify-center mb-1" style={{ color: card.color }}>{card.icon}</div>
              <div className="text-base font-bold" style={{ color: card.color }}>{card.value}</div>
              <div className="text-xs text-gray-600 mt-0.5 leading-tight">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div>
          <div className="text-xs font-bold tracking-widest mb-2 flex items-center gap-2" style={{ color: worldColor }}>
            <Route size={12} /> BẢN ĐỒ TUYẾN ĐƯỜNG
            <div className="flex items-center gap-3 ml-auto text-gray-600 font-normal">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" /> Hoạt động</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block border-dashed" style={{borderTop:'1px dashed #ef4444', background:'none'}} /> Gián đoạn</span>
            </div>
          </div>
          <MapCanvas territories={territories} routes={routes} color={worldColor} />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { setShowCreate(v => !v); setCreateErr(""); }}
            className="py-2.5 rounded-xl text-xs font-bold tracking-widest flex items-center justify-center gap-2 transition-all"
            style={{ background: `${worldColor}22`, border: `1px solid ${worldColor}60`, color: worldColor }}>
            <Plus size={14} /> Tạo Tuyến Mới
          </button>
          <button onClick={runStressTest} disabled={stressLoading || routes.length === 0}
            className="py-2.5 rounded-xl text-xs font-bold tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{ background: "#f59e0b22", border: "1px solid #f59e0b60", color: "#f59e0b" }}>
            {stressLoading ? <><Loader2 size={14} className="animate-spin" />1000 Ticks...</> : <><Zap size={14} />Stress Test 1000</>}
          </button>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-3">
                <div className="text-xs font-bold tracking-widest" style={{ color: worldColor }}>THIẾT LẬP TUYẾN MỚI</div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Nguồn (Thịnh Vượng &gt; 60)</label>
                    <select value={form.sourceId} onChange={e => setForm(f => ({ ...f, sourceId: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      style={{ borderColor: form.sourceId ? `${worldColor}60` : undefined }}>
                      <option value="">— Chọn nguồn —</option>
                      {territories.map(t => (
                        <option key={t.id} value={t.id} disabled={t.prosperity <= 60}>
                          {t.name} (T.Vượng: {t.prosperity}{t.prosperity <= 60 ? " ⛔" : " ✓"})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Đích</label>
                    <select value={form.destId} onChange={e => setForm(f => ({ ...f, destId: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      style={{ borderColor: form.destId ? `${worldColor}60` : undefined }}>
                      <option value="">— Chọn đích —</option>
                      {territories.filter(t => t.id !== form.sourceId).map(t => (
                        <option key={t.id} value={t.id}>{t.name} (AN: {t.security})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Hàng hoá</label>
                    <select value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
                      {ITEMS.map(i => <option key={i} value={i}>{ITEM_ICON[i]} {i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Số lượng / tick</label>
                    <input type="number" min={1} max={200} value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
                  </div>
                </div>

                {createErr && (
                  <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg p-2.5">{createErr}</div>
                )}

                <div className="flex gap-2">
                  <button onClick={createRoute}
                    className="flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all"
                    style={{ background: `${worldColor}33`, border: `1px solid ${worldColor}60`, color: worldColor }}>
                    Xác Nhận Tạo Tuyến
                  </button>
                  <button onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-lg text-xs text-gray-500 border border-gray-800 hover:text-white transition-colors">
                    Huỷ
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stress test result */}
        <AnimatePresence>
          {stressResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-2">
              <div className="text-xs font-bold tracking-widest text-yellow-400 flex items-center gap-2">
                <Zap size={13} /> KẾT QUẢ STRESS TEST — {stressResult.ticks} TICKS
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: "Thời gian",       value: `${stressResult.elapsedMs}ms` },
                  { label: "TB / tick",        value: `${stressResult.avgMsPerTick}ms` },
                  { label: "Gián đoạn",        value: stressResult.disruptionEvents },
                  { label: "Khôi phục",        value: stressResult.restorationEvents },
                  { label: "Sự kiện lịch sử",  value: stressResult.historyEvents },
                  { label: "Tuyến còn lại",    value: stressResult.routesAfter },
                ].map(s => (
                  <div key={s.label} className="flex justify-between bg-gray-900/60 rounded-lg px-2.5 py-1.5">
                    <span className="text-gray-500">{s.label}</span>
                    <span className="text-yellow-400 font-bold">{s.value}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-600">
                Tổng vận chuyển: <span className="text-yellow-400 font-bold">
                  {stressResult.routes?.reduce((s: number, r: any) => s + r.totalTransferred, 0)?.toLocaleString()} đơn vị
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Route list */}
        {loading && (
          <div className="flex items-center justify-center py-10 gap-2 text-gray-600">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs">Đang tải...</span>
          </div>
        )}

        {!loading && routes.length === 0 && (
          <div className="text-center py-14 text-gray-700">
            <Route size={32} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm">Chưa có tuyến thương mại</div>
            <div className="text-xs mt-1 text-gray-700">Cần lãnh thổ có <span style={{ color: worldColor }}>Thịnh Vượng &gt; 60</span> để mở tuyến</div>
          </div>
        )}

        {!loading && routes.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold tracking-widest flex items-center gap-2" style={{ color: worldColor }}>
              <Package size={12} /> DANH SÁCH TUYẾN ({routes.length})
            </div>
            {routes.map(route => (
              <motion.div key={route.id} layout
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: route.disrupted ? "#ef444440" : "#1f2937" }}>
                <div className="p-3.5 flex items-start gap-3">
                  {/* Status icon */}
                  <div className="mt-0.5 shrink-0">
                    {route.disrupted
                      ? <AlertTriangle size={16} className="text-red-400" />
                      : <CheckCircle size={16} className="text-green-400" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Route title */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">
                        {route.source?.name ?? "?"} → {route.destination?.name ?? "?"}
                      </span>
                      <span className="text-xs font-bold" style={{
                        color: route.disrupted ? "#ef4444" : "#22c55e"
                      }}>
                        {route.disrupted ? "⚠ GÁN ĐOẠN" : "● ĐANG CHẠY"}
                      </span>
                    </div>

                    {/* Item & amount */}
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                      <span>{ITEM_ICON[route.item] ?? "📦"} {route.item}</span>
                      <span className="text-gray-700">·</span>
                      <span className="text-yellow-400 font-bold">{route.amount}/tick</span>
                    </div>

                    {/* Stats */}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {route.totalTicksActive} ticks
                      </span>
                      <span className="flex items-center gap-1">
                        <Package size={10} /> {route.totalTransferred.toLocaleString()} tổng
                      </span>
                      {route.source && (
                        <span className="flex items-center gap-1">
                          <Shield size={10} /> Nguồn AN: {route.source.security}
                          {route.source.security < 20 && <span className="text-red-400">⚠</span>}
                        </span>
                      )}
                      {route.destination && (
                        <span className="flex items-center gap-1">
                          <Shield size={10} /> Đích AN: {route.destination.security}
                          {route.destination.security < 20 && <span className="text-red-400">⚠</span>}
                        </span>
                      )}
                    </div>
                  </div>

                  <button onClick={() => deleteRoute(route.id)}
                    className="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* History toggle */}
        <button onClick={() => { setShowHistory(v => !v); if (!showHistory) loadHistory(); }}
          className="w-full py-2.5 rounded-xl text-xs font-bold tracking-widest flex items-center justify-center gap-2 transition-all border border-gray-800 text-gray-500 hover:text-white">
          {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          LỊCH SỬ SỰ KIỆN
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              {histLoading ? (
                <div className="flex items-center justify-center py-6 gap-2 text-gray-600">
                  <Loader2 size={14} className="animate-spin" /><span className="text-xs">Đang tải...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-gray-700 text-xs">Chưa có sự kiện</div>
              ) : (
                <div className="space-y-2">
                  {history.map(h => (
                    <div key={h.id} className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-800/60 bg-gray-900/20">
                      <div className="w-1 h-1 rounded-full bg-gray-600 mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <EventTypeBadge type={h.eventType} />
                          {h.tick > 0 && <span className="text-xs text-gray-700">Tick #{h.tick}</span>}
                        </div>
                        <div className="text-xs text-gray-400 leading-relaxed">{h.description}</div>
                        <div className="text-xs text-gray-700 mt-1">
                          {new Date(h.createdAt).toLocaleString("vi-VN")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
