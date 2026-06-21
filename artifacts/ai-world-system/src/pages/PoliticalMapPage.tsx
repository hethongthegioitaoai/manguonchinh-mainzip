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
interface Faction { id: string; name: string; type: string; influence: number; treasury: number; militaryPower?: number }
interface Army { id: string; name: string; territoryId: string; soldiers: number; power: number; morale: number; supply: number }
interface HistoryEvent { id: string; tick: number; eventType: string; title: string; description: string; actors: any; createdAt: string }
interface TimelineEvent { id: string; tick: number; eventType: string; title: string; createdAt: string }
interface MapState { worldSlug: string; ts: number; territories: Territory[]; factions: Faction[]; armies: Army[]; recentHistory: HistoryEvent[] }
interface SnapshotTerritory { id: string; name: string; type: string; x: number; y: number; terrain: string; status: string; population: number; prosperity: number; security: number; ownerFactionId: string | null; ownerFactionName: string | null; militaryPower: number; foodSupply: number }
interface SnapshotFaction { id: string; name: string; type: string; influence: number; treasury: number; militaryPower: number; territoryCount: number }
interface SnapshotArmy { id: string; name: string; territoryId: string; soldiers: number; power: number; morale: number; supply: number }
interface WorldSnapshotData { tick: number; territories: SnapshotTerritory[]; factions: SnapshotFaction[]; armies: SnapshotArmy[] }
interface SnapshotMeta { tick: number; createdAt: string }
interface TerritoryDetail {
  id: string; name: string; type: string; terrain: string; status: string;
  population: number; prosperity: number; security: number; foodSupply: number;
  ownerFactionId: string | null; factionName: string | null;
  factionType: string | null; factionInfluence: number | null;
  factionTreasury: number | null; factionMilitary: number | null;
  govTreasury: number | null; govApproval: number | null;
  army: { id: string; name: string; soldiers: number; power: number; morale: number; supply: number } | null;
  history: { id: string; tick: number; eventType: string; title: string }[];
}
interface EnrichedEvent {
  id: string; tick: number; eventType: string; title: string; description: string;
  actors: any; createdAt: string;
  enriched: {
    factions?: { id: string; name: string; type: string; influence: number; treasury: number; militaryPower: number }[];
    territories?: { id: string; name: string; status: string; population: number; prosperity: number; security: number; factionName: string | null }[];
  };
}

/* ─── Constants ──────────────────────────────────────────── */
const WORLDS = [
  { slug: "cultivation", label: "Tu Tiên" },
  { slug: "cyberpunk",   label: "Cyberpunk" },
  { slug: "zombie",      label: "Hoang Phế" },
];

const MAP_W = 900, MAP_H = 560;
const NODE_BASE = 22;

type HeatMode = "none" | "population" | "prosperity" | "security" | "military" | "food";

const HEAT_LABELS: Record<HeatMode, string> = {
  none: "Bình Thường", population: "Dân Số", prosperity: "Thịnh Vượng",
  security: "An Ninh", military: "Quân Sự", food: "Lương Thực",
};

const HEAT_KEYS: Record<string, HeatMode> = {
  p: "population", s: "security", f: "food", m: "military", o: "prosperity",
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
  collapse: "#6b7280", recolonization: "#22c55e", default: "#a78bfa",
};

function factionColor(id: string): string {
  const PALETTE = [
    "#06b6d4","#8b5cf6","#ec4899","#f59e0b","#10b981",
    "#3b82f6","#ef4444","#84cc16","#f97316","#e879f9",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function heatColor(value: number, mode: HeatMode): string {
  const v = Math.max(0, Math.min(100, value));
  if (mode === "population") {
    const t = Math.min(v / 300, 1);
    const r = Math.round(30 + t * 180);
    const g = Math.round(60 + t * 60);
    const b = Math.round(200 - t * 100);
    return `rgb(${r},${g},${b})`;
  }
  if (mode === "military") {
    const r = Math.round(100 + (v / 100) * 155);
    const g = Math.round(20 + (1 - v / 100) * 40);
    return `rgb(${r},${g},20)`;
  }
  const hue = mode === "security" ? 120 : mode === "food" ? 60 : 40;
  return `hsl(${(v / 100) * hue}, 80%, ${30 + (v / 100) * 30}%)`;
}

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
async function fetchSnapshot(slug: string, tick: number): Promise<WorldSnapshotData> {
  const r = await fetch(`/api/simulation/snapshot/${slug}/${tick}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function fetchSnapshotMetas(slug: string): Promise<SnapshotMeta[]> {
  const r = await fetch(`/api/simulation/snapshots/${slug}`);
  if (!r.ok) return [];
  return r.json();
}
async function fetchTerritoryDetail(worldSlug: string, id: string): Promise<TerritoryDetail> {
  const r = await fetch(`/api/simulation/territory-detail/${worldSlug}/${id}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function fetchEventDetail(worldSlug: string, id: string): Promise<EnrichedEvent> {
  const r = await fetch(`/api/simulation/history/${worldSlug}/event/${id}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ─── StatBar component ──────────────────────────────────── */
function StatBar({ label, val, max = 100, color }: { label: string; val: number; max?: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-500">{label}</span>
        <span style={{ color }}>{val}{max === 100 ? "/100" : ""}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, (val / max) * 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function PoliticalMapPage() {
  const [worldSlug, setWorldSlug] = useState("cultivation");
  const [selectedId, setSelectedId]  = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showArmies, setShowArmies]   = useState(true);
  const [heatMode, setHeatMode]       = useState<HeatMode>("none");
  const [highlightFaction, setHighlightFaction] = useState<string | null>(null);

  /* Phase 57 — Ownership overlay panel */
  const [detailPanelId, setDetailPanelId] = useState<string | null>(null);

  /* Phase 59 — Event inspector */
  const [inspectEventId, setInspectEventId] = useState<string | null>(null);

  /* Phase 60 / 57 — History replay */
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [snapshotTick, setSnapshotTick] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  /* ── Live map state ── */
  const { data: mapState, refetch, isLoading } = useQuery<MapState>({
    queryKey: ["map-state", worldSlug],
    queryFn:  () => fetchMapState(worldSlug),
    refetchInterval: autoRefresh && !snapshotMode ? 8000 : false,
    staleTime: 5000,
  });

  /* ── Timeline ── */
  const { data: timeline = [] } = useQuery<TimelineEvent[]>({
    queryKey: ["timeline", worldSlug],
    queryFn:  () => fetchTimeline(worldSlug),
    refetchInterval: autoRefresh && !snapshotMode ? 30000 : false,
  });

  /* ── Snapshot metas (Phase 60) ── */
  const { data: snapshotMetas = [] } = useQuery<SnapshotMeta[]>({
    queryKey: ["snapshot-metas", worldSlug],
    queryFn:  () => fetchSnapshotMetas(worldSlug),
    staleTime: 30000,
  });

  /* ── Load snapshot data (Phase 57 / 60) ── */
  const { data: snapshotData } = useQuery<WorldSnapshotData>({
    queryKey: ["snapshot", worldSlug, snapshotTick],
    queryFn:  () => fetchSnapshot(worldSlug, snapshotTick!),
    enabled:  snapshotMode && snapshotTick !== null,
    staleTime: Infinity,
  });

  /* ── Territory detail (Phase 57) ── */
  const { data: territoryDetail, isLoading: detailLoading } = useQuery<TerritoryDetail>({
    queryKey: ["territory-detail", worldSlug, detailPanelId],
    queryFn:  () => fetchTerritoryDetail(worldSlug, detailPanelId!),
    enabled:  detailPanelId !== null && !snapshotMode,
    staleTime: 10000,
  });

  /* ── Event inspector (Phase 59) ── */
  const { data: eventDetail } = useQuery<EnrichedEvent>({
    queryKey: ["event-detail", worldSlug, inspectEventId],
    queryFn:  () => fetchEventDetail(worldSlug, inspectEventId!),
    enabled:  inspectEventId !== null,
    staleTime: Infinity,
  });

  /* ── Keyboard shortcuts (Phase 58) ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toLowerCase();
      if (key in HEAT_KEYS) {
        setHeatMode(prev => prev === HEAT_KEYS[key] ? "none" : HEAT_KEYS[key]);
      } else if (key === "escape") {
        setHeatMode("none"); setSelectedId(null); setDetailPanelId(null); setInspectEventId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Reset snapshot when world changes ── */
  useEffect(() => { setSnapshotMode(false); setSnapshotTick(null); setSelectedId(null); setDetailPanelId(null); }, [worldSlug]);

  /* ── Determine active data source (live vs snapshot) ── */
  const maxTick = timeline.length > 0 ? Math.max(...timeline.map(t => t.tick)) : 0;
  const [sliderTick, setSliderTick] = useState(0);
  useEffect(() => { if (maxTick > 0 && !snapshotMode) setSliderTick(maxTick); }, [maxTick, snapshotMode]);

  let territories: Array<Territory | SnapshotTerritory> = [];
  let factions:    Array<Faction | SnapshotFaction>     = [];
  let armies:      Array<Army | SnapshotArmy>           = [];

  if (snapshotMode && snapshotData) {
    territories = snapshotData.territories.map(t => ({
      ...t, owner: t.ownerFactionName, ownerId: t.ownerFactionId,
    }));
    factions = snapshotData.factions;
    armies   = snapshotData.armies;
  } else {
    territories = mapState?.territories ?? [];
    factions    = mapState?.factions ?? [];
    armies      = mapState?.armies ?? [];
  }

  /* ── Coordinate scaling ── */
  const xs = territories.map(t => t.x);
  const ys = territories.map(t => t.y);
  const minX = xs.length ? Math.min(...xs) : 0, maxX = xs.length ? Math.max(...xs) : 100;
  const minY = ys.length ? Math.min(...ys) : 0, maxY = ys.length ? Math.max(...ys) : 100;
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
  const PAD = 60;
  function sx(x: number) { return PAD + ((x - minX) / rangeX) * (MAP_W - PAD * 2); }
  function sy(y: number) { return PAD + ((y - minY) / rangeY) * (MAP_H - PAD * 2); }

  const armyMap = new Map<string, Army | SnapshotArmy>();
  armies.forEach((a: any) => { if (a.territoryId) armyMap.set(a.territoryId, a); });

  const selectedTerritory = territories.find(t => t.id === selectedId) ?? null;
  const selectedFaction   = selectedTerritory ? factions.find((f: any) => f.id === (selectedTerritory as any).ownerId || f.id === (selectedTerritory as any).ownerFactionId) : null;

  /* Phase 58 — heatmap value for a territory */
  function heatValue(t: any): number {
    if (heatMode === "population") return Math.min(100, t.population / 3);
    if (heatMode === "prosperity") return t.prosperity ?? 50;
    if (heatMode === "security")   return t.security ?? 50;
    if (heatMode === "military")   return Math.min(100, (t.militaryPower ?? (armyMap.get(t.id) as any)?.power ?? 0) / 10);
    if (heatMode === "food")       return t.foodSupply ?? Math.round((t.prosperity ?? 50) * 0.6 + (t.security ?? 50) * 0.4);
    return 0;
  }

  /* Timeline events at sliderTick */
  const tickEvents = timeline.filter(e => e.tick === sliderTick);

  /* Phase 60 — preset replay ticks */
  const REPLAY_PRESETS = [100, 300, 700, 1000];

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-black text-gray-100" style={{ fontFamily: "monospace" }}>

      {/* ── HEADER ── */}
      <div className="border-b border-cyan-900/50 px-4 py-2 flex items-center gap-3 flex-wrap">
        <Link href="/dashboard">
          <span className="text-cyan-500 hover:text-cyan-300 text-sm cursor-pointer">← Dashboard</span>
        </Link>
        <span className="text-cyan-400 font-bold text-base tracking-widest">🗺 BẢN ĐỒ CHÍNH TRỊ</span>

        {snapshotMode && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-600 text-purple-300 animate-pulse">
            ⏪ REPLAY: Tick {snapshotTick}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap text-xs">
          {/* World selector */}
          <select
            value={worldSlug}
            onChange={e => { setWorldSlug(e.target.value); setSelectedId(null); setDetailPanelId(null); }}
            className="bg-gray-900 border border-cyan-800 text-cyan-300 px-2 py-1 rounded text-xs"
          >
            {WORLDS.map(w => <option key={w.slug} value={w.slug}>{w.label}</option>)}
          </select>

          {/* Phase 58 — Heatmap toggle buttons */}
          {(["population","prosperity","security","military","food"] as HeatMode[]).map(mode => (
            <button key={mode}
              onClick={() => setHeatMode(prev => prev === mode ? "none" : mode)}
              className={`px-2 py-1 rounded border transition-colors ${heatMode === mode ? "border-yellow-400 text-yellow-300 bg-yellow-900/30" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}
              title={`Heatmap: ${HEAT_LABELS[mode]}`}
            >
              {mode === "population" ? "P👥" : mode === "prosperity" ? "💰" : mode === "security" ? "S🛡" : mode === "military" ? "M⚔" : "F🌾"}
            </button>
          ))}

          <button onClick={() => setShowArmies(v => !v)}
            className={`px-2 py-1 rounded border ${showArmies ? "border-red-600 text-red-400" : "border-gray-700 text-gray-500"}`}>
            ⚔ Quân
          </button>

          {/* Live / snapshot toggle */}
          {snapshotMode ? (
            <button onClick={() => { setSnapshotMode(false); setSnapshotTick(null); setSliderTick(maxTick); refetch(); }}
              className="px-2 py-1 rounded border border-cyan-600 text-cyan-400">
              ● LIVE
            </button>
          ) : (
            <button onClick={() => { setAutoRefresh(v => !v); refetch(); }}
              className={`px-2 py-1 rounded border ${autoRefresh ? "border-green-600 text-green-400" : "border-gray-700 text-gray-400"}`}>
              {autoRefresh ? "● LIVE" : "○ PAUSE"}
            </button>
          )}
        </div>
      </div>

      {/* ── KEYBOARD HINT ── */}
      <div className="px-4 py-1 border-b border-gray-900 text-gray-600 text-xs flex gap-4">
        <span>Phím tắt heatmap:</span>
        <span><kbd className="bg-gray-800 px-1 rounded">P</kbd> Dân số</span>
        <span><kbd className="bg-gray-800 px-1 rounded">S</kbd> An ninh</span>
        <span><kbd className="bg-gray-800 px-1 rounded">F</kbd> Lương thực</span>
        <span><kbd className="bg-gray-800 px-1 rounded">M</kbd> Quân sự</span>
        <span><kbd className="bg-gray-800 px-1 rounded">O</kbd> Thịnh vượng</span>
        <span><kbd className="bg-gray-800 px-1 rounded">Esc</kbd> Xóa</span>
        {heatMode !== "none" && (
          <span className="text-yellow-400 font-bold ml-2">● {HEAT_LABELS[heatMode].toUpperCase()} MODE</span>
        )}
      </div>

      <div className="flex" style={{ height: "calc(100vh - 88px)" }}>

        {/* ── LEFT: MAP ── */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden min-w-0">

          {/* SVG Map */}
          <div className="relative flex-1 bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
            {isLoading && territories.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-cyan-400 text-sm">Đang tải bản đồ...</div>
            )}
            {!isLoading && territories.length === 0 && !snapshotMode && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500">
                <span className="text-3xl">🗺</span>
                <span className="text-sm">Chưa có lãnh thổ nào</span>
              </div>
            )}

            <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-full">
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

              {/* Connection lines */}
              {territories.map((ta: any) =>
                territories
                  .filter((tb: any) => tb.id > ta.id && Math.abs(ta.x - tb.x) + Math.abs(ta.y - tb.y) < 50)
                  .map((tb: any) => (
                    <line key={`${ta.id}-${tb.id}`}
                      x1={sx(ta.x)} y1={sy(ta.y)} x2={sx(tb.x)} y2={sy(tb.y)}
                      stroke="#1a2a1a" strokeWidth="1" strokeDasharray="4 6"/>
                  ))
              )}

              {/* Territory nodes */}
              {territories.map((t: any) => {
                const cx = sx(t.x), cy = sy(t.y);
                const ownerId  = t.ownerId ?? t.ownerFactionId;
                const baseColor = ownerId ? factionColor(ownerId) : (t.status === "ruins" ? "#4b5563" : "#374151");
                const isRuins    = t.status === "ruins";
                const isAbandoned = t.status === "abandoned";
                const isSelected = t.id === selectedId;
                const isDimmed   = highlightFaction && ownerId !== highlightFaction;
                const radius = NODE_BASE + Math.min(14, Math.sqrt(t.population / 4));

                /* Phase 58 — Heatmap fill */
                const fillColor = heatMode !== "none" && !isRuins
                  ? heatColor(heatValue(t), heatMode)
                  : isRuins ? "#1f2937" : baseColor + (isAbandoned ? "66" : "33");
                const strokeColor = heatMode !== "none" && !isRuins ? heatColor(heatValue(t), heatMode) : (isRuins ? "#374151" : baseColor);

                return (
                  <g key={t.id}
                    style={{ cursor: "pointer", opacity: isDimmed ? 0.3 : 1, transition: "opacity 0.2s" }}
                    onClick={() => {
                      const newId = t.id === selectedId ? null : t.id;
                      setSelectedId(newId);
                      setDetailPanelId(newId);
                    }}
                  >
                    {/* Heatmap glow ring */}
                    {heatMode !== "none" && !isRuins && (
                      <circle cx={cx} cy={cy} r={radius + 5}
                        fill={strokeColor} fillOpacity={0.15}
                        stroke={strokeColor} strokeWidth="1.5" strokeOpacity={0.4}/>
                    )}

                    {/* Selection glow */}
                    {isSelected && (
                      <circle cx={cx} cy={cy} r={radius + 9}
                        fill="none" stroke="#fff" strokeWidth="1.5"
                        strokeDasharray="4 3" opacity={0.7}/>
                    )}

                    {/* Main circle */}
                    <circle cx={cx} cy={cy} r={radius}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      filter={isSelected ? "url(#glow)" : undefined}/>

                    {/* Status overlay */}
                    {(isRuins || isAbandoned) && (
                      <circle cx={cx} cy={cy} r={radius} fill={STATUS_OVERLAY[t.status] || ""}/>
                    )}

                    {/* Icon */}
                    <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize="14" style={{ userSelect: "none", pointerEvents: "none" }}>
                      {isRuins ? "💀" : t.type === "city" ? "🏙" : t.type === "harbor" ? "⚓" : t.type === "farmland" ? "🌾" : "🏘"}
                    </text>

                    {/* Phase 58 — Heatmap value badge */}
                    {heatMode !== "none" && !isRuins && (
                      <g>
                        <circle cx={cx + radius - 2} cy={cy - radius + 2} r={11}
                          fill="#111827" stroke={strokeColor} strokeWidth="1.5"/>
                        <text x={cx + radius - 2} y={cy - radius + 2}
                          textAnchor="middle" dominantBaseline="middle"
                          fontSize="7" fill={strokeColor} fontWeight="bold" style={{ pointerEvents: "none" }}>
                          {Math.round(heatValue(t))}
                        </text>
                      </g>
                    )}

                    {/* Population badge (ownership mode) */}
                    {heatMode === "none" && !isRuins && t.population > 0 && (
                      <g>
                        <circle cx={cx + radius - 2} cy={cy - radius + 2} r={10}
                          fill="#111827" stroke={baseColor} strokeWidth="1"/>
                        <text x={cx + radius - 2} y={cy - radius + 2}
                          textAnchor="middle" dominantBaseline="middle"
                          fontSize="7.5" fill={baseColor} fontWeight="bold" style={{ pointerEvents: "none" }}>
                          {t.population > 999 ? `${(t.population/1000).toFixed(1)}k` : t.population}
                        </text>
                      </g>
                    )}

                    {/* Security bar */}
                    {!isRuins && (
                      <>
                        <rect x={cx - radius} y={cy + radius + 2} width={radius * 2} height={3} fill="#1f2937" rx="1"/>
                        <rect x={cx - radius} y={cy + radius + 2}
                          width={Math.max(2, ((t.security ?? 50) / 100) * radius * 2)} height={3}
                          fill={(t.security ?? 50) > 60 ? "#22c55e" : (t.security ?? 50) > 30 ? "#f59e0b" : "#ef4444"} rx="1"/>
                      </>
                    )}

                    {/* Name */}
                    <text x={cx} y={cy + radius + 14} textAnchor="middle"
                      fontSize="9" fill={isRuins ? "#6b7280" : "#d1d5db"}
                      fontWeight={isSelected ? "bold" : "normal"}
                      style={{ pointerEvents: "none" }}>
                      {t.name.length > 14 ? t.name.slice(0, 12) + "…" : t.name}
                    </text>

                    {/* Owner label */}
                    {(t.owner || t.ownerFactionName) && !isRuins && (
                      <text x={cx} y={cy + radius + 24} textAnchor="middle"
                        fontSize="7.5" fill={baseColor} opacity={0.8}
                        style={{ pointerEvents: "none" }}>
                        {(t.owner || t.ownerFactionName || "").slice(0, 14)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Army markers */}
              {showArmies && armies.filter((a: any) => (a.soldiers ?? a.totalSoldiers ?? 0) > 0).map((a: any) => {
                const terr = territories.find((t: any) => t.id === a.territoryId);
                if (!terr) return null;
                const cx2 = sx(terr.x) + NODE_BASE + 4;
                const cy2 = sy(terr.y) - NODE_BASE - 4;
                const ownerId2 = (terr as any).ownerId ?? (terr as any).ownerFactionId;
                const color = ownerId2 ? factionColor(ownerId2) : "#ef4444";
                return (
                  <g key={a.id}>
                    <circle cx={cx2} cy={cy2} r={10} fill="#1a0505" stroke={color} strokeWidth="1.5"/>
                    <text x={cx2} y={cy2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize="10"
                      style={{ pointerEvents: "none" }}>⚔</text>
                    <text x={cx2} y={cy2 + 14} textAnchor="middle" fontSize="6.5" fill={color}
                      style={{ pointerEvents: "none" }}>
                      {(a.soldiers ?? 0) > 999 ? `${((a.soldiers ?? 0)/1000).toFixed(1)}k` : (a.soldiers ?? 0)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Timestamp / mode badge */}
            <div className="absolute bottom-2 right-3 text-gray-600 text-xs">
              {snapshotMode
                ? <span className="text-purple-400">⏪ Snapshot Tick {snapshotTick}</span>
                : mapState && <span>Cập nhật: {new Date(mapState.ts).toLocaleTimeString("vi-VN")}</span>
              }
            </div>
          </div>

          {/* ── TIMELINE / HISTORY REPLAY ── */}
          <div className="mt-2 bg-gray-950 border border-gray-800 rounded-lg px-4 py-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-cyan-400 text-xs font-bold whitespace-nowrap">📜 LỊCH SỬ</span>

              {/* Phase 57/60 — Replay preset buttons */}
              <span className="text-gray-600 text-xs">Tua lại:</span>
              {REPLAY_PRESETS.map(t => {
                const hasSnap = snapshotMetas.some(s => s.tick <= t);
                return (
                  <button key={t}
                    onClick={() => {
                      if (hasSnap) {
                        setSnapshotMode(true);
                        setSnapshotTick(t);
                        setDetailPanelId(null);
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                      snapshotMode && snapshotTick === t
                        ? "border-purple-400 text-purple-300 bg-purple-900/30"
                        : hasSnap
                          ? "border-gray-600 text-gray-400 hover:border-purple-600 hover:text-purple-400"
                          : "border-gray-800 text-gray-700 cursor-not-allowed"
                    }`}
                    title={hasSnap ? `Xem trạng thái tick ${t}` : `Chưa có snapshot tại tick ${t}`}
                  >
                    ⏪ {t}
                  </button>
                );
              })}

              {/* Custom snapshot ticks */}
              {snapshotMetas.filter(s => !REPLAY_PRESETS.includes(s.tick)).slice(-3).map(s => (
                <button key={s.tick}
                  onClick={() => { setSnapshotMode(true); setSnapshotTick(s.tick); setDetailPanelId(null); }}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                    snapshotMode && snapshotTick === s.tick
                      ? "border-purple-400 text-purple-300 bg-purple-900/30"
                      : "border-gray-700 text-gray-500 hover:border-purple-600 hover:text-purple-400"
                  }`}>
                  ⏪ {s.tick}
                </button>
              ))}

              {snapshotMetas.length === 0 && (
                <span className="text-gray-700 text-xs italic">Chưa có snapshot (mỗi 50 ticks tự lưu)</span>
              )}

              {/* Live button if in snapshot mode */}
              {snapshotMode && (
                <button onClick={() => { setSnapshotMode(false); setSnapshotTick(null); setSliderTick(maxTick); }}
                  className="px-2 py-0.5 rounded text-xs border border-green-600 text-green-400 hover:bg-green-900/20 ml-1">
                  ● Live
                </button>
              )}

              {!snapshotMode && (
                <div className="flex-1 flex flex-col gap-1 ml-2">
                  <input type="range" min={1} max={Math.max(maxTick, 1)} value={sliderTick}
                    onChange={e => setSliderTick(Number(e.target.value))}
                    className="w-full accent-cyan-500"/>
                  <div className="flex justify-between text-gray-600 text-xs">
                    <span>Tick 1</span>
                    <span className="text-cyan-400">Tick {sliderTick}</span>
                    <span>Tick {maxTick}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Events at sliderTick / Phase 59 clickable events */}
            {!snapshotMode && tickEvents.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {tickEvents.map((e, i) => (
                  <button key={i}
                    onClick={() => setInspectEventId(e.id)}
                    className="text-xs px-2 py-0.5 rounded-full border hover:opacity-80 transition-opacity text-left"
                    style={{ borderColor: EVENT_COLOR[e.eventType] || "#6b7280", color: EVENT_COLOR[e.eventType] || "#9ca3af" }}>
                    {EVENT_ICON[e.eventType] || "📜"} {e.title}
                  </button>
                ))}
              </div>
            )}
            {!snapshotMode && tickEvents.length === 0 && sliderTick > 0 && maxTick > 0 && (
              <div className="mt-1 text-gray-700 text-xs">Không có sự kiện tại tick {sliderTick}</div>
            )}
          </div>
        </div>

        {/* ── RIGHT: PANELS ── */}
        <div className="w-72 border-l border-gray-800 flex flex-col overflow-y-auto bg-gray-950 flex-shrink-0">

          {/* Phase 57 — Ownership Overlay Panel */}
          {detailPanelId && !snapshotMode ? (
            <div className="border-b border-gray-800">
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 tracking-wider">🏴 LÃNH THỔ CHI TIẾT</span>
                <button onClick={() => { setDetailPanelId(null); setSelectedId(null); }}
                  className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
              </div>

              {detailLoading && (
                <div className="px-4 pb-3 text-gray-500 text-xs">Đang tải...</div>
              )}

              {territoryDetail && !detailLoading && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Name & status */}
                  <div>
                    <div className="text-sm font-bold text-white">{territoryDetail.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{territoryDetail.type} · {territoryDetail.terrain} · <span className={
                      territoryDetail.status === "active" ? "text-green-400" :
                      territoryDetail.status === "ruins" ? "text-gray-500" : "text-yellow-500"
                    }>{territoryDetail.status}</span></div>
                  </div>

                  {/* Phase 57 — Owner faction block */}
                  {territoryDetail.factionName ? (
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: territoryDetail.ownerFactionId ? factionColor(territoryDetail.ownerFactionId) : "#374151" }}/>
                        <span className="text-cyan-300 font-bold text-xs truncate">{territoryDetail.factionName}</span>
                        <span className="text-gray-600 text-xs">{territoryDetail.factionType}</span>
                      </div>
                      <div className="space-y-1.5">
                        <StatBar label="Ảnh hưởng" val={territoryDetail.factionInfluence ?? 0} color="#a78bfa"/>
                        <StatBar label="Quân sự" val={Math.min(100, (territoryDetail.factionMilitary ?? 0) / 10)} color="#ef4444"/>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Ngân khố</span>
                          <span className="text-yellow-400">{(territoryDetail.factionTreasury ?? 0).toLocaleString()} 💰</span>
                        </div>
                        {territoryDetail.govTreasury !== null && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Gov. Quỹ</span>
                            <span className="text-yellow-300">{(territoryDetail.govTreasury ?? 0).toLocaleString()}</span>
                          </div>
                        )}
                        {territoryDetail.govApproval !== null && (
                          <StatBar label="Ủng hộ" val={territoryDetail.govApproval ?? 0} color="#22c55e"/>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-600 text-xs italic">🏳 Chưa có chủ</div>
                  )}

                  {/* Core stats */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">👥 Dân số</span>
                      <span className="text-white font-bold">{territoryDetail.population.toLocaleString()}</span>
                    </div>
                    <StatBar label="💰 Thịnh vượng" val={territoryDetail.prosperity} color="#f59e0b"/>
                    <StatBar label="🛡 An ninh"     val={territoryDetail.security}
                      color={territoryDetail.security > 60 ? "#22c55e" : territoryDetail.security > 30 ? "#f59e0b" : "#ef4444"}/>
                    <StatBar label="🌾 Lương thực"  val={territoryDetail.foodSupply}
                      color={territoryDetail.foodSupply > 60 ? "#84cc16" : territoryDetail.foodSupply > 30 ? "#f59e0b" : "#ef4444"}/>
                  </div>

                  {/* Army */}
                  {territoryDetail.army && (
                    <div className="bg-gray-900 rounded-lg p-3 border border-red-900/50">
                      <div className="text-red-400 text-xs font-bold mb-2">⚔ {territoryDetail.army.name}</div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Quân số</span>
                          <span className="text-white">{territoryDetail.army.soldiers.toLocaleString()}</span>
                        </div>
                        <StatBar label="Sức mạnh" val={Math.min(100, territoryDetail.army.power / 10)} color="#ef4444"/>
                        <StatBar label="Tinh thần" val={territoryDetail.army.morale} color="#f97316"/>
                        <StatBar label="Tiếp tế"   val={territoryDetail.army.supply}  color="#22c55e"/>
                      </div>
                    </div>
                  )}

                  {/* Territory history */}
                  {territoryDetail.history.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 font-bold mb-1.5">📜 Lịch sử lãnh thổ</div>
                      <div className="space-y-1">
                        {territoryDetail.history.map(h => (
                          <button key={h.id}
                            onClick={() => setInspectEventId(h.id)}
                            className="w-full text-left text-xs px-2 py-1 rounded bg-gray-900 border border-gray-800 hover:border-gray-600 transition-colors">
                            <span style={{ color: EVENT_COLOR[h.eventType] || "#9ca3af" }}>
                              {EVENT_ICON[h.eventType] || "📜"}
                            </span>
                            <span className="text-gray-500 ml-1">Tick {h.tick}</span>
                            <span className="text-gray-300 ml-1">{h.title.length > 24 ? h.title.slice(0, 22) + "…" : h.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          ) : snapshotMode && selectedTerritory ? (
            /* Phase 57 — Snapshot territory detail */
            <div className="border-b border-gray-800 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-purple-400">⏪ TICK {snapshotTick}</span>
                <button onClick={() => setSelectedId(null)} className="text-gray-600 text-xs">✕</button>
              </div>
              <div className="text-sm font-bold text-white mb-1">{selectedTerritory.name}</div>
              {selectedFaction && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-gray-900 rounded">
                  <span className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: factionColor((selectedFaction as any).id) }}/>
                  <span className="text-cyan-300 text-xs truncate">{(selectedFaction as any).name}</span>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">👥 Dân số</span>
                  <span className="text-white">{selectedTerritory.population}</span>
                </div>
                <StatBar label="💰 Thịnh vượng" val={selectedTerritory.prosperity} color="#f59e0b"/>
                <StatBar label="🛡 An ninh"     val={selectedTerritory.security}
                  color={selectedTerritory.security > 60 ? "#22c55e" : selectedTerritory.security > 30 ? "#f59e0b" : "#ef4444"}/>
                {(selectedTerritory as any).foodSupply !== undefined && (
                  <StatBar label="🌾 Lương thực" val={(selectedTerritory as any).foodSupply}
                    color={(selectedTerritory as any).foodSupply > 60 ? "#84cc16" : "#f59e0b"}/>
                )}
                {(selectedTerritory as any).militaryPower > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">⚔ Quân lực</span>
                    <span className="text-red-400">{Math.round((selectedTerritory as any).militaryPower)}</span>
                  </div>
                )}
              </div>
            </div>

          ) : (
            /* No selection — faction list */
            <div className="border-b border-gray-800 px-4 py-3">
              <div className="text-xs font-bold text-gray-500 mb-2 tracking-wider">🏴 CÁC PHE PHÁI</div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {factions.map((f: any) => (
                  <button key={f.id}
                    onClick={() => setHighlightFaction(prev => prev === f.id ? null : f.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                      highlightFaction === f.id ? "bg-gray-800 border border-gray-600" : "hover:bg-gray-900"
                    }`}>
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: factionColor(f.id) }}/>
                    <span className="text-gray-300 truncate flex-1 text-left">{f.name}</span>
                    <span className="text-gray-600">{f.type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Phase 58 — Heatmap Legend */}
          {heatMode !== "none" && (
            <div className="border-b border-gray-800 px-4 py-3">
              <div className="text-xs font-bold text-yellow-400 mb-2">🌡 {HEAT_LABELS[heatMode].toUpperCase()}</div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600">0</span>
                <div className="flex-1 h-3 rounded overflow-hidden" style={{
                  background: heatMode === "security"
                    ? "linear-gradient(to right, hsl(0,80%,30%), hsl(60,80%,50%), hsl(120,80%,40%))"
                    : heatMode === "military"
                      ? "linear-gradient(to right, rgb(100,20,20), rgb(255,40,20))"
                      : heatMode === "population"
                        ? "linear-gradient(to right, rgb(30,60,200), rgb(210,120,100))"
                        : "linear-gradient(to right, hsl(0,80%,30%), hsl(40,80%,60%))"
                }}/>
                <span className="text-xs text-gray-600">100</span>
              </div>
              <div className="text-xs text-gray-600 mt-1">Số trên node = giá trị %</div>
            </div>
          )}

          {/* Snapshot faction summary */}
          {snapshotMode && snapshotData && (
            <div className="border-b border-gray-800 px-4 py-3">
              <div className="text-xs font-bold text-purple-400 mb-2">⏪ PHE PHÁI — Tick {snapshotTick}</div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {snapshotData.factions.map(f => (
                  <div key={f.id} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: factionColor(f.id) }}/>
                    <span className="text-gray-300 truncate flex-1">{f.name}</span>
                    <span className="text-gray-600">{f.territoryCount}🏴</span>
                    <span className="text-yellow-500">{f.treasury}💰</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* World history stream */}
          {mapState?.recentHistory && mapState.recentHistory.length > 0 && !snapshotMode && (
            <div className="flex-1 px-4 py-3 overflow-y-auto">
              <div className="text-xs font-bold text-gray-500 mb-2 tracking-wider">📜 SỰ KIỆN GẦN ĐÂY</div>
              <div className="space-y-1.5">
                {mapState.recentHistory.slice(0, 20).map((e: any, i) => (
                  <button key={i}
                    onClick={() => setInspectEventId(e.id)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded bg-gray-900 border border-gray-800 hover:border-gray-600 transition-colors block">
                    <div className="flex items-start gap-1.5">
                      <span>{EVENT_ICON[e.eventType] || "📜"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-300 truncate">{e.title}</div>
                        <div className="text-gray-600 text-xs mt-0.5">Tick {e.tick}</div>
                      </div>
                      <span style={{ color: EVENT_COLOR[e.eventType] || "#6b7280" }} className="text-xs whitespace-nowrap">
                        {e.eventType.replace("_", " ")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Phase 59 — EVENT INSPECTOR MODAL ══ */}
      {inspectEventId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setInspectEventId(null)}>
          <div className="bg-gray-950 border border-gray-700 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {!eventDetail ? (
              <div className="p-8 text-center text-gray-500 text-sm">Đang tải sự kiện...</div>
            ) : (
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{EVENT_ICON[eventDetail.eventType] || "📜"}</span>
                      <span className="font-bold text-white text-base">{eventDetail.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="px-2 py-0.5 rounded-full border"
                        style={{ borderColor: EVENT_COLOR[eventDetail.eventType] || "#6b7280", color: EVENT_COLOR[eventDetail.eventType] || "#9ca3af" }}>
                        {eventDetail.eventType.replace(/_/g, " ")}
                      </span>
                      <span className="text-gray-500">Tick {eventDetail.tick}</span>
                      <span className="text-gray-600">{new Date(eventDetail.createdAt).toLocaleString("vi-VN")}</span>
                    </div>
                  </div>
                  <button onClick={() => setInspectEventId(null)}
                    className="text-gray-500 hover:text-gray-300 text-lg ml-4">✕</button>
                </div>

                {/* Description */}
                <div className="bg-gray-900 rounded-lg p-3 text-sm text-gray-300 mb-4 leading-relaxed border border-gray-800">
                  {eventDetail.description || "Không có mô tả"}
                </div>

                {/* Involved territories */}
                {eventDetail.enriched.territories && eventDetail.enriched.territories.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-bold text-gray-500 mb-2 tracking-wider">🏴 LÃNH THỔ LIÊN QUAN</div>
                    <div className="space-y-2">
                      {eventDetail.enriched.territories.map(t => (
                        <div key={t.id} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium text-sm">{t.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              t.status === "active" ? "bg-green-900/50 text-green-400" :
                              t.status === "ruins"  ? "bg-gray-800 text-gray-500" : "bg-yellow-900/50 text-yellow-400"
                            }`}>{t.status}</span>
                          </div>
                          {t.factionName && (
                            <div className="text-xs text-cyan-400 mb-2">🏴 {t.factionName}</div>
                          )}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="text-center bg-gray-800 rounded p-1.5">
                              <div className="text-gray-500">👥 Dân</div>
                              <div className="text-white font-bold">{t.population}</div>
                            </div>
                            <div className="text-center bg-gray-800 rounded p-1.5">
                              <div className="text-gray-500">💰 Vượng</div>
                              <div className="text-yellow-400 font-bold">{t.prosperity}</div>
                            </div>
                            <div className="text-center bg-gray-800 rounded p-1.5">
                              <div className="text-gray-500">🛡 An</div>
                              <div className={`font-bold ${t.security > 60 ? "text-green-400" : t.security > 30 ? "text-yellow-400" : "text-red-400"}`}>
                                {t.security}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Involved factions */}
                {eventDetail.enriched.factions && eventDetail.enriched.factions.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 mb-2 tracking-wider">⚔ PHE PHÁI LIÊN QUAN</div>
                    <div className="space-y-2">
                      {eventDetail.enriched.factions.map(f => (
                        <div key={f.id} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: factionColor(f.id) }}/>
                            <span className="text-white font-medium">{f.name}</span>
                            <span className="text-gray-600 text-xs">{f.type}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="text-center bg-gray-800 rounded p-1.5">
                              <div className="text-gray-500">Ảnh hưởng</div>
                              <div className="text-purple-400 font-bold">{f.influence}</div>
                            </div>
                            <div className="text-center bg-gray-800 rounded p-1.5">
                              <div className="text-gray-500">Ngân khố</div>
                              <div className="text-yellow-400 font-bold">{f.treasury}</div>
                            </div>
                            <div className="text-center bg-gray-800 rounded p-1.5">
                              <div className="text-gray-500">Quân sự</div>
                              <div className="text-red-400 font-bold">{f.militaryPower}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
