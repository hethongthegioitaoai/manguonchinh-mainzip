import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

/* ─── Types ─────────────────────────────────────────────── */
interface Territory {
  id: string; name: string; type: string;
  x: number; y: number; terrain: string; status: string;
  population: number; prosperity: number; security: number;
  owner: string | null; ownerId: string | null;
}
interface Faction { id: string; name: string; type: string; influence: number; treasury: number }
interface Army { id: string; name: string; territoryId: string; soldiers: number; power: number; morale: number; supply: number }
interface HistoryEvent { tick: number; eventType: string; title: string; actors: any; createdAt: string }
interface TimelineEvent { tick: number; eventType: string; title: string; createdAt: string }
interface MapState { worldSlug: string; ts: number; territories: Territory[]; factions: Faction[]; armies: Army[]; recentHistory: HistoryEvent[] }

/* ─── Constants ──────────────────────────────────────────── */
const WORLDS = [
  { slug: "cultivation", label: "Tu Tiên" },
  { slug: "cyberpunk",   label: "Cyberpunk" },
  { slug: "zombie",      label: "Hoang Phế" },
];

const MAP_W = 900, MAP_H = 560;
const NODE_BASE = 22;

const TERRAIN_COLOR: Record<string, string> = {
  plains: "#1a2a1a", forest: "#0d1f10", mountains: "#1a1a1a",
  coast: "#0d1a24", desert: "#2a1f0d", default: "#111827",
};

const STATUS_OVERLAY: Record<string, string> = {
  active: "", abandoned: "rgba(120,100,40,0.35)", ruins: "rgba(80,80,80,0.55)",
};

const EVENT_ICON: Record<string, string> = {
  territory_capture: "⚔️", battle_failed: "🛡️", collapse: "💀",
  recolonization: "🌱", migration: "🚶", default: "📜",
};

const EVENT_COLOR: Record<string, string> = {
  territory_capture: "#ef4444", battle_failed: "#f97316",
  collapse: "#6b7280", recolonization: "#22c55e",
  default: "#a78bfa",
};

/* ─── Faction color (deterministic from id) ─────────────── */
function factionColor(id: string): string {
  const PALETTE = [
    "#06b6d4","#8b5cf6","#ec4899","#f59e0b","#10b981",
    "#3b82f6","#ef4444","#84cc16","#f97316","#e879f9",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/* ─── Fetch helpers ──────────────────────────────────────── */
async function fetchMapState(slug: string): Promise<MapState> {
  const r = await fetch(`/api/unity/map-state/${slug}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function fetchTimeline(slug: string): Promise<TimelineEvent[]> {
  const r = await fetch(`/api/simulation/history/${slug}/timeline`);
  if (!r.ok) return [];
  return r.json();
}

/* ─── Tooltip ────────────────────────────────────────────── */
interface TooltipState { x: number; y: number; t: Territory | null }

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function PoliticalMapPage() {
  const [worldSlug, setWorldSlug] = useState("cultivation");
  const [selectedId, setSelectedId]  = useState<string | null>(null);
  const [tooltip, setTooltip]        = useState<TooltipState>({ x: 0, y: 0, t: null });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showArmies, setShowArmies]  = useState(true);
  const [showProsperity, setShowProsperity] = useState(false);
  const [highlightFaction, setHighlightFaction] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /* Map state — polling every 8 sec */
  const { data: mapState, refetch, isLoading } = useQuery<MapState>({
    queryKey: ["map-state", worldSlug],
    queryFn:  () => fetchMapState(worldSlug),
    refetchInterval: autoRefresh ? 8000 : false,
    staleTime: 5000,
  });

  /* Timeline */
  const { data: timeline = [] } = useQuery<TimelineEvent[]>({
    queryKey: ["timeline", worldSlug],
    queryFn:  () => fetchTimeline(worldSlug),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const maxTick = timeline.length > 0 ? Math.max(...timeline.map(t => t.tick)) : 0;
  const [sliderTick, setSliderTick] = useState(0);
  useEffect(() => { if (maxTick > 0) setSliderTick(maxTick); }, [maxTick]);

  /* Filter territories visible at sliderTick (collapse/recolonize events) */
  const visibleCollapses = new Set(
    timeline.filter(e => e.eventType === "collapse" && e.tick <= sliderTick).map(e => e.title)
  );
  const visibleRecolons = new Set(
    timeline.filter(e => e.eventType === "recolonization" && e.tick <= sliderTick).map(e => e.title)
  );

  /* Scale territory x/y to SVG viewport */
  const territories = mapState?.territories ?? [];
  const armies      = mapState?.armies ?? [];
  const factions    = mapState?.factions ?? [];
  const history     = mapState?.recentHistory ?? [];

  const xs = territories.map(t => t.x);
  const ys = territories.map(t => t.y);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 100;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 100;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const PAD = 60;
  function sx(x: number) { return PAD + ((x - minX) / rangeX) * (MAP_W - PAD * 2); }
  function sy(y: number) { return PAD + ((y - minY) / rangeY) * (MAP_H - PAD * 2); }

  /* Army position (center of territory) */
  const armyMap = new Map<string, Army>();
  armies.forEach(a => { if (a.territoryId) armyMap.set(a.territoryId, a); });

  /* Selected territory detail */
  const selectedTerritory = territories.find(t => t.id === selectedId) ?? null;
  const selectedArmy      = selectedTerritory ? armyMap.get(selectedTerritory.id) : null;
  const selectedFaction   = factions.find(f => f.id === selectedTerritory?.ownerId) ?? null;

  /* Timeline events at sliderTick */
  const tickEvents = timeline.filter(e => e.tick === sliderTick);

  const handleMouseEnter = useCallback((e: React.MouseEvent, t: Territory) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) setTooltip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 8, t });
  }, []);
  const handleMouseLeave = useCallback(() => setTooltip({ x: 0, y: 0, t: null }), []);

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-black text-gray-100" style={{ fontFamily: "monospace" }}>
      {/* Header */}
      <div className="border-b border-cyan-900/50 px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard">
          <span className="text-cyan-500 hover:text-cyan-300 text-sm cursor-pointer">← Dashboard</span>
        </Link>
        <span className="text-cyan-400 font-bold text-lg tracking-widest">🗺 BẢN ĐỒ CHÍNH TRỊ</span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {/* World selector */}
          <select
            value={worldSlug}
            onChange={e => { setWorldSlug(e.target.value); setSelectedId(null); }}
            className="bg-gray-900 border border-cyan-800 text-cyan-300 px-2 py-1 rounded text-xs"
          >
            {WORLDS.map(w => <option key={w.slug} value={w.slug}>{w.label}</option>)}
          </select>
          {/* Toggles */}
          <button
            onClick={() => setShowProsperity(v => !v)}
            className={`px-2 py-1 rounded text-xs border ${showProsperity ? "border-yellow-500 text-yellow-400" : "border-gray-700 text-gray-500"}`}
          >Thịnh Vượng</button>
          <button
            onClick={() => setShowArmies(v => !v)}
            className={`px-2 py-1 rounded text-xs border ${showArmies ? "border-red-600 text-red-400" : "border-gray-700 text-gray-500"}`}
          >⚔ Quân Đội</button>
          <button
            onClick={() => { setAutoRefresh(v => !v); refetch(); }}
            className={`px-2 py-1 rounded text-xs border ${autoRefresh ? "border-green-600 text-green-400" : "border-gray-700 text-gray-400"}`}
          >{autoRefresh ? "● LIVE" : "○ PAUSED"}</button>
        </div>
      </div>

      <div className="flex" style={{ height: "calc(100vh - 56px)" }}>
        {/* ── LEFT: MAP ── */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          {/* SVG Map */}
          <div className="relative flex-1 bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
            {isLoading && territories.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-cyan-400 text-sm">
                Đang tải bản đồ...
              </div>
            )}
            {!isLoading && territories.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500">
                <span className="text-3xl">🗺</span>
                <span className="text-sm">Chưa có lãnh thổ nào trong thế giới này</span>
                <a href="/territories" className="text-cyan-500 text-xs hover:underline">→ Tạo lãnh thổ</a>
              </div>
            )}

            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="w-full h-full"
            >
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0f1f0f" strokeWidth="0.5"/>
                </pattern>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <rect width={MAP_W} height={MAP_H} fill="#050d05"/>
              <rect width={MAP_W} height={MAP_H} fill="url(#grid)"/>

              {/* ── CONNECTION LINES (territories nearby) ── */}
              {territories.map(ta =>
                territories
                  .filter(tb => tb.id > ta.id && Math.abs(ta.x - tb.x) + Math.abs(ta.y - tb.y) < 50)
                  .map(tb => (
                    <line
                      key={`${ta.id}-${tb.id}`}
                      x1={sx(ta.x)} y1={sy(ta.y)} x2={sx(tb.x)} y2={sy(tb.y)}
                      stroke="#1a2a1a" strokeWidth="1" strokeDasharray="4 6"
                    />
                  ))
              )}

              {/* ── TERRITORY NODES ── */}
              {territories.map(t => {
                const cx = sx(t.x), cy = sy(t.y);
                const color = t.ownerId ? factionColor(t.ownerId) : (t.status === "ruins" ? "#4b5563" : "#374151");
                const isRuins = t.status === "ruins";
                const isAbandoned = t.status === "abandoned";
                const isSelected = t.id === selectedId;
                const isDimmed  = highlightFaction && t.ownerId !== highlightFaction;
                const radius = NODE_BASE + Math.min(14, Math.sqrt(t.population / 4));
                const prosRadius = radius + 6;

                return (
                  <g
                    key={t.id}
                    style={{ cursor: "pointer", opacity: isDimmed ? 0.3 : 1, transition: "opacity 0.2s" }}
                    onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                    onMouseEnter={e => handleMouseEnter(e, t)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Prosperity ring (heatmap) */}
                    {showProsperity && !isRuins && (
                      <circle
                        cx={cx} cy={cy} r={prosRadius}
                        fill="none"
                        stroke={`hsl(${t.prosperity * 1.2}, 70%, 55%)`}
                        strokeWidth="3"
                        strokeOpacity={0.5}
                      />
                    )}

                    {/* Selection glow */}
                    {isSelected && (
                      <circle cx={cx} cy={cy} r={radius + 8}
                        fill="none" stroke="#fff" strokeWidth="1.5"
                        strokeDasharray="4 3" opacity={0.7}
                        style={{ animation: "spin 4s linear infinite" }}
                      />
                    )}

                    {/* Main territory circle */}
                    <circle
                      cx={cx} cy={cy} r={radius}
                      fill={isRuins ? "#1f2937" : color + (isAbandoned ? "66" : "33")}
                      stroke={isRuins ? "#374151" : color}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      filter={isSelected ? "url(#glow)" : undefined}
                    />

                    {/* Status overlay */}
                    {(isRuins || isAbandoned) && (
                      <circle cx={cx} cy={cy} r={radius} fill={STATUS_OVERLAY[t.status] || ""} />
                    )}

                    {/* Territory type icon */}
                    <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize="14" style={{ userSelect: "none", pointerEvents: "none" }}>
                      {isRuins ? "💀" : t.type === "city" ? "🏙" : t.type === "harbor" ? "⚓" : t.type === "farmland" ? "🌾" : "🏘"}
                    </text>

                    {/* Population badge */}
                    {!isRuins && t.population > 0 && (
                      <g>
                        <circle cx={cx + radius - 2} cy={cy - radius + 2} r={10}
                          fill="#111827" stroke={color} strokeWidth="1"/>
                        <text x={cx + radius - 2} y={cy - radius + 2}
                          textAnchor="middle" dominantBaseline="middle"
                          fontSize="7.5" fill={color} fontWeight="bold" style={{ pointerEvents: "none" }}>
                          {t.population > 999 ? `${(t.population/1000).toFixed(1)}k` : t.population}
                        </text>
                      </g>
                    )}

                    {/* Security indicator bar */}
                    {!isRuins && (
                      <rect x={cx - radius} y={cy + radius + 2} width={radius * 2} height={3}
                        fill="#1f2937" rx="1"/>
                    )}
                    {!isRuins && (
                      <rect x={cx - radius} y={cy + radius + 2}
                        width={Math.max(2, (t.security / 100) * radius * 2)} height={3}
                        fill={t.security > 60 ? "#22c55e" : t.security > 30 ? "#f59e0b" : "#ef4444"} rx="1"/>
                    )}

                    {/* Territory name */}
                    <text x={cx} y={cy + radius + 14} textAnchor="middle"
                      fontSize="9" fill={isRuins ? "#6b7280" : "#d1d5db"}
                      fontWeight={isSelected ? "bold" : "normal"}
                      style={{ pointerEvents: "none" }}>
                      {t.name.length > 14 ? t.name.slice(0, 12) + "…" : t.name}
                    </text>

                    {/* Owner faction label */}
                    {t.owner && !isRuins && (
                      <text x={cx} y={cy + radius + 24} textAnchor="middle"
                        fontSize="7.5" fill={color} opacity={0.8}
                        style={{ pointerEvents: "none" }}>
                        {t.owner.length > 14 ? t.owner.slice(0, 12) + "…" : t.owner}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── ARMY MARKERS ── */}
              {showArmies && armies.filter(a => a.soldiers > 0).map(a => {
                const terr = territories.find(t => t.id === a.territoryId);
                if (!terr) return null;
                const cx = sx(terr.x) + NODE_BASE + 4;
                const cy = sy(terr.y) - NODE_BASE - 4;
                const color = terr.ownerId ? factionColor(terr.ownerId) : "#ef4444";
                return (
                  <g key={a.id}>
                    <circle cx={cx} cy={cy} r={10} fill="#1a0505" stroke={color} strokeWidth="1.5"/>
                    <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="10"
                      style={{ pointerEvents: "none" }}>⚔</text>
                    <text x={cx} y={cy + 14} textAnchor="middle" fontSize="6.5" fill={color}
                      style={{ pointerEvents: "none" }}>
                      {a.soldiers > 999 ? `${(a.soldiers/1000).toFixed(1)}k` : a.soldiers}
                    </text>
                  </g>
                );
              })}

              {/* ── TOOLTIP ── */}
              {tooltip.t && (
                <g style={{ pointerEvents: "none" }}>
                  <rect x={Math.min(tooltip.x, MAP_W - 160)} y={Math.min(tooltip.y, MAP_H - 110)}
                    width={155} height={100} rx="5"
                    fill="#0f172a" stroke="#374151" strokeWidth="1" fillOpacity="0.95"/>
                  <text x={Math.min(tooltip.x + 8, MAP_W - 152)} y={Math.min(tooltip.y + 16, MAP_H - 94)}
                    fontSize="10" fill="#f1f5f9" fontWeight="bold">{tooltip.t.name}</text>
                  {[
                    `👥 Dân số: ${tooltip.t.population}`,
                    `💰 Thịnh vượng: ${tooltip.t.prosperity}/100`,
                    `🛡 An ninh: ${tooltip.t.security}/100`,
                    `📍 Trạng thái: ${tooltip.t.status}`,
                    tooltip.t.owner ? `🏴 Phe: ${tooltip.t.owner.slice(0, 16)}` : "🏳 Chưa có chủ",
                  ].map((line, i) => (
                    <text key={i}
                      x={Math.min(tooltip.x + 8, MAP_W - 152)} y={Math.min(tooltip.y + 30, MAP_H - 80) + i * 14}
                      fontSize="8.5" fill="#94a3b8">{line}</text>
                  ))}
                </g>
              )}
            </svg>

            {/* Refresh timestamp */}
            {mapState && (
              <div className="absolute bottom-2 right-3 text-gray-600 text-xs">
                Cập nhật: {new Date(mapState.ts).toLocaleTimeString("vi-VN")}
              </div>
            )}
          </div>

          {/* ── TIMELINE SLIDER ── */}
          {timeline.length > 0 && (
            <div className="mt-2 bg-gray-950 border border-gray-800 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-cyan-400 text-xs font-bold whitespace-nowrap">📜 LỊCH SỬ</span>
                <div className="flex-1 flex flex-col gap-1">
                  <input
                    type="range" min={1} max={Math.max(maxTick, 1)} value={sliderTick}
                    onChange={e => setSliderTick(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                  <div className="flex justify-between text-gray-600 text-xs">
                    <span>Tick 1</span>
                    <span className="text-cyan-400">Tick {sliderTick}</span>
                    <span>Tick {maxTick}</span>
                  </div>
                </div>
              </div>
              {/* Events at sliderTick */}
              {tickEvents.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tickEvents.map((e, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full border"
                      style={{ borderColor: EVENT_COLOR[e.eventType] || "#6b7280", color: EVENT_COLOR[e.eventType] || "#9ca3af" }}>
                      {EVENT_ICON[e.eventType] || "📜"} {e.title}
                    </span>
                  ))}
                </div>
              )}
              {tickEvents.length === 0 && sliderTick > 0 && (
                <div className="mt-1 text-gray-600 text-xs">Không có sự kiện tại tick {sliderTick}</div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: PANELS ── */}
        <div className="w-72 border-l border-gray-800 flex flex-col overflow-hidden bg-gray-950">
          {/* ── Territory Detail ── */}
          {selectedTerritory ? (
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white truncate">{selectedTerritory.name}</span>
                <button onClick={() => setSelectedId(null)} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  ["Loại", selectedTerritory.type],
                  ["Địa hình", selectedTerritory.terrain],
                  ["Trạng thái", selectedTerritory.status],
                  ["Dân số", selectedTerritory.population.toLocaleString()],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-gray-200">{v}</span>
                  </div>
                ))}
                {/* Bars */}
                {[
                  { label: "Thịnh vượng", val: selectedTerritory.prosperity, color: "#f59e0b" },
                  { label: "An ninh",      val: selectedTerritory.security,   color: selectedTerritory.security > 60 ? "#22c55e" : selectedTerritory.security > 30 ? "#f59e0b" : "#ef4444" },
                ].map(b => (
                  <div key={b.label}>
                    <div className="flex justify-between text-gray-500 mb-0.5"><span>{b.label}</span><span style={{ color: b.color }}>{b.val}/100</span></div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${b.val}%`, backgroundColor: b.color }}/>
                    </div>
                  </div>
                ))}
                {/* Owner */}
                {selectedFaction && (
                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: factionColor(selectedFaction.id) }}/>
                      <span className="text-cyan-300 font-medium truncate">{selectedFaction.name}</span>
                    </div>
                    <div className="text-gray-500 mt-1">{selectedFaction.type} | Ảnh hưởng: {selectedFaction.influence}</div>
                  </div>
                )}
                {/* Army */}
                {selectedArmy && (
                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <div className="text-red-400 font-bold text-xs mb-1">⚔ {selectedArmy.name}</div>
                    {[
                      ["Quân số", selectedArmy.soldiers],
                      ["Sức mạnh", selectedArmy.power],
                      ["Tinh thần", `${selectedArmy.morale}%`],
                      ["Tiếp tế", `${selectedArmy.supply}%`],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="flex justify-between text-xs">
                        <span className="text-gray-500">{k}</span>
                        <span className="text-red-300">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-gray-800 text-gray-600 text-xs text-center">
              Click vào lãnh thổ để xem chi tiết
            </div>
          )}

          {/* ── Faction List ── */}
          <div className="p-3 border-b border-gray-800">
            <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">🏴 Phe Phái ({factions.length})</div>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {factions.length === 0 && <div className="text-gray-600 text-xs">Chưa có phe phái</div>}
              {factions.map(f => {
                const ownedCount = territories.filter(t => t.ownerId === f.id).length;
                const color = factionColor(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => setHighlightFaction(highlightFaction === f.id ? null : f.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-gray-900 transition-colors"
                    style={{ borderLeft: `3px solid ${highlightFaction === f.id ? color : "transparent"}` }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }}/>
                    <span className="text-xs text-gray-300 flex-1 truncate">{f.name}</span>
                    <span className="text-xs font-mono" style={{ color }}>
                      {ownedCount > 0 ? `${ownedCount}⬡` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Stats Summary ── */}
          <div className="p-3 border-b border-gray-800">
            <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">📊 Tổng Quan</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Lãnh thổ", val: territories.length, icon: "⬡" },
                { label: "Tích cực", val: territories.filter(t => t.status === "active").length, icon: "✅" },
                { label: "Phế tích", val: territories.filter(t => t.status === "ruins").length, icon: "💀" },
                { label: "Bỏ hoang", val: territories.filter(t => t.status === "abandoned").length, icon: "⬜" },
                { label: "Tổng dân", val: territories.reduce((s, t) => s + t.population, 0).toLocaleString(), icon: "👥" },
                { label: "Quân đội", val: armies.length, icon: "⚔" },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 rounded px-2 py-1.5 text-center">
                  <div className="text-sm">{s.icon}</div>
                  <div className="text-sm font-bold text-gray-200">{s.val}</div>
                  <div className="text-gray-500 text-xs">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recent History ── */}
          <div className="p-3 flex-1 overflow-hidden flex flex-col">
            <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">📜 Lịch Sử Gần Đây</div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {history.length === 0 && (
                <div className="text-gray-600 text-xs text-center py-4">
                  Chưa có sự kiện lịch sử<br/>
                  <span className="text-gray-700">Bắt đầu simulation để tạo lịch sử</span>
                </div>
              )}
              {history.map((e, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-base leading-tight flex-shrink-0">{EVENT_ICON[e.eventType] || "📜"}</span>
                  <div>
                    <div className="text-xs leading-snug" style={{ color: EVENT_COLOR[e.eventType] || "#a78bfa" }}>
                      {e.title}
                    </div>
                    <div className="text-gray-600 text-xs mt-0.5">Tick {e.tick}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { stroke-dashoffset: 0 } to { stroke-dashoffset: -28 } }
      `}</style>
    </div>
  );
}
