import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Users, Crown, Coins, Shield, RefreshCw, Loader2, Star, ChevronDown, ChevronUp, Scroll } from "lucide-react";

const WORLDS = [
  { slug: "cultivation", label: "TU TIÊN",  color: "#06b6d4" },
  { slug: "cyberpunk",   label: "CYBERPUNK", color: "#a855f7" },
  { slug: "wasteland",   label: "HOANG PHẾ", color: "#ef4444" },
] as const;
type WorldSlug = "cultivation" | "cyberpunk" | "wasteland";

interface FactionMember {
  id: string; npcId: string; role: string;
  name: string; occupation: string; money: number; happiness: number;
}

interface FactionMemory {
  id: string; npcId: string; factionId: string | null;
  content: string; createdAt: string;
}

interface Leader {
  id: string; name: string; occupation: string; money: number;
}

interface Faction {
  id: string; worldSlug: string; name: string; type: string;
  leaderNpcId: string | null; treasury: number; reputation: number;
  createdAt: string; updatedAt: string;
  typeLabel: string; typeIcon: string;
  members: FactionMember[]; leader: Leader | null;
  memories: FactionMemory[];
}

interface FactionResponse { factions: Faction[] }

const TYPE_COLOR: Record<string, string> = {
  merchant_guild: "#f59e0b",
  farming_clan:   "#22c55e",
  military_order: "#ef4444",
  criminal_group: "#8b5cf6",
  noble_house:    "#06b6d4",
};

export default function NPCFactionPage() {
  const [, setLocation] = useLocation();
  const [activeWorld, setActiveWorld] = useState<WorldSlug>("cultivation");
  const [data, setData] = useState<FactionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [tributeLoading, setTributeLoading] = useState(false);
  const [formMsg, setFormMsg] = useState<{ formed: number; message: string } | null>(null);
  const [tributeMsg, setTributeMsg] = useState<{ collected: number; message: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const worldColor = WORLDS.find(w => w.slug === activeWorld)?.color ?? "#06b6d4";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/npc-factions/${activeWorld}`, { credentials: "include" });
      if (r.ok) setData(await r.json());
    } finally { setLoading(false); }
  }, [activeWorld]);

  useEffect(() => { load(); }, [load]);

  async function autoForm() {
    setFormLoading(true); setFormMsg(null);
    try {
      const r = await fetch(`/api/npc-factions/auto-form/${activeWorld}`, { method: "POST", credentials: "include" });
      if (r.ok) { const d = await r.json(); setFormMsg(d); await load(); }
    } finally { setFormLoading(false); }
  }

  async function collectTribute() {
    setTributeLoading(true); setTributeMsg(null);
    try {
      const r = await fetch(`/api/npc-factions/collect-tribute/${activeWorld}`, { method: "POST", credentials: "include" });
      if (r.ok) { const d = await r.json(); setTributeMsg(d); await load(); }
    } finally { setTributeLoading(false); }
  }

  const factions = data?.factions ?? [];
  const totalTreasury = factions.reduce((s, f) => s + f.treasury, 0);
  const totalMembers  = factions.reduce((s, f) => s + f.members.length, 0);

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/dashboard")} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${worldColor}22`, border: `1px solid ${worldColor}40` }}>
          <Shield size={14} style={{ color: worldColor }} />
        </div>
        <div>
          <div className="text-sm font-bold tracking-widest" style={{ color: worldColor }}>HỘI NHÓM NPC</div>
          <div className="text-xs text-gray-600">Thành lập · thủ lĩnh · quỹ hội</div>
        </div>
        <button onClick={load} disabled={loading} className="ml-auto p-1.5 rounded-lg border border-gray-800 text-gray-500 hover:text-white transition-colors">
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
              <motion.div layoutId="wt-faction" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: w.color }} />
            )}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Hội Nhóm",    value: factions.length,  icon: <Shield size={16} />,  color: worldColor },
            { label: "Thành Viên",  value: totalMembers,     icon: <Users size={16} />,   color: "#22c55e" },
            { label: "Tổng Quỹ",    value: totalTreasury,    icon: <Coins size={16} />,   color: "#f59e0b" },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-gray-800 bg-gray-900/40 p-3 text-center">
              <div className="flex items-center justify-center mb-1" style={{ color: card.color }}>{card.icon}</div>
              <div className="text-xl font-bold" style={{ color: card.color }}>{card.value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={autoForm} disabled={formLoading}
            className="py-2.5 rounded-xl text-xs font-bold tracking-widest flex items-center justify-center gap-2 transition-all"
            style={{ background: `${worldColor}22`, border: `1px solid ${worldColor}60`, color: worldColor }}>
            {formLoading ? <><Loader2 size={14} className="animate-spin" />Đang xử lý...</> : <><Users size={14} />Tự Động Thành Lập</>}
          </button>
          <button onClick={collectTribute} disabled={tributeLoading}
            className="py-2.5 rounded-xl text-xs font-bold tracking-widest flex items-center justify-center gap-2 transition-all"
            style={{ background: "#f59e0b22", border: "1px solid #f59e0b60", color: "#f59e0b" }}>
            {tributeLoading ? <><Loader2 size={14} className="animate-spin" />Đang thu...</> : <><Coins size={14} />Thu Phí Thành Viên</>}
          </button>
        </div>

        {/* Action results */}
        <AnimatePresence>
          {formMsg && (
            <motion.div key="form-msg" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-xs space-y-1">
              <div className="font-bold" style={{ color: formMsg.formed > 0 ? worldColor : "#6b7280" }}>
                {formMsg.formed > 0 ? `✓ Thành lập ${formMsg.formed} hội nhóm mới!` : "ℹ " + formMsg.message}
              </div>
              {formMsg.formed > 0 && <div className="text-gray-500">{formMsg.message}</div>}
            </motion.div>
          )}
          {tributeMsg && (
            <motion.div key="tribute-msg" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 text-xs">
              <div className="font-bold" style={{ color: tributeMsg.collected > 0 ? "#f59e0b" : "#6b7280" }}>
                {tributeMsg.collected > 0 ? `✓ Thu ${tributeMsg.collected} vàng tổng cộng` : "ℹ " + tributeMsg.message}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Faction list */}
        {factions.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield size={14} style={{ color: worldColor }} />
              <span className="text-xs font-bold tracking-widest" style={{ color: worldColor }}>DANH SÁCH HỘI NHÓM</span>
            </div>

            {factions.map(faction => {
              const typeColor = TYPE_COLOR[faction.type] ?? worldColor;
              const isExpanded = expandedId === faction.id;
              return (
                <motion.div key={faction.id} layout
                  className="rounded-xl border border-gray-800 bg-gray-900/20 overflow-hidden">

                  {/* Faction header — clickable to expand */}
                  <button className="w-full p-4 text-left" onClick={() => setExpandedId(isExpanded ? null : faction.id)}>
                    <div className="flex items-start gap-3">
                      <div className="text-2xl mt-0.5">{faction.typeIcon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{faction.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ color: typeColor, background: `${typeColor}18`, border: `1px solid ${typeColor}40` }}>
                            {faction.typeLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Users size={11} />{faction.members.length} thành viên</span>
                          <span className="flex items-center gap-1"><Coins size={11} style={{ color: "#f59e0b" }} /><span style={{ color: "#f59e0b" }}>{faction.treasury}</span> vàng</span>
                          <span className="flex items-center gap-1"><Star size={11} style={{ color: "#a855f7" }} /><span style={{ color: "#a855f7" }}>Uy tín {faction.reputation}</span></span>
                        </div>
                      </div>
                      <div className="text-gray-600 mt-1">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div key="detail"
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                        className="overflow-hidden border-t border-gray-800/60">
                        <div className="p-4 space-y-4">

                          {/* Leader */}
                          {faction.leader && (
                            <div>
                              <div className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
                                <Crown size={11} style={{ color: "#f59e0b" }} />
                                <span style={{ color: "#f59e0b" }} className="font-bold tracking-widest">THỦ LĨNH</span>
                              </div>
                              <div className="flex items-center gap-3 bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-2.5">
                                <div className="w-8 h-8 rounded-full bg-yellow-400/15 flex items-center justify-center shrink-0">
                                  <Crown size={14} className="text-yellow-400" />
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-white">{faction.leader.name}</div>
                                  <div className="text-xs text-gray-500">{faction.leader.occupation} · {faction.leader.money} vàng</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Members */}
                          {faction.members.length > 0 && (
                            <div>
                              <div className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
                                <Users size={11} style={{ color: typeColor }} />
                                <span style={{ color: typeColor }} className="font-bold tracking-widest">THÀNH VIÊN ({faction.members.length})</span>
                              </div>
                              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {faction.members.map(m => (
                                  <div key={m.id} className="flex items-center gap-2 py-1 border-b border-gray-800/40 last:border-0">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                      style={{ background: `${typeColor}18` }}>
                                      {m.role === "leader" ? <Crown size={10} style={{ color: "#f59e0b" }} /> : <Users size={10} style={{ color: typeColor }} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-xs font-bold text-white">{m.name}</span>
                                      <span className="text-xs text-gray-600 ml-1.5">{m.occupation}</span>
                                    </div>
                                    <div className="text-xs text-gray-600">{m.money}💰</div>
                                    <div className="text-xs font-bold px-1.5 py-0.5 rounded"
                                      style={{ color: m.happiness > 60 ? "#22c55e" : m.happiness > 30 ? "#eab308" : "#ef4444",
                                               background: `${m.happiness > 60 ? "#22c55e" : m.happiness > 30 ? "#eab308" : "#ef4444"}15` }}>
                                      ♥{m.happiness}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Memories */}
                          {faction.memories.length > 0 && (
                            <div>
                              <div className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
                                <Scroll size={11} style={{ color: "#8b5cf6" }} />
                                <span style={{ color: "#8b5cf6" }} className="font-bold tracking-widest">KÝ ỨC HỘI NHÓM</span>
                              </div>
                              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                {faction.memories.map(mem => (
                                  <div key={mem.id} className="flex items-start gap-2 py-1 border-b border-gray-800/30 last:border-0">
                                    <div className="w-1 h-1 rounded-full bg-purple-500 mt-2 shrink-0" />
                                    <div className="flex-1">
                                      <div className="text-xs text-gray-400">{mem.content}</div>
                                      <div className="text-xs text-gray-700 mt-0.5">
                                        {new Date(mem.createdAt).toLocaleDateString("vi-VN")}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
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
        ) : !loading && (
          <div className="text-center py-16 text-gray-700">
            <Shield size={32} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm">Chưa có hội nhóm nào</div>
            <div className="text-xs mt-1 text-gray-600">
              Nhấn <span style={{ color: worldColor }}>"Tự Động Thành Lập"</span> để tạo hội nhóm từ NPC có quan hệ tốt
            </div>
            <div className="text-xs mt-1 text-gray-700">
              (Cần 3+ NPC cùng nghề với quan hệ &gt; 70)
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-600">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs">Đang tải...</span>
          </div>
        )}
      </div>
    </div>
  );
}
