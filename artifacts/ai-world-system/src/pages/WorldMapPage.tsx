import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Map, Shield, Sword, Users, Wheat, Anchor, Castle, Mountain,
  Trees, Waves, Globe, ZoomIn, ZoomOut, Maximize2, RefreshCw,
  X, ChevronRight, Sparkles, TrendingUp, TrendingDown,
  AlertTriangle, Loader2
} from "lucide-react";

/* ─────────────────────────── Types ─────────────────────────── */
interface MapTerritory {
  id: string;
  worldSlug: string;
  name: string;
  type: string;
  x: number;
  y: number;
  terrain: string;
  population: number;
  prosperity: number;
  security: number;
  ownerFactionId: string | null;
  factionName: string | null;
  factionColor: string;
  govType: string | null;
  govTreasury: number | null;
  govApproval: number | null;
}

interface War {
  id: string;
  attackerWorldSlug: string;
  defenderWorldSlug: string;
  attackerWorldName: string;
  defenderWorldName: string;
  status: string;
  attackerScore: number;
  defenderScore: number;
}

interface PlayerLocation {
  id: string;
  userId: string;
  characterId: string;
  currentTerritoryId: string | null;
  occupation: string;
}

interface MapData {
  territories: MapTerritory[];
  wars: War[];
  players: PlayerLocation[];
  armies: any[];
}

/* ─────────────────────────── Constants ─────────────────────────── */
const TERRAIN_FILL: Record<string, string> = {
  plains:   "#1a3020",
  mountain: "#252535",
  forest:   "#0d2518",
  desert:   "#352510",
  sea:      "#0a1a2e",
  swamp:    "#0d1e1e",
  volcano:  "#2a0808",
};

const TERRAIN_LABEL: Record<string, string> = {
  plains: "Đồng Bằng", mountain: "Núi Cao", forest: "Rừng Sâu",
  desert: "Sa Mạc", sea: "Biển Cả", swamp: "Đầm Lầy", volcano: "Núi Lửa",
};

const TYPE_ICON: Record<string, string> = {
  city: "🏙", village: "🏘", farm: "🌾", port: "⚓",
  fortress: "🏰", ruins: "🏚", wilderness: "🌿",
};

const TYPE_LABEL: Record<string, string> = {
  city: "Thành Phố", village: "Làng", farm: "Nông Trại",
  port: "Cảng Biển", fortress: "Pháo Đài", ruins: "Phế Tích", wilderness: "Hoang Dã",
};

/* ─────────────────────────── Helpers ─────────────────────────── */
const MAP_W = 1000;
const MAP_H = 620;

function tx(x: number) { return x * (MAP_W / 100); }
function ty(y: number) { return y * (MAP_H / 100); }

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
}

function nodeRadius(pop: number): number {
  return Math.max(22, Math.min(48, 22 + (pop / 300)));
}

function darken(hex: string, factor = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},0.4)`;
}

function adjacency(terrs: MapTerritory[]): [number, number][] {
  const result: [number, number][] = [];
  for (let i = 0; i < terrs.length; i++) {
    for (let j = i + 1; j < terrs.length; j++) {
      const dx = tx(terrs[i].x) - tx(terrs[j].x);
      const dy = ty(terrs[i].y) - ty(terrs[j].y);
      if (Math.sqrt(dx * dx + dy * dy) < 170) result.push([i, j]);
    }
  }
  return result;
}

/* ─────────────────────────── Sub-components ─────────────────────────── */
function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function TerritoryIcon({ type, size = 14 }: { type: string; size?: number }) {
  return <span style={{ fontSize: size }}>{TYPE_ICON[type] ?? "🗺"}</span>;
}

/* ─────────────────────────── Main Page ─────────────────────────── */
export default function WorldMapPage() {
  const qc = useQueryClient();

  /* world selector */
  const [worldSlug, setWorldSlug] = useState("");
  const { data: worlds = [] } = useQuery<any[]>({
    queryKey: ["/api/custom-worlds"],
    queryFn: async () => {
      const r = await fetch("/api/custom-worlds");
      if (!r.ok) return [];
      return r.json();
    },
  });

  /* auto-select first world */
  useEffect(() => {
    if (!worldSlug && worlds.length > 0) {
      setWorldSlug(worlds[0].slug ?? worlds[0].id ?? "");
    }
  }, [worlds, worldSlug]);

  /* map data */
  const { data: mapData, isLoading: loadingMap, refetch: refetchMap } = useQuery<MapData>({
    queryKey: ["/api/world-map", worldSlug],
    queryFn: async () => {
      if (!worldSlug) return { territories: [], wars: [], players: [], armies: [] };
      const r = await fetch(`/api/world-map/${worldSlug}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    enabled: !!worldSlug,
    refetchInterval: 15000,
  });

  /* player agents for current user */
  const { data: myAgents = [] } = useQuery<any[]>({
    queryKey: ["/api/world-map/player/me"],
    queryFn: async () => {
      const r = await fetch("/api/world-map/player/me");
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: 30000,
  });
  const playerAgent = myAgents.find((a) => a.worldSlug === worldSlug) ?? myAgents[0] ?? null;

  /* selected territory */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detailData, isLoading: loadingDetail } = useQuery<any>({
    queryKey: ["/api/world-map/territory", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const r = await fetch(`/api/world-map/territory/${selectedId}`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedId,
  });

  /* SVG viewBox pan/zoom */
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState({ x: 0, y: 0, w: MAP_W, h: MAP_H });
  const [dragging, setDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.12 : 0.88;
      setVb((p) => {
        const newW = Math.max(200, Math.min(MAP_W * 3, p.w * factor));
        const newH = (newW / MAP_W) * MAP_H;
        return { x: p.x, y: p.y, w: newW, h: newH };
      });
    },
    [],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as SVGElement).tagName === "polygon" ||
      (e.target as SVGElement).tagName === "text") return;
    setDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = vb.w / rect.width;
    const sy = vb.h / rect.height;
    setVb((p) => ({
      ...p,
      x: p.x - (e.clientX - lastMouse.x) * sx,
      y: p.y - (e.clientY - lastMouse.y) * sy,
    }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const resetView = () => setVb({ x: 0, y: 0, w: MAP_W, h: MAP_H });
  const zoomIn = () => setVb((p) => ({ x: p.x + p.w * 0.1, y: p.y + p.h * 0.1, w: p.w * 0.8, h: p.h * 0.8 }));
  const zoomOut = () => setVb((p) => ({ x: p.x - p.w * 0.1, y: p.y - p.h * 0.1, w: Math.min(MAP_W * 2.5, p.w * 1.25), h: Math.min(MAP_H * 2.5, p.h * 1.25) }));

  /* tooltip hover */
  const [tooltip, setTooltip] = useState<{ x: number; y: number; t: MapTerritory } | null>(null);

  /* seed mutation */
  const seedMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/world-map/${worldSlug}/seed`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => refetchMap(),
  });

  /* move player mutation */
  const moveMut = useMutation({
    mutationFn: async (toTerritoryId: string) => {
      const r = await fetch("/api/world-map/player/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: playerAgent?.characterId,
          toTerritoryId,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/player-agent/mine"] });
      refetchMap();
    },
  });

  /* computed */
  const territories = mapData?.territories ?? [];
  const wars = mapData?.wars ?? [];
  const players = mapData?.players ?? [];
  const myTerritoryId = playerAgent?.currentTerritoryId ?? null;
  const myCharacterId = playerAgent?.characterId ?? null;
  const myWorldSlug = playerAgent?.worldSlug ?? null;

  const edges = useMemo(() => adjacency(territories), [territories]);
  const hasPositions = territories.some((t) => t.x !== 50 || t.y !== 50);

  /* war capital: highest pop territory in each warring world */
  const warPaths = useMemo(() => {
    return wars.map((war) => {
      const attTerrs = territories.filter((t) => t.worldSlug === war.attackerWorldSlug);
      const defTerrs = territories.filter((t) => t.worldSlug === war.defenderWorldSlug);
      const attCapital = attTerrs.sort((a, b) => b.population - a.population)[0];
      const defCapital = defTerrs.sort((a, b) => b.population - a.population)[0];
      return { war, from: attCapital, to: defCapital };
    }).filter((p) => p.from && p.to);
  }, [wars, territories]);

  /* players on map indexed by territoryId */
  const playersOnTerritory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of players) {
      if (p.currentTerritoryId) m[p.currentTerritoryId] = (m[p.currentTerritoryId] ?? 0) + 1;
    }
    return m;
  }, [players]);

  const isMyWorld = myWorldSlug === worldSlug;
  const selectedTerritory = territories.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* ── Header ── */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-cyan-400" />
          <span className="font-bold text-cyan-400 tracking-wider">BẢN ĐỒ THẾ GIỚI</span>
        </div>

        <select
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:border-cyan-500 focus:outline-none"
          value={worldSlug}
          onChange={(e) => setWorldSlug(e.target.value)}
        >
          <option value="">— Chọn thế giới —</option>
          {worlds.map((w: any) => (
            <option key={w.slug ?? w.id} value={w.slug ?? w.id}>
              {w.name}
            </option>
          ))}
        </select>

        {worldSlug && !hasPositions && (
          <button
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700/70 hover:bg-purple-600/80 border border-purple-500 rounded text-xs font-medium transition-colors disabled:opacity-50"
          >
            {seedMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Tạo Vị Trí Bản Đồ
          </button>
        )}

        {worldSlug && hasPositions && (
          <button
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs transition-colors disabled:opacity-50"
          >
            {seedMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-gray-400" />}
            Tái Tạo
          </button>
        )}

        <button
          onClick={() => refetchMap()}
          className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Làm Mới
        </button>

        {wars.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-900/40 border border-red-700/50 rounded text-xs text-red-400 animate-pulse">
            <Sword className="w-3.5 h-3.5" />
            {wars.length} Chiến Tranh Đang Diễn Ra
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── SVG Map Canvas ── */}
        <div className="relative flex-1 overflow-hidden bg-gray-950">
          {loadingMap && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          )}

          {!worldSlug && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600">
              <div className="text-center space-y-2">
                <Map className="w-12 h-12 mx-auto opacity-30" />
                <p className="text-sm">Chọn một thế giới để hiển thị bản đồ</p>
              </div>
            </div>
          )}

          {worldSlug && !loadingMap && territories.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600">
              <div className="text-center space-y-3">
                <Map className="w-12 h-12 mx-auto opacity-30" />
                <p className="text-sm">Thế giới này chưa có lãnh thổ nào</p>
              </div>
            </div>
          )}

          {territories.length > 0 && (
            <svg
              ref={svgRef}
              className="w-full h-full"
              viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => { setDragging(false); setTooltip(null); }}
              style={{ cursor: dragging ? "grabbing" : "default" }}
            >
              <defs>
                {/* Terrain fill patterns */}
                <radialGradient id="bg-grad" cx="50%" cy="50%" r="80%">
                  <stop offset="0%" stopColor="#0a0f1a" />
                  <stop offset="100%" stopColor="#050810" />
                </radialGradient>
                <filter id="glow-cyan">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-red">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <marker id="arrowRed" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" opacity="0.8" />
                </marker>
              </defs>

              {/* Background */}
              <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#bg-grad)" />

              {/* Grid lines (subtle) */}
              {Array.from({ length: 11 }, (_, i) => i * 100).map((v) => (
                <g key={v}>
                  <line x1={v} y1={0} x2={v} y2={MAP_H} stroke="#0d1520" strokeWidth={0.5} />
                  <line x1={0} y1={v * 0.62} x2={MAP_W} y2={v * 0.62} stroke="#0d1520" strokeWidth={0.5} />
                </g>
              ))}

              {/* Terrain blobs */}
              {territories.map((t) => (
                <ellipse
                  key={`tb-${t.id}`}
                  cx={tx(t.x)} cy={ty(t.y)}
                  rx={nodeRadius(t.population) + 36}
                  ry={nodeRadius(t.population) + 24}
                  fill={TERRAIN_FILL[t.terrain] ?? TERRAIN_FILL.plains}
                  opacity={0.55}
                />
              ))}

              {/* Adjacency edges */}
              {edges.map(([i, j]) => {
                const a = territories[i];
                const b = territories[j];
                return (
                  <line
                    key={`e-${i}-${j}`}
                    x1={tx(a.x)} y1={ty(a.y)}
                    x2={tx(b.x)} y2={ty(b.y)}
                    stroke="#1a2535" strokeWidth={1.2}
                  />
                );
              })}

              {/* War paths */}
              {warPaths.map(({ war, from, to }) => (
                <g key={`war-${war.id}`}>
                  <line
                    x1={tx(from.x)} y1={ty(from.y)}
                    x2={tx(to.x)} y2={ty(to.y)}
                    stroke="#ef4444" strokeWidth={2.5}
                    strokeDasharray="10,6"
                    opacity={0.75}
                    markerEnd="url(#arrowRed)"
                    style={{
                      animation: "warDash 1.5s linear infinite",
                    }}
                  />
                </g>
              ))}

              {/* Territory hexagons */}
              {territories.map((t) => {
                const cx = tx(t.x);
                const cy = ty(t.y);
                const r = nodeRadius(t.population);
                const isSelected = t.id === selectedId;
                const isMyLoc = t.id === myTerritoryId;
                const isWarZone = warPaths.some((p) => p.from?.id === t.id || p.to?.id === t.id);
                const playerCount = playersOnTerritory[t.id] ?? 0;

                return (
                  <g
                    key={t.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                    onMouseEnter={(e) => {
                      const rect = svgRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, t });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {/* War pulse ring */}
                    {isWarZone && (
                      <circle cx={cx} cy={cy} r={r + 12} fill="none"
                        stroke="#ef4444" strokeWidth={1.5} opacity={0.4}
                        style={{ animation: "pulse 1.2s ease-in-out infinite" }}
                      />
                    )}

                    {/* Terrain backing ellipse (slightly brighter for selected) */}
                    {isSelected && (
                      <ellipse cx={cx} cy={cy}
                        rx={r + 18} ry={r + 12}
                        fill={t.factionColor} opacity={0.12}
                      />
                    )}

                    {/* Hex fill */}
                    <polygon
                      points={hexPoints(cx, cy, r)}
                      fill={darken(t.factionColor)}
                      stroke={isSelected ? t.factionColor : (t.ownerFactionId ? t.factionColor + "99" : "#374151")}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      filter={isSelected ? "url(#glow-cyan)" : undefined}
                    />

                    {/* Prosperity color overlay (inner mini hex) */}
                    <polygon
                      points={hexPoints(cx, cy, r * 0.45)}
                      fill={t.factionColor}
                      opacity={0.2 + (t.prosperity / 250)}
                    />

                    {/* Type icon */}
                    <text x={cx} y={cy + 5} textAnchor="middle" fontSize={r * 0.6}
                      style={{ userSelect: "none", pointerEvents: "none" }}>
                      {TYPE_ICON[t.type] ?? "🗺"}
                    </text>

                    {/* Player count badge */}
                    {playerCount > 0 && (
                      <g>
                        <circle cx={cx + r - 6} cy={cy - r + 6} r={8} fill="#7c3aed" stroke="#4c1d95" strokeWidth={1} />
                        <text x={cx + r - 6} y={cy - r + 10} textAnchor="middle" fontSize={8}
                          fill="white" style={{ userSelect: "none", pointerEvents: "none" }}>
                          {playerCount}
                        </text>
                      </g>
                    )}

                    {/* War zone indicator */}
                    {isWarZone && (
                      <text x={cx + r - 8} y={cy + r - 4} fontSize={12}
                        style={{ userSelect: "none", pointerEvents: "none" }}>
                        ⚔️
                      </text>
                    )}

                    {/* Territory name */}
                    <text
                      x={cx} y={cy + r + 14}
                      textAnchor="middle" fontSize={9}
                      fill={isSelected ? t.factionColor : "#9ca3af"}
                      fontWeight={isSelected ? "bold" : "normal"}
                      style={{ userSelect: "none", pointerEvents: "none" }}
                    >
                      {t.name.length > 16 ? t.name.slice(0, 14) + "…" : t.name}
                    </text>

                    {/* Security & prosperity mini bars */}
                    {isSelected && (
                      <>
                        <rect x={cx - 20} y={cy + r + 18} width={40} height={3} rx={1.5} fill="#1f2937" />
                        <rect x={cx - 20} y={cy + r + 18} width={Math.round(40 * t.prosperity / 100)} height={3} rx={1.5} fill="#22d3ee" />
                        <rect x={cx - 20} y={cy + r + 23} width={40} height={3} rx={1.5} fill="#1f2937" />
                        <rect x={cx - 20} y={cy + r + 23} width={Math.round(40 * t.security / 100)} height={3} rx={1.5} fill="#22c55e" />
                      </>
                    )}

                    {/* Player marker */}
                    {isMyLoc && (
                      <g filter="url(#glow-cyan)">
                        <circle cx={cx} cy={cy - r - 12} r={7} fill="#22d3ee" stroke="white" strokeWidth={1.5} />
                        <text x={cx} y={cy - r - 8} textAnchor="middle" fontSize={9}
                          style={{ userSelect: "none", pointerEvents: "none" }}>
                          👤
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* SVG animation styles */}
              <style>{`
                @keyframes warDash {
                  to { stroke-dashoffset: -32; }
                }
                @keyframes pulse {
                  0%,100% { opacity: 0.2; r: ${0}; }
                  50% { opacity: 0.6; }
                }
              `}</style>
            </svg>
          )}

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-20 pointer-events-none bg-gray-900/95 border border-gray-700 rounded-lg p-3 shadow-2xl w-56"
              style={{
                left: Math.min(tooltip.x + 12, window.innerWidth - 250),
                top: Math.max(tooltip.y - 80, 8),
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <TerritoryIcon type={tooltip.t.type} size={16} />
                <span className="font-semibold text-sm text-gray-100">{tooltip.t.name}</span>
              </div>
              <div className="text-xs text-gray-400 mb-2">{TYPE_LABEL[tooltip.t.type] ?? tooltip.t.type} · {TERRAIN_LABEL[tooltip.t.terrain] ?? tooltip.t.terrain}</div>
              {tooltip.t.factionName && (
                <div className="flex items-center gap-1.5 text-xs mb-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: tooltip.t.factionColor }} />
                  <span style={{ color: tooltip.t.factionColor }}>{tooltip.t.factionName}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-1 text-xs">
                <div className="text-center">
                  <div className="text-blue-400 font-medium">{tooltip.t.population.toLocaleString()}</div>
                  <div className="text-gray-500">Dân số</div>
                </div>
                <div className="text-center">
                  <div className="text-cyan-400 font-medium">{tooltip.t.prosperity}</div>
                  <div className="text-gray-500">Thịnh vượng</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-medium">{tooltip.t.security}</div>
                  <div className="text-gray-500">An ninh</div>
                </div>
              </div>
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
            <button onClick={zoomIn}
              className="w-8 h-8 bg-gray-800/90 hover:bg-gray-700 border border-gray-700 rounded flex items-center justify-center transition-colors">
              <ZoomIn className="w-4 h-4 text-gray-300" />
            </button>
            <button onClick={zoomOut}
              className="w-8 h-8 bg-gray-800/90 hover:bg-gray-700 border border-gray-700 rounded flex items-center justify-center transition-colors">
              <ZoomOut className="w-4 h-4 text-gray-300" />
            </button>
            <button onClick={resetView}
              className="w-8 h-8 bg-gray-800/90 hover:bg-gray-700 border border-gray-700 rounded flex items-center justify-center transition-colors">
              <Maximize2 className="w-4 h-4 text-gray-300" />
            </button>
          </div>

          {/* Mini legend */}
          <div className="absolute bottom-4 right-4 bg-gray-900/90 border border-gray-800 rounded-lg p-2.5 text-xs space-y-1.5">
            <div className="text-gray-500 font-medium mb-1">Địa hình</div>
            {Object.entries(TERRAIN_LABEL).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: TERRAIN_FILL[key] ?? "#333", border: "1px solid #4b5563" }} />
                <span className="text-gray-400">{label}</span>
              </div>
            ))}
          </div>

          {/* War info bar */}
          {wars.length > 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-2">
              {wars.map((w) => (
                <div key={w.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-950/80 border border-red-800/60 rounded-lg text-xs text-red-300 backdrop-blur">
                  <Sword className="w-3 h-3" />
                  <span className="font-medium">{w.attackerWorldName}</span>
                  <span className="text-red-500">vs</span>
                  <span className="font-medium">{w.defenderWorldName}</span>
                  <span className="text-red-500 font-bold">{w.attackerScore} : {w.defenderScore}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Detail Panel ── */}
        <AnimatePresence>
          {selectedTerritory && (
            <motion.div
              key="detail"
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 200 }}
              className="w-80 border-l border-gray-800 bg-gray-900 overflow-y-auto flex-shrink-0"
            >
              <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <TerritoryIcon type={selectedTerritory.type} size={20} />
                      <h2 className="text-base font-bold text-gray-100">{selectedTerritory.name}</h2>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{TYPE_LABEL[selectedTerritory.type] ?? selectedTerritory.type}</span>
                      <span>·</span>
                      <span>{TERRAIN_LABEL[selectedTerritory.terrain] ?? selectedTerritory.terrain}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedId(null)}
                    className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Faction */}
                {selectedTerritory.factionName ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg border"
                    style={{ borderColor: selectedTerritory.factionColor + "40", background: darken(selectedTerritory.factionColor) }}>
                    <div className="w-3 h-3 rounded-full" style={{ background: selectedTerritory.factionColor }} />
                    <div>
                      <div className="text-xs font-medium" style={{ color: selectedTerritory.factionColor }}>
                        {selectedTerritory.factionName}
                      </div>
                      <div className="text-xs text-gray-500">Phe kiểm soát</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-800 bg-gray-800/30">
                    <div className="w-3 h-3 rounded-full bg-gray-600" />
                    <span className="text-xs text-gray-500">Không có phe kiểm soát</span>
                  </div>
                )}

                {/* Stats */}
                <div className="space-y-2.5">
                  <StatBar label="Dân Số" value={Math.min(100, selectedTerritory.population / 50)} color="#60a5fa" />
                  <StatBar label="Thịnh Vượng" value={selectedTerritory.prosperity} color="#22d3ee" />
                  <StatBar label="An Ninh" value={selectedTerritory.security} color="#22c55e" />
                </div>

                {/* Numbers */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                    <Users className="w-3.5 h-3.5 text-blue-400 mx-auto mb-1" />
                    <div className="text-sm font-bold text-blue-400">{selectedTerritory.population.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Dân số</div>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-1" />
                    <div className="text-sm font-bold text-cyan-400">{selectedTerritory.prosperity}</div>
                    <div className="text-xs text-gray-500">Thịnh vượng</div>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                    <Shield className="w-3.5 h-3.5 text-green-400 mx-auto mb-1" />
                    <div className="text-sm font-bold text-green-400">{selectedTerritory.security}</div>
                    <div className="text-xs text-gray-500">An ninh</div>
                  </div>
                </div>

                {/* Government detail */}
                {detailData?.govType && (
                  <div className="bg-gray-800/40 rounded-lg p-3 space-y-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Chính Phủ</div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Loại chính thể</span>
                      <span className="text-gray-200 capitalize">{detailData.govType.replace(/_/g, " ")}</span>
                    </div>
                    {detailData.govApproval != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Tỷ lệ ủng hộ</span>
                        <span className={detailData.govApproval > 60 ? "text-green-400" : "text-red-400"}>
                          {detailData.govApproval.toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {detailData.govTreasury != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Ngân khố</span>
                        <span className="text-yellow-400">{detailData.govTreasury.toLocaleString()} vàng</span>
                      </div>
                    )}
                    {detailData.taxRate != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Thuế suất</span>
                        <span className="text-orange-400">{detailData.taxRate}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Coordinates */}
                <div className="bg-gray-800/30 rounded-lg p-2.5 flex justify-between text-xs">
                  <span className="text-gray-500">Tọa độ</span>
                  <span className="text-gray-300 font-mono">
                    X: {selectedTerritory.x} · Y: {selectedTerritory.y}
                  </span>
                </div>

                {/* Players here */}
                {(playersOnTerritory[selectedTerritory.id] ?? 0) > 0 && (
                  <div className="flex items-center gap-2 text-xs text-purple-400 bg-purple-900/20 border border-purple-800/40 rounded-lg px-3 py-2">
                    <Users className="w-3.5 h-3.5" />
                    <span>{playersOnTerritory[selectedTerritory.id]} người chơi đang ở đây</span>
                  </div>
                )}

                {/* My location badge */}
                {selectedTerritory.id === myTerritoryId && (
                  <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-900/20 border border-cyan-800/40 rounded-lg px-3 py-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Bạn đang ở đây</span>
                  </div>
                )}

                {/* Move button */}
                {isMyWorld && myCharacterId && selectedTerritory.id !== myTerritoryId && (
                  <button
                    onClick={() => moveMut.mutate(selectedTerritory.id)}
                    disabled={moveMut.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-700/50 hover:bg-cyan-600/60 border border-cyan-600/50 rounded-lg text-sm font-semibold text-cyan-300 transition-colors disabled:opacity-50"
                  >
                    {moveMut.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Đang di chuyển...</>
                    ) : (
                      <><ChevronRight className="w-4 h-4" /> Di Chuyển Đến Đây</>
                    )}
                  </button>
                )}

                {!isMyWorld && myCharacterId && (
                  <div className="text-center text-xs text-gray-600 py-2">
                    Nhân vật của bạn thuộc thế giới khác
                  </div>
                )}

                {/* War zone warning */}
                {warPaths.some((p) => p.from?.id === selectedTerritory.id || p.to?.id === selectedTerritory.id) && (
                  <div className="flex items-start gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>Khu vực chiến tranh — Nguy hiểm cao</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
