import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Coins, Star, Shield, Swords, Building2, Users, Heart,
  TrendingUp, MessageCircle, Vote, Zap, ChevronRight, Plus,
  Activity, Globe, Award, BarChart3, RefreshCw, Lock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/* ─── API helpers ─── */
const api = (url: string, opts?: RequestInit) =>
  fetch(url, { credentials: "include", ...opts }).then(r => r.json());

const postApi = (url: string, body: object) =>
  fetch(url, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(r => r.json());

/* ─── Types ─── */
interface PlayerAgent {
  id: string; characterId: string; worldSlug: string;
  gold: number; totalAssets: number; reputation: number;
  reputationTitle: string; occupation: string;
  politicalRank?: string; militaryRank?: string; isActive: boolean;
}
interface Character {
  id: string; name: string; level: number; stats: any;
}
interface AgentProfile {
  character: Character; agent: PlayerAgent;
  bank: { balance: number } | null; passiveIncome: number;
  relationships: any[]; family: any[]; factions: any[];
  businesses: any[]; elections: any[]; wars: any;
  recentTrades: any[]; activityLog: any[]; summary: any;
}

/* ─── Tabs ─── */
const TABS = [
  { id: "overview",  label: "Tổng Quan",    icon: User },
  { id: "world",     label: "Thế Giới",     icon: Globe },
  { id: "relations", label: "Quan Hệ",      icon: Heart },
  { id: "factions",  label: "Phe Phái",     icon: Shield },
  { id: "economy",   label: "Kinh Tế",      icon: Coins },
  { id: "politics",  label: "Chính Trị",    icon: Vote },
  { id: "war",       label: "Chiến Tranh",  icon: Swords },
  { id: "history",   label: "Lịch Sử",      icon: Activity },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ─── Reusable components ─── */
function StatCard({ label, value, sub, icon: Icon, color = "cyan" }: {
  label: string; value: string | number; sub?: string; icon: any; color?: string;
}) {
  const colors: Record<string, string> = {
    cyan: "border-cyan-500/30 bg-cyan-500/5 text-cyan-400",
    purple: "border-purple-500/30 bg-purple-500/5 text-purple-400",
    yellow: "border-yellow-500/30 bg-yellow-500/5 text-yellow-400",
    green: "border-green-500/30 bg-green-500/5 text-green-400",
    red: "border-red-500/30 bg-red-500/5 text-red-400",
    blue: "border-blue-500/30 bg-blue-500/5 text-blue-400",
  };
  return (
    <div className={`border rounded-lg p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} />
        <span className="text-xs opacity-70 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-1">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-cyan-500/30" />
      <span className="text-xs font-mono uppercase tracking-widest text-cyan-500/70">{children}</span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-cyan-500/30" />
    </div>
  );
}

/* ─── Action Modal ─── */
function ActionModal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-[#0a0a14] border border-cyan-500/30 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl shadow-cyan-500/10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-mono text-cyan-400 uppercase tracking-widest text-sm">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">✕</button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════ */
export default function PlayerAgentPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  /* Fetch character list */
  const { data: characters = [] } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
    queryFn: () => api("/api/characters"),
    enabled: !!user,
  });

  /* Fetch agent profile */
  const { data: profile, isLoading: loadingProfile } = useQuery<AgentProfile>({
    queryKey: ["/api/player-agent", selectedChar],
    queryFn: () => api(`/api/player-agent/${selectedChar}`),
    enabled: !!selectedChar,
    refetchInterval: 30000,
  });

  /* Fetch world context */
  const { data: worldCtx } = useQuery({
    queryKey: ["/api/player-agent/world-context", selectedChar],
    queryFn: () => api(`/api/player-agent/${selectedChar}/world-context`),
    enabled: !!selectedChar,
  });

  /* Mutations */
  const initAgent = useMutation({
    mutationFn: (characterId: string) => postApi("/api/player-agent/init", { characterId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/player-agent", selectedChar] }),
  });

  const collectIncome = useMutation({
    mutationFn: (cid: string) => postApi(`/api/player-agent/${cid}/collect-income`, {}),
    onSuccess: (data) => {
      setMsg(`✅ Thu nhập: +${data.totalIncome} gold`);
      qc.invalidateQueries({ queryKey: ["/api/player-agent", selectedChar] });
      setTimeout(() => setMsg(""), 3000);
    },
  });

  const joinWar = useMutation({
    mutationFn: ({ cid, warId, side }: { cid: string; warId: string; side: string }) =>
      postApi(`/api/player-agent/${cid}/join-war/${warId}`, { side }),
    onSuccess: (data) => {
      setMsg(`⚔️ Tham chiến: ${data.result?.kills} kill, +${data.result?.goldEarned} gold`);
      qc.invalidateQueries({ queryKey: ["/api/player-agent", selectedChar] });
      setModal(null);
      setTimeout(() => setMsg(""), 4000);
    },
  });

  /* Character select screen */
  if (!selectedChar) {
    return (
      <div className="min-h-screen bg-[#050508] text-white p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 border border-cyan-500/30 rounded-full px-4 py-1 text-xs text-cyan-400 font-mono uppercase tracking-widest mb-4">
              <User size={12} /> Player Agent
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Chọn Nhân Vật</h1>
            <p className="text-gray-500 text-sm">Chọn nhân vật để kích hoạt hệ thống Player Agent</p>
          </div>

          {characters.length === 0 ? (
            <div className="border border-gray-800 rounded-xl p-8 text-center text-gray-500">
              <User size={40} className="mx-auto mb-3 opacity-30" />
              <p>Chưa có nhân vật nào. Hãy tạo nhân vật trước.</p>
              <a href="/world-creator" className="mt-4 inline-block text-cyan-400 hover:underline text-sm">→ Tạo thế giới</a>
            </div>
          ) : (
            <div className="grid gap-3">
              {characters.map(char => (
                <button key={char.id} onClick={() => { setSelectedChar(char.id); initAgent.mutate(char.id); }}
                  className="flex items-center gap-4 border border-gray-800 hover:border-cyan-500/50 rounded-xl p-4 text-left transition-all group bg-gray-900/30 hover:bg-cyan-500/5">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-xl border border-cyan-500/20">
                    {char.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{char.name}</div>
                    <div className="text-xs text-gray-500">Cấp {char.level} · {(char.stats as any)?.world_slug ?? "Không rõ thế giới"}</div>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-cyan-400 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const summary = profile?.summary;
  const agent = profile?.agent;
  const char = profile?.character;

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-black/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedChar(null)}
              className="text-gray-500 hover:text-white transition-colors text-sm">← Nhân vật</button>
            <div className="w-px h-4 bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-sm border border-cyan-500/20">
                {char?.name?.[0] ?? "?"}
              </div>
              <div>
                <div className="font-semibold text-sm">{char?.name}</div>
                <div className="text-xs text-gray-500">Lv.{char?.level} · {agent?.reputationTitle}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {msg && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="text-xs text-green-400 font-mono">{msg}</motion.div>}
            <div className="flex items-center gap-1 text-yellow-400 text-sm font-mono">
              <Coins size={14} /> {(agent?.gold ?? 0).toLocaleString()}g
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono uppercase tracking-wider whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-cyan-500 text-cyan-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}>
              <tab.icon size={12} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {loadingProfile && (
          <div className="flex items-center justify-center h-40 gap-3 text-cyan-500/50">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm font-mono">Đang tải dữ liệu agent...</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>

            {/* ── OVERVIEW ── */}
            {activeTab === "overview" && profile && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Gold" value={(summary?.gold ?? 0).toLocaleString()} icon={Coins} color="yellow"
                    sub={`Ngân hàng: ${(summary?.bankBalance ?? 0).toLocaleString()}g`} />
                  <StatCard label="Tổng Tài Sản" value={(summary?.totalAssets ?? 0).toLocaleString()} icon={TrendingUp} color="green"
                    sub={`+${profile.passiveIncome}/tick thụ động`} />
                  <StatCard label="Danh Tiếng" value={summary?.reputation ?? 0} icon={Star} color="purple"
                    sub={summary?.reputationTitle} />
                  <StatCard label="Đồng Minh" value={summary?.alliesCount ?? 0} icon={Users} color="blue"
                    sub={`${summary?.enemiesCount ?? 0} kẻ thù`} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Doanh Nghiệp" value={summary?.businessCount ?? 0} icon={Building2} color="cyan" />
                  <StatCard label="Phe Phái" value={summary?.factionCount ?? 0} icon={Shield} color="purple" />
                  <StatCard label="Cuộc Chiến" value={summary?.warCount ?? 0} icon={Swords} color="red" />
                  <StatCard label="Tranh Cử" value={summary?.electionCount ?? 0} icon={Vote} color="blue" />
                </div>

                {/* Quick actions */}
                <div>
                  <SectionTitle>Hành Động Nhanh</SectionTitle>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Thu Nhập", icon: Coins, action: () => collectIncome.mutate(selectedChar!), color: "yellow" },
                      { label: "Tham Chiến", icon: Swords, action: () => setActiveTab("war"), color: "red" },
                      { label: "Tranh Cử", icon: Vote, action: () => setActiveTab("politics"), color: "blue" },
                      { label: "Lập Doanh Nghiệp", icon: Building2, action: () => setModal("business"), color: "green" },
                    ].map(btn => (
                      <button key={btn.label} onClick={btn.action}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-800 hover:border-${btn.color}-500/50 bg-gray-900/30 hover:bg-${btn.color}-500/5 transition-all group`}>
                        <btn.icon size={20} className={`text-${btn.color}-400 group-hover:scale-110 transition-transform`} />
                        <span className="text-xs text-gray-400 font-mono">{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recent activity */}
                {profile.activityLog.length > 0 && (
                  <div>
                    <SectionTitle>Hoạt Động Gần Đây</SectionTitle>
                    <div className="space-y-2">
                      {profile.activityLog.slice(0, 6).map(log => (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-900/30 border border-gray-800/50">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-300 truncate">{log.summary}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{new Date(log.createdAt).toLocaleString("vi-VN")}</p>
                          </div>
                          <span className="text-xs font-mono text-cyan-500/60 bg-cyan-500/10 px-2 py-0.5 rounded flex-shrink-0">{log.actionType}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── WORLD ── */}
            {activeTab === "world" && (
              <div className="space-y-6">
                <SectionTitle>Trạng Thái Thế Giới</SectionTitle>
                {worldCtx?.worldState ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Dân Số" value={(worldCtx.worldState.population ?? 0).toLocaleString()} icon={Users} color="blue" />
                    <StatCard label="Kinh Tế" value={`${(worldCtx.worldState.economyScore ?? 0).toFixed(1)}/100`} icon={TrendingUp} color="green" />
                    <StatCard label="Tâm Trạng" value={`${(worldCtx.worldState.avgMood ?? 0).toFixed(1)}/100`} icon={Heart} color="purple" />
                    <StatCard label="Ổn Định" value={`${(worldCtx.worldState.stability ?? 0).toFixed(1)}/100`} icon={Shield} color="cyan" />
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-8">Chưa có dữ liệu thế giới</p>
                )}

                {/* Active wars */}
                {worldCtx?.activeWars?.length > 0 && (
                  <>
                    <SectionTitle>Chiến Tranh Đang Diễn Ra</SectionTitle>
                    <div className="space-y-2">
                      {worldCtx.activeWars.map((w: any) => (
                        <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                          <div>
                            <p className="text-sm font-semibold text-red-400">{w.attackerWorldName} ⚔️ {w.defenderWorldName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{w.warReason || "Không rõ lý do"}</p>
                          </div>
                          <button onClick={() => { setActiveTab("war"); }}
                            className="text-xs px-3 py-1 border border-red-500/40 text-red-400 rounded hover:bg-red-500/10 transition-colors">
                            Tham Chiến
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Open elections */}
                {worldCtx?.openElections?.length > 0 && (
                  <>
                    <SectionTitle>Bầu Cử Đang Mở</SectionTitle>
                    <div className="space-y-2">
                      {worldCtx.openElections.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                          <div>
                            <p className="text-sm font-semibold text-blue-400">{e.electionType}</p>
                            <p className="text-xs text-gray-500">{e.totalVotes} phiếu đã bầu</p>
                          </div>
                          <button onClick={() => setActiveTab("politics")}
                            className="text-xs px-3 py-1 border border-blue-500/40 text-blue-400 rounded hover:bg-blue-500/10 transition-colors">
                            Tranh Cử
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* NPCs nearby */}
                {worldCtx?.npcsNearby?.length > 0 && (
                  <>
                    <SectionTitle>NPC Trong Thế Giới</SectionTitle>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {worldCtx.npcsNearby.slice(0, 12).map((npc: any) => (
                        <div key={npc.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-800 bg-gray-900/20 hover:border-cyan-500/30 transition-colors group">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs">
                            {npc.name?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{npc.name}</p>
                            <p className="text-xs text-gray-500 truncate">{npc.occupation}</p>
                          </div>
                          <button onClick={() => postApi(`/api/player-agent/${selectedChar}/talk/${npc.id}`, { message: "Xin chào" })
                            .then(() => { setMsg(`💬 Đã nói chuyện với ${npc.name}`); setTimeout(() => setMsg(""), 3000); })}
                            className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MessageCircle size={14} className="text-cyan-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── RELATIONS ── */}
            {activeTab === "relations" && profile && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <StatCard label="Đồng Minh" value={summary?.alliesCount ?? 0} icon={Heart} color="green" />
                  <StatCard label="Quen Biết" value={(profile.relationships.filter((r: any) => r.score >= -10 && r.score < 40).length)} icon={Users} color="blue" />
                  <StatCard label="Kẻ Thù" value={summary?.enemiesCount ?? 0} icon={Swords} color="red" />
                </div>

                <SectionTitle>Quan Hệ ({profile.relationships.length})</SectionTitle>
                {profile.relationships.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-sm">Chưa có quan hệ nào. Hãy nói chuyện với NPC trong thế giới.</p>
                ) : (
                  <div className="space-y-2">
                    {profile.relationships.map((rel: any) => (
                      <div key={rel.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-800 bg-gray-900/20">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border ${
                          rel.score >= 40 ? "bg-green-500/10 border-green-500/30 text-green-400" :
                          rel.score >= 0 ? "bg-blue-500/10 border-blue-500/30 text-blue-400" :
                          "bg-red-500/10 border-red-500/30 text-red-400"
                        }`}>{rel.targetName?.[0] ?? "?"}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{rel.targetName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                              rel.score >= 40 ? "bg-green-500/10 text-green-400" :
                              rel.score >= 0 ? "bg-blue-500/10 text-blue-400" :
                              "bg-red-500/10 text-red-400"
                            }`}>{rel.relationType}</span>
                            <span className="text-xs text-gray-600">{rel.targetType === "npc" ? "NPC" : "Người chơi"}</span>
                          </div>
                          {rel.notes && <p className="text-xs text-gray-500 mt-0.5">{rel.notes}</p>}
                        </div>
                        <div className="text-right">
                          <div className={`font-mono text-sm font-bold ${rel.score >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {rel.score > 0 ? "+" : ""}{rel.score}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Family */}
                {profile.family.length > 0 && (
                  <>
                    <SectionTitle>Gia Đình ({profile.family.length})</SectionTitle>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {profile.family.map((f: any) => (
                        <div key={f.id} className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                          <div className="flex items-center gap-2">
                            <Heart size={14} className="text-purple-400" />
                            <span className="text-xs text-purple-400 font-mono uppercase">{f.relType}</span>
                          </div>
                          <p className="font-medium mt-1">{f.targetName}</p>
                          {f.familyName && <p className="text-xs text-gray-500">Gia tộc {f.familyName}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── FACTIONS ── */}
            {activeTab === "factions" && profile && (
              <div className="space-y-6">
                <SectionTitle>Phe Phái Đã Gia Nhập ({profile.factions.length})</SectionTitle>
                {profile.factions.length === 0 ? (
                  <div className="text-center py-10">
                    <Shield size={40} className="mx-auto mb-3 text-gray-700" />
                    <p className="text-gray-500 text-sm">Chưa gia nhập phe phái nào</p>
                    <p className="text-gray-600 text-xs mt-1">Đến trang Phe Phái để tìm kiếm và gia nhập</p>
                    <a href="/npc-factions" className="mt-3 inline-block text-cyan-400 text-sm hover:underline">→ Xem Phe Phái NPC</a>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {profile.factions.map((f: any) => (
                      <div key={f.id} className="p-4 rounded-xl border border-gray-800 bg-gray-900/20 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center border border-purple-500/20">
                          <Shield size={20} className="text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{f.factionName}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500 font-mono">{f.factionType}</span>
                            <span className="text-xs text-cyan-400 font-mono">{f.role}</span>
                            <span className="text-xs text-gray-500">Đóng góp: {f.contribution}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">{new Date(f.joinedAt).toLocaleDateString("vi-VN")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── ECONOMY ── */}
            {activeTab === "economy" && profile && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Gold Mặt" value={(agent?.gold ?? 0).toLocaleString()} icon={Coins} color="yellow" />
                  <StatCard label="Ngân Hàng" value={(profile.bank?.balance ?? 0).toLocaleString()} icon={Building2} color="green" />
                  <StatCard label="Tài Sản Ròng" value={(agent?.totalAssets ?? 0).toLocaleString()} icon={TrendingUp} color="cyan" />
                  <StatCard label="Thu Nhập/Tick" value={`+${profile.passiveIncome}`} icon={Zap} color="purple" />
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => collectIncome.mutate(selectedChar!)}
                    disabled={collectIncome.isPending || profile.businesses.filter((b: any) => b.status === "open").length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg hover:bg-yellow-500/20 transition-colors disabled:opacity-40 text-sm font-mono">
                    <Coins size={14} /> Thu Nhập Thụ Động
                  </button>
                  <button onClick={() => setModal("business")}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors text-sm font-mono">
                    <Plus size={14} /> Lập Doanh Nghiệp
                  </button>
                </div>

                <SectionTitle>Doanh Nghiệp ({profile.businesses.length})</SectionTitle>
                {profile.businesses.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-sm">Chưa có doanh nghiệp nào</p>
                ) : (
                  <div className="grid gap-3">
                    {profile.businesses.map((b: any) => (
                      <div key={b.id} className="p-4 rounded-xl border border-gray-800 bg-gray-900/20">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Building2 size={16} className="text-cyan-400" />
                              <span className="font-semibold">{b.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                                b.status === "open" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                              }`}>{b.status}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {b.type} · Cấp {b.level} · {b.employees} nhân viên
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-green-400 font-mono text-sm">+{b.incomePerTick}/tick</div>
                            <div className="text-xs text-gray-500">Tổng: {(b.totalEarned).toLocaleString()}g</div>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-800 flex items-center gap-4 text-xs text-gray-500">
                          <span>Vốn: {b.capitalInvested.toLocaleString()}g</span>
                          <span>ROI: {b.capitalInvested > 0 ? ((b.totalEarned / b.capitalInvested) * 100).toFixed(1) : 0}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <SectionTitle>Giao Dịch Gần Đây ({profile.recentTrades.length})</SectionTitle>
                <div className="space-y-1.5">
                  {profile.recentTrades.slice(0, 10).map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-900/20 border border-gray-800/50">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                        t.tradeType === "buy" ? "bg-blue-500/10 text-blue-400" : "bg-green-500/10 text-green-400"
                      }`}>{t.tradeType === "buy" ? "MUA" : "BÁN"}</span>
                      <span className="text-sm flex-1">{t.quantity}x {t.itemName}</span>
                      <span className={`font-mono text-sm ${t.tradeType === "buy" ? "text-red-400" : "text-green-400"}`}>
                        {t.tradeType === "buy" ? "-" : "+"}{t.totalPrice.toLocaleString()}g
                      </span>
                    </div>
                  ))}
                  {profile.recentTrades.length === 0 && <p className="text-center text-gray-500 py-4 text-sm">Chưa có giao dịch nào</p>}
                </div>
              </div>
            )}

            {/* ── POLITICS ── */}
            {activeTab === "politics" && profile && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Lần Tranh Cử" value={profile.elections.length} icon={Vote} color="blue" />
                  <StatCard label="Danh Tiếng Chính Trị" value={agent?.politicalRank ?? "Thường Dân"} icon={Award} color="purple" />
                </div>

                {worldCtx?.openElections?.length > 0 && (
                  <>
                    <SectionTitle>Bầu Cử Đang Mở</SectionTitle>
                    <div className="space-y-3">
                      {worldCtx.openElections.map((e: any) => {
                        const alreadyRunning = profile.elections.some((c: any) => c.electionId === e.id);
                        return (
                          <div key={e.id} className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-blue-300">{e.electionType}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{e.totalVotes} phiếu · Trạng thái: {e.status}</p>
                              </div>
                              {alreadyRunning ? (
                                <span className="text-xs text-green-400 font-mono">✓ Đã Đăng Ký</span>
                              ) : (
                                <button onClick={() => postApi(`/api/player-agent/${selectedChar}/run-for-election`, {
                                  electionId: e.id, worldSlug: agent?.worldSlug ?? "", platform: "Vì nhân dân"
                                }).then(() => { setMsg("🗳️ Đã đăng ký tranh cử!"); qc.invalidateQueries({ queryKey: ["/api/player-agent", selectedChar] }); setTimeout(() => setMsg(""), 3000); })}
                                  className="text-xs px-3 py-1 border border-blue-500/40 text-blue-400 rounded hover:bg-blue-500/10 transition-colors">
                                  Tranh Cử
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <SectionTitle>Lịch Sử Tranh Cử</SectionTitle>
                {profile.elections.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-sm">Chưa tham gia bầu cử nào</p>
                ) : (
                  <div className="space-y-2">
                    {profile.elections.map((e: any) => (
                      <div key={e.id} className="p-3 rounded-lg border border-gray-800 bg-gray-900/20 flex items-center gap-3">
                        <Vote size={16} className="text-blue-400 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm">{e.electionType}</p>
                          <p className="text-xs text-gray-500">Campaign score: {e.campaignScore} · {e.votes} phiếu</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                          e.result === "won" ? "bg-green-500/10 text-green-400" :
                          e.status === "running" ? "bg-yellow-500/10 text-yellow-400" :
                          "bg-gray-500/10 text-gray-400"
                        }`}>{e.result === "won" ? "THẮNG" : e.status === "running" ? "ĐANG ĐỢI" : "THUA"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── WAR ── */}
            {activeTab === "war" && profile && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Cuộc Chiến" value={profile.wars.participations.length} icon={Swords} color="red" />
                  <StatCard label="Tổng Kill" value={profile.wars.totalKills} icon={Zap} color="yellow" />
                  <StatCard label="Tổng Death" value={profile.wars.totalDeaths} icon={Shield} color="blue" />
                </div>

                {/* Active wars to join */}
                {worldCtx?.activeWars?.length > 0 && (
                  <>
                    <SectionTitle>Chiến Tranh Đang Diễn Ra</SectionTitle>
                    <div className="space-y-3">
                      {worldCtx.activeWars.map((w: any) => {
                        const alreadyIn = profile.wars.participations.some((p: any) => p.warId === w.id);
                        return (
                          <div key={w.id} className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-red-300">{w.attackerWorldName} ⚔️ {w.defenderWorldName}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{w.warReason || "Chiến tranh lãnh thổ"}</p>
                                <p className="text-xs text-gray-600 mt-1">Tấn công: {w.attackerScore} — Phòng thủ: {w.defenderScore}</p>
                              </div>
                              {alreadyIn ? (
                                <span className="text-xs text-green-400 font-mono">✓ Đang Tham Chiến</span>
                              ) : (
                                <div className="flex gap-2 flex-shrink-0">
                                  {["attacker", "defender"].map(side => (
                                    <button key={side} onClick={() => joinWar.mutate({ cid: selectedChar!, warId: w.id, side })}
                                      disabled={joinWar.isPending}
                                      className={`text-xs px-3 py-1 border rounded hover:opacity-80 transition-opacity font-mono ${
                                        side === "attacker"
                                          ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                                          : "border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                                      }`}>
                                      {side === "attacker" ? "Tấn Công" : "Phòng Thủ"}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <SectionTitle>Lịch Sử Tham Chiến</SectionTitle>
                {profile.wars.participations.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 text-sm">Chưa tham gia chiến tranh nào</p>
                ) : (
                  <div className="space-y-2">
                    {profile.wars.participations.map((p: any) => (
                      <div key={p.id} className="p-3 rounded-lg border border-gray-800 bg-gray-900/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Swords size={14} className="text-red-400" />
                            <div>
                              <p className="text-sm font-medium">{p.side === "attacker" ? "Tấn công" : "Phòng thủ"}</p>
                              <p className="text-xs text-gray-500">Kill: {p.kills} · Death: {p.deaths} · Đóng góp: {p.contribution}</p>
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="text-yellow-400 font-mono">+{p.goldEarned}g</div>
                            <div className="text-purple-400 font-mono">+{p.repEarned} rep</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── HISTORY ── */}
            {activeTab === "history" && profile && (
              <div className="space-y-4">
                <SectionTitle>Nhật Ký Hoạt Động ({profile.activityLog.length})</SectionTitle>
                <div className="space-y-2">
                  {profile.activityLog.map((log: any) => (
                    <div key={log.id} className="p-3 rounded-lg border border-gray-800 bg-gray-900/20">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-mono text-cyan-500/60 bg-cyan-500/10 px-2 py-0.5 rounded flex-shrink-0 mt-0.5">{log.actionType}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300">{log.summary}</p>
                          <p className="text-xs text-gray-600 mt-1">{new Date(log.createdAt).toLocaleString("vi-VN")}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {profile.activityLog.length === 0 && <p className="text-center text-gray-500 py-8 text-sm">Chưa có hoạt động nào</p>}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Found Business Modal ── */}
      {modal === "business" && (
        <FoundBusinessModal
          characterId={selectedChar!}
          onClose={() => setModal(null)}
          onSuccess={(result) => {
            setMsg(`🏪 Đã lập "${result.business?.name}". Thu nhập: +${result.incomePerTick}/tick`);
            qc.invalidateQueries({ queryKey: ["/api/player-agent", selectedChar] });
            setModal(null);
            setTimeout(() => setMsg(""), 4000);
          }}
        />
      )}
    </div>
  );
}

/* ─── Found Business Modal ─── */
function FoundBusinessModal({ characterId, onClose, onSuccess }: {
  characterId: string; onClose: () => void; onSuccess: (r: any) => void;
}) {
  const [form, setForm] = useState({ name: "", type: "shop", capital: 500 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const TYPES = [
    { id: "shop", label: "Cửa Hàng", income: 20 },
    { id: "farm", label: "Nông Trại", income: 15 },
    { id: "workshop", label: "Xưởng Thủ Công", income: 25 },
    { id: "inn", label: "Quán Trọ", income: 30 },
    { id: "guild", label: "Hội Đoàn", income: 40 },
    { id: "trade_post", label: "Trạm Giao Dịch", income: 35 },
    { id: "mine", label: "Mỏ", income: 22 },
  ];

  const estIncome = Math.floor(
    (TYPES.find(t => t.id === form.type)?.income ?? 20) * (1 + form.capital / 1000)
  );

  async function submit() {
    if (!form.name.trim()) return setErr("Tên doanh nghiệp không được trống");
    setLoading(true); setErr("");
    const r = await postApi(`/api/player-agent/${characterId}/found-business`, form);
    setLoading(false);
    if (r.error) setErr(r.error);
    else onSuccess(r);
  }

  return (
    <ActionModal title="Thành Lập Doanh Nghiệp" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 font-mono block mb-1">TÊN DOANH NGHIỆP</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/50 outline-none"
            placeholder="Ví dụ: Cửa Hàng Gia Truyền" />
        </div>
        <div>
          <label className="text-xs text-gray-400 font-mono block mb-1">LOẠI</label>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(t => (
              <button key={t.id} onClick={() => setForm(f => ({ ...f, type: t.id }))}
                className={`p-2 rounded-lg text-xs border transition-all ${
                  form.type === t.id ? "border-cyan-500 text-cyan-400 bg-cyan-500/10" : "border-gray-700 text-gray-400 hover:border-gray-500"
                }`}>{t.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 font-mono block mb-1">VỐN (GOLD)</label>
          <input type="number" value={form.capital} min={100} onChange={e => setForm(f => ({ ...f, capital: Number(e.target.value) }))}
            className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500/50 outline-none" />
        </div>
        <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-sm text-green-400 font-mono">
          Dự kiến thu nhập: +{estIncome}/tick
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <button onClick={submit} disabled={loading}
          className="w-full py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors text-sm font-mono disabled:opacity-50">
          {loading ? "Đang xử lý..." : "Thành Lập"}
        </button>
      </div>
    </ActionModal>
  );
}
