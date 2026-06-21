/**
 * Phase 66 — Event Feed Panel
 * 66A: Filter Engine (category + entity)
 * 66B: Payload Inspector (click → JSON viewer)
 * 66C: Event Statistics toolbar (realtime counts)
 * 66D: Timeline Jump (click tick → snapshot)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Radio, Copy, Check, X, ChevronRight,
  Swords, Users, Sprout, Skull, Castle, Coins, Globe, Cpu, Search,
  Trash2, RefreshCw, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventRow {
  id: string;
  worldSlug: string;
  tick: number;
  event: string;
  payload: Record<string, unknown>;
  ts: number;
  createdAt: string;
}

interface EventStats {
  total: number;
  byEvent: Record<string, number>;
  byCat: Record<string, number>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORLDS = [
  { slug: "cultivation", name: "Tu Tiên Giới",   color: "#22d3ee" },
  { slug: "cyberpunk",   name: "Cyberpunk City",  color: "#a855f7" },
  { slug: "wasteland",   name: "Vùng Hoang Phế",  color: "#f97316" },
];

const CATEGORIES = [
  { id: "all",            label: "All",            icon: Globe,  color: "#94a3b8" },
  { id: "war",            label: "War",            icon: Swords, color: "#ef4444" },
  { id: "migration",      label: "Migration",      icon: Users,  color: "#60a5fa" },
  { id: "npc",            label: "NPC",            icon: Cpu,    color: "#a78bfa" },
  { id: "faction",        label: "Faction",        icon: Castle, color: "#fb923c" },
  { id: "economy",        label: "Economy",        icon: Coins,  color: "#34d399" },
  { id: "collapse",       label: "Collapse",       icon: Skull,  color: "#dc2626" },
  { id: "recolonization", label: "Recolon.",       icon: Sprout, color: "#4ade80" },
] as const;

const CAT_STAT_MAP: Record<string, string> = {
  war: "war", migration: "migration", npc: "npc",
  faction: "faction", economy: "economy",
  collapse: "collapse", recolonization: "recolonization",
};

const EVENT_ICONS: Record<string, string> = {
  territory_capture:    "⚔",
  territory_collapse:   "💀",
  territory_recolonized:"🌱",
  npc_migrate:          "👥",
  migration_wave:       "👥",
  faction_created:      "🏰",
  faction_leader_changed:"🏰",
  election_result:      "🗳",
  diplomacy_action:     "🤝",
  army_move:            "⚔",
  army_arrived:         "⚔",
  army_siege_started:   "⚔",
  army_siege_ended:     "⚔",
  world_war_start:      "⚔",
  world_war_end:        "☮",
  battle_result:        "⚔",
  npc_birth:            "👶",
  npc_death:            "💀",
  npc_goal_changed:     "🧠",
  economic_boom:        "📈",
  economic_recession:   "📉",
  trade_boom:           "💰",
  harvest_festival:     "🌾",
  political_crisis:     "🔥",
  rebellion:            "⚔",
  natural_wonder:       "✨",
  ancient_discovery:    "🏺",
  mysterious_arrival:   "👁",
  hero_born:            "⭐",
  villain_rises:        "☠",
  peace_treaty:         "☮",
  plague:               "☠",
  world_tick:           "⏱",
};

function catColor(event: string): string {
  for (const cat of CATEGORIES) {
    if (cat.id === "all") continue;
    const catDef = CATEGORIES.find(c => c.id === cat.id);
    if (!catDef) continue;
  }
  if (["territory_capture","army_move","army_arrived","army_siege_started","army_siege_ended","world_war_start","world_war_end","battle_result","rebellion"].includes(event)) return "#ef4444";
  if (["npc_migrate","migration_wave"].includes(event)) return "#60a5fa";
  if (["npc_goal_changed","npc_birth","npc_death"].includes(event)) return "#a78bfa";
  if (["faction_created","faction_leader_changed","election_result","diplomacy_action","political_crisis"].includes(event)) return "#fb923c";
  if (["economic_boom","economic_recession","trade_boom","harvest_festival"].includes(event)) return "#34d399";
  if (["territory_collapse"].includes(event)) return "#dc2626";
  if (["territory_recolonized","natural_wonder","ancient_discovery","mysterious_arrival","hero_born","villain_rises","peace_treaty","plague"].includes(event)) return "#4ade80";
  return "#94a3b8";
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s trước`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m trước`;
  return `${Math.floor(diff / 3_600_000)}h trước`;
}

// ─── 66B: Payload Inspector ───────────────────────────────────────────────────

function PayloadInspector({ event, onClose }: { event: EventRow; onClose: () => void }) {
  const [tab, setTab] = useState<"pretty" | "raw">("pretty");
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify({ event: event.event, tick: event.tick, payload: event.payload }, null, 2);

  function copy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0a0f1a] border-l border-border/60 z-50 flex flex-col shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="text-xl">{EVENT_ICONS[event.event] ?? "📋"}</span>
          <div>
            <div className="font-orbitron text-xs font-bold" style={{ color: catColor(event.event) }}>
              {event.event}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              Tick #{event.tick} · {event.worldSlug}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-1 px-4 pt-3">
        {(["pretty", "raw"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-xs font-mono rounded ${tab === t ? "bg-cyan-500/20 text-cyan-400" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "pretty" ? "Pretty" : "Raw"}
          </button>
        ))}
        <button
          onClick={copy}
          className="ml-auto flex items-center gap-1 px-3 py-1 text-xs font-mono rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy JSON"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "pretty" ? (
          <div className="space-y-3">
            <div className="border border-border/40 p-3 bg-card/30">
              <div className="text-xs font-mono text-muted-foreground mb-2">METADATA</div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div><span className="text-muted-foreground">event</span><br /><span className="text-cyan-400">{event.event}</span></div>
                <div><span className="text-muted-foreground">tick</span><br /><span className="text-purple-400">#{event.tick}</span></div>
                <div><span className="text-muted-foreground">world</span><br /><span className="text-yellow-400">{event.worldSlug}</span></div>
                <div><span className="text-muted-foreground">ts</span><br /><span className="text-muted-foreground">{new Date(event.ts).toLocaleTimeString()}</span></div>
              </div>
            </div>

            <div className="border border-border/40 p-3 bg-card/30">
              <div className="text-xs font-mono text-muted-foreground mb-2">PAYLOAD</div>
              <div className="space-y-1.5">
                {Object.entries(event.payload).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2 text-xs font-mono">
                    <span className="text-purple-400 flex-shrink-0">{k}:</span>
                    <span className="text-green-400 break-all">
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </span>
                  </div>
                ))}
                {Object.keys(event.payload).length === 0 && (
                  <span className="text-muted-foreground italic">empty payload</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <pre className="text-xs font-mono text-green-400/90 whitespace-pre-wrap break-all leading-relaxed">
            {json}
          </pre>
        )}
      </div>
    </motion.div>
  );
}

// ─── 66D: Timeline Jump Panel ─────────────────────────────────────────────────

function TimelineJumpPanel({ worldSlug, tick, onClose }: { worldSlug: string; tick: number; onClose: () => void }) {
  const { data: snapshot, isLoading, error } = useQuery<any>({
    queryKey: ["/api/simulation/snapshot", worldSlug, tick],
    queryFn: () =>
      fetch(`/api/simulation/snapshot/${worldSlug}/${tick}`)
        .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0a0f1a] border border-cyan-500/30 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-orbitron text-sm font-bold text-cyan-400">TIMELINE JUMP</div>
            <div className="font-mono text-xs text-muted-foreground">{worldSlug} · Tick #{tick}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-24 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span className="font-mono text-sm">Đang tải snapshot...</span>
          </div>
        )}
        {error && (
          <div className="text-center p-6">
            <div className="text-red-400 font-mono text-sm mb-1">Không tìm thấy snapshot</div>
            <div className="text-muted-foreground text-xs">Snapshot được tạo mỗi 50 ticks — tick #{tick} chưa có lưu.</div>
          </div>
        )}
        {snapshot && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-green-400 mb-3">
              <Check className="w-4 h-4" />
              Snapshot gần nhất tại tick #{snapshot.tick ?? tick}
            </div>

            {snapshot.state && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Dân số", val: snapshot.state.population?.toLocaleString() ?? "—", color: "#22d3ee" },
                  { label: "Kinh tế", val: snapshot.state.economyScore?.toFixed(1) ?? "—", color: "#fbbf24" },
                  { label: "Tâm trạng", val: snapshot.state.avgMood?.toFixed(1) ?? "—", color: "#34d399" },
                  { label: "Ổn định", val: snapshot.state.stability?.toFixed(1) ?? "—", color: "#60a5fa" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="border border-border/40 p-2.5 bg-card/30">
                    <div className="font-orbitron text-lg font-black" style={{ color }}>{val}</div>
                    <div className="font-mono text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            )}

            {snapshot.territories && (
              <div className="border border-border/40 p-3 bg-card/20">
                <div className="font-mono text-xs text-muted-foreground mb-2">TERRITORIES ({snapshot.territories.length})</div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {snapshot.territories.slice(0, 20).map((t: any) => (
                    <div key={t.id} className="flex justify-between text-xs font-mono">
                      <span className="text-foreground/80">{t.name}</span>
                      <span className="text-muted-foreground">{t.status} · {t.factionId?.slice(0, 8) ?? "none"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── 66C: Stats Toolbar ───────────────────────────────────────────────────────

function StatsToolbar({ stats }: { stats: EventStats | undefined }) {
  if (!stats) return null;
  const items = [
    { icon: "⚔", label: "War",   count: stats.byCat.war ?? 0,            color: "#ef4444" },
    { icon: "👥", label: "Migr",  count: stats.byCat.migration ?? 0,      color: "#60a5fa" },
    { icon: "🌱", label: "Recol", count: stats.byCat.recolonization ?? 0, color: "#4ade80" },
    { icon: "💀", label: "Coll",  count: stats.byCat.collapse ?? 0,       color: "#dc2626" },
    { icon: "🏰", label: "Fact",  count: stats.byCat.faction ?? 0,        color: "#fb923c" },
    { icon: "💰", label: "Econ",  count: stats.byCat.economy ?? 0,        color: "#34d399" },
  ];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map(({ icon, label, count, color }) => (
        <div
          key={label}
          className="flex items-center gap-1 px-2 py-1 border border-border/40 bg-card/30 text-xs font-mono"
          title={label}
        >
          <span>{icon}</span>
          <span style={{ color }} className="font-bold">{count.toLocaleString()}</span>
        </div>
      ))}
      <div className="flex items-center gap-1 px-2 py-1 border border-border/40 bg-card/30 text-xs font-mono text-muted-foreground ml-1">
        <Layers className="w-3 h-3" />
        <span>{stats.total.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EventFeedPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // 66A filters
  const [worldSlug, setWorldSlug]     = useState("cultivation");
  const [category, setCategory]       = useState("all");
  const [factionFilter, setFactionFilter]   = useState("");
  const [territoryFilter, setTerritoryFilter] = useState("");
  const [searchFaction, setSearchFaction]     = useState("");
  const [searchTerritory, setSearchTerritory] = useState("");

  // 66B payload inspector
  const [inspectedEvent, setInspectedEvent] = useState<EventRow | null>(null);

  // 66D timeline jump
  const [jumpTarget, setJumpTarget] = useState<{ worldSlug: string; tick: number } | null>(null);

  // WS realtime
  const wsRef = useRef<WebSocket | null>(null);
  const [wsEvents, setWsEvents] = useState<EventRow[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  const selectedWorld = WORLDS.find(w => w.slug === worldSlug)!;

  // ─── Fetch filtered events ────────────────────────────────────────────────

  const params = new URLSearchParams({ limit: "300" });
  if (category !== "all") params.set("category", category);
  if (searchFaction) params.set("faction", searchFaction);
  if (searchTerritory) params.set("territory", searchTerritory);

  const { data: events = [], isLoading, refetch } = useQuery<EventRow[]>({
    queryKey: ["/api/simulation/events", worldSlug, category, searchFaction, searchTerritory],
    queryFn: () =>
      fetch(`/api/simulation/events/${worldSlug}?${params}`)
        .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery<EventStats>({
    queryKey: ["/api/simulation/events/stats", worldSlug],
    queryFn: () =>
      fetch(`/api/simulation/events/${worldSlug}/stats`)
        .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    refetchInterval: 30_000,
  });

  // ─── WebSocket (66 realtime stream) ──────────────────────────────────────

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/api/ws/unity`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({ type: "subscribe", worlds: [worldSlug] }));
    };
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.worldSlug === worldSlug) {
          const row: EventRow = {
            id:        crypto.randomUUID(),
            worldSlug: data.worldSlug,
            tick:      data.tick,
            event:     data.event,
            payload:   data.payload ?? {},
            ts:        data.ts,
            createdAt: new Date(data.ts).toISOString(),
          };
          setWsEvents(prev => [row, ...prev].slice(0, 500));
        }
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setWsConnected(false);
    };
  }, [worldSlug]);

  // Resubscribe when world changes
  useEffect(() => {
    setWsEvents([]);
  }, [worldSlug]);

  const applyFilters = useCallback(() => {
    setSearchFaction(factionFilter);
    setSearchTerritory(territoryFilter);
  }, [factionFilter, territoryFilter]);

  function clearFilters() {
    setCategory("all");
    setFactionFilter("");
    setTerritoryFilter("");
    setSearchFaction("");
    setSearchTerritory("");
  }

  // Merge WS events with fetched events, deduplicate by id
  const allEvents = [...wsEvents, ...events].filter(
    (e, i, arr) => arr.findIndex(x => x.id === e.id && x.ts === e.ts) === i,
  );

  // Apply category filter to WS events too
  const filteredEvents = allEvents.filter(e => {
    if (category === "all") return true;
    const catMap: Record<string, string[]> = {
      war:            ["territory_capture","army_move","army_arrived","army_siege_started","army_siege_ended","world_war_start","world_war_end","battle_result","inter_world_war","rebellion"],
      migration:      ["npc_migrate","migration_wave"],
      npc:            ["npc_goal_changed","npc_birth","npc_death"],
      faction:        ["faction_created","faction_leader_changed","election_result","diplomacy_action","political_crisis"],
      economy:        ["economic_boom","economic_recession","trade_boom","harvest_festival"],
      collapse:       ["territory_collapse"],
      recolonization: ["territory_recolonized","natural_wonder","ancient_discovery","mysterious_arrival","hero_born","villain_rises","peace_treaty","plague"],
    };
    return catMap[category]?.includes(e.event) ?? false;
  });

  const worldColor = selectedWorld?.color ?? "#94a3b8";

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <div className="max-w-6xl mx-auto p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/simulation")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Simulation
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${wsConnected ? "text-green-400 animate-pulse" : "text-muted-foreground"}`} />
            <span className="font-orbitron text-sm font-bold" style={{ color: worldColor }}>
              LIVE EVENTS
            </span>
            {wsConnected && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">LIVE</Badge>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              className="text-xs h-7"
              onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["/api/simulation/events/stats", worldSlug] }); }}
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* 66C: Stats Toolbar */}
        <div className="mb-4">
          <StatsToolbar stats={stats} />
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">

          {/* ─── 66A: Filter Panel ──────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* World selector */}
            <div className="border border-border/50 bg-card/30 p-4">
              <div className="text-xs text-muted-foreground mb-2">WORLD</div>
              <div className="space-y-1.5">
                {WORLDS.map(w => (
                  <button
                    key={w.slug}
                    onClick={() => { setWorldSlug(w.slug); setWsEvents([]); }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono flex items-center gap-2 transition-colors ${
                      worldSlug === w.slug
                        ? "bg-card/60 border border-border"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <Globe className="w-3 h-3" style={{ color: w.color }} />
                    <span style={{ color: worldSlug === w.slug ? w.color : undefined }}>{w.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter */}
            <div className="border border-border/50 bg-card/30 p-4">
              <div className="text-xs text-muted-foreground mb-2">EVENT TYPE</div>
              <div className="space-y-1">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const catCount = cat.id === "all" ? (stats?.total ?? 0) : (stats?.byCat[cat.id] ?? 0);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`w-full text-left px-2.5 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors ${
                        category === cat.id
                          ? "bg-card border border-border"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-3 h-3" style={{ color: cat.color }} />
                      <span style={{ color: category === cat.id ? cat.color : undefined }}>{cat.label}</span>
                      {catCount > 0 && (
                        <span className="ml-auto text-muted-foreground">{catCount.toLocaleString()}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Entity filter */}
            <div className="border border-border/50 bg-card/30 p-4">
              <div className="text-xs text-muted-foreground mb-3">ENTITY FILTER</div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Faction</div>
                  <input
                    value={factionFilter}
                    onChange={e => setFactionFilter(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && applyFilters()}
                    placeholder="Golden Alliance..."
                    className="w-full bg-background/60 border border-border/40 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cyan-500/50 placeholder:text-muted-foreground/40"
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Territory</div>
                  <input
                    value={territoryFilter}
                    onChange={e => setTerritoryFilter(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && applyFilters()}
                    placeholder="Eastern Valley..."
                    className="w-full bg-background/60 border border-border/40 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cyan-500/50 placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 h-7 text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30" onClick={applyFilters}>
                    <Search className="w-3 h-3 mr-1" /> Filter
                  </Button>
                  {(searchFaction || searchTerritory || category !== "all") && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearFilters}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Event Feed ─────────────────────────────────────────────────── */}
          <div className="border border-border/50 bg-card/20 flex flex-col">
            {/* Feed header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40">
              <span className="font-orbitron text-xs font-bold text-muted-foreground">EVENTS</span>
              <span className="text-xs text-muted-foreground">
                {filteredEvents.length > 0 && `${filteredEvents.length} hiện`}
              </span>
              {wsEvents.length > 0 && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs ml-1">
                  +{wsEvents.length} live
                </Badge>
              )}
              {(searchFaction || searchTerritory) && (
                <div className="ml-auto flex gap-1">
                  {searchFaction && <Badge variant="outline" className="text-xs">{searchFaction}</Badge>}
                  {searchTerritory && <Badge variant="outline" className="text-xs">{searchTerritory}</Badge>}
                </div>
              )}
            </div>

            {/* Feed list */}
            <div className="flex-1 overflow-y-auto max-h-[72vh]">
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Đang tải events...</span>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
                  <Radio className="w-6 h-6" />
                  <span>Chưa có event — chạy tick để bắt đầu.</span>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {filteredEvents.map((evt, i) => (
                    <motion.div
                      key={`${evt.id}-${evt.ts}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18, delay: i < 20 ? i * 0.01 : 0 }}
                      className="flex items-start gap-3 px-4 py-2.5 border-b border-border/20 hover:bg-white/[0.03] cursor-pointer group transition-colors"
                      onClick={() => setInspectedEvent(evt)}
                    >
                      {/* Event icon */}
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-sm mt-0.5">
                        {EVENT_ICONS[evt.event] ?? "📋"}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-orbitron text-xs font-bold"
                            style={{ color: catColor(evt.event) }}
                          >
                            {evt.event.replace(/_/g, " ")}
                          </span>
                          {/* 66D: Tick click → Timeline Jump */}
                          <button
                            className="font-mono text-xs text-muted-foreground hover:text-cyan-400 transition-colors"
                            onClick={e => { e.stopPropagation(); setJumpTarget({ worldSlug: evt.worldSlug, tick: evt.tick }); }}
                            title="Timeline Jump → xem snapshot tại tick này"
                          >
                            Tick #{evt.tick}
                          </button>
                          <span className="font-mono text-xs text-muted-foreground ml-auto">
                            {relativeTime(evt.ts)}
                          </span>
                        </div>

                        {/* Key payload fields */}
                        {Object.keys(evt.payload).length > 0 && (
                          <div className="flex items-center gap-2 mt-0.5 text-xs font-mono text-muted-foreground/70 flex-wrap">
                            {Object.entries(evt.payload).slice(0, 4).map(([k, v]) => (
                              <span key={k}>
                                <span className="text-purple-400/60">{k}:</span>{" "}
                                <span className="text-muted-foreground/80">
                                  {typeof v === "object" ? JSON.stringify(v).slice(0, 30) : String(v).slice(0, 30)}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Inspector caret */}
                      <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground flex-shrink-0 mt-1 transition-colors" />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 66B: Payload Inspector Drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {inspectedEvent && (
          <PayloadInspector event={inspectedEvent} onClose={() => setInspectedEvent(null)} />
        )}
      </AnimatePresence>

      {/* ─── 66D: Timeline Jump Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {jumpTarget && (
          <TimelineJumpPanel
            worldSlug={jumpTarget.worldSlug}
            tick={jumpTarget.tick}
            onClose={() => setJumpTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
