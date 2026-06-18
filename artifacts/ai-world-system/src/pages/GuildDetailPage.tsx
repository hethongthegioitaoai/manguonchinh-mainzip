import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Shield, Users, Star, Crown, Loader2,
  LogIn, LogOut, Trash2, Sword, AlertTriangle, Check, X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SYSTEM_ICONS, type SystemName } from "@/lib/worlds";

interface GuildMember {
  id: string;
  characterId: string;
  role: string;
  joinedAt: string;
  characterName: string;
  characterLevel: number;
  characterExp: number;
  characterStats: Record<string, any>;
}

interface GuildDetail {
  id: string;
  name: string;
  worldSlug: string;
  description: string;
  tag: string;
  memberCount: number;
  totalExp: number;
  leaderId: string;
  leaderName: string;
  leaderLevel: number;
  createdAt: string;
  members: GuildMember[];
}

interface MyChar {
  id: string;
  name: string;
  level: number;
  stats: Record<string, any>;
}

const WORLD_LABELS: Record<string, { label: string; color: string; accent: string }> = {
  cultivation: { label: "Tu Tiên", color: "text-cyan-400", accent: "border-cyan-500/40" },
  cyberpunk: { label: "Cyberpunk", color: "text-purple-400", accent: "border-purple-500/40" },
  wasteland: { label: "Hoang Phế", color: "text-amber-400", accent: "border-amber-500/40" },
};

const ROLE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  leader: { label: "Bang Chủ", icon: "👑", color: "text-yellow-400" },
  elder: { label: "Trưởng Lão", icon: "⭐", color: "text-orange-400" },
  member: { label: "Thành Viên", icon: "⚔️", color: "text-muted-foreground" },
};

export default function GuildDetailPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { id: guildId } = useParams<{ id: string }>();
  const [guild, setGuild] = useState<GuildDetail | null>(null);
  const [myChars, setMyChars] = useState<MyChar[]>([]);
  const [fetching, setFetching] = useState(true);
  const [action, setAction] = useState<null | "join" | "leave" | "disband">(null);
  const [selectedChar, setSelectedChar] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    loadGuild();
    loadMyChars();
  }, [user, guildId]);

  async function loadGuild() {
    setFetching(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}`, { credentials: "include" });
      setGuild(res.ok ? await res.json() : null);
    } catch { setGuild(null); }
    finally { setFetching(false); }
  }

  async function loadMyChars() {
    try {
      const res = await fetch("/api/characters", { credentials: "include" });
      setMyChars(res.ok ? await res.json() : []);
    } catch {}
  }

  const memberCharIds = new Set(guild?.members.map(m => m.characterId) ?? []);
  const myMemberships = myChars.filter(c => memberCharIds.has(c.id));
  const myCharInGuild = myMemberships[0] ?? null;
  const isLeader = guild && myCharInGuild
    ? guild.leaderId === myCharInGuild.id
    : false;

  async function doAction() {
    if (!guild) return;
    setActionErr("");
    setActionLoading(true);
    try {
      if (action === "join") {
        if (!selectedChar) { setActionErr("Chọn nhân vật gia nhập"); setActionLoading(false); return; }
        const res = await fetch(`/api/guilds/${guild.id}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ characterId: selectedChar }),
        });
        const data = await res.json();
        if (!res.ok) { setActionErr(data.message || "Lỗi gia nhập"); setActionLoading(false); return; }
        setSuccessMsg("Gia nhập bang hội thành công!");
      } else if (action === "leave") {
        if (!myCharInGuild) return;
        const res = await fetch(`/api/guilds/${guild.id}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ characterId: myCharInGuild.id }),
        });
        const data = await res.json();
        if (!res.ok) { setActionErr(data.message || "Lỗi rời bang"); setActionLoading(false); return; }
        setSuccessMsg("Đã rời bang hội!");
      } else if (action === "disband") {
        const res = await fetch(`/api/guilds/${guild.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) { setActionErr(data.message || "Lỗi giải tán"); setActionLoading(false); return; }
        setSuccessMsg("Đã giải tán bang hội!");
        setTimeout(() => setLocation("/guilds"), 1500);
        return;
      }
      setAction(null);
      await loadGuild();
    } catch { setActionErr("Lỗi kết nối"); }
    finally { setActionLoading(false); }
  }

  const wl = guild ? (WORLD_LABELS[guild.worldSlug] ?? { label: guild.worldSlug, color: "text-muted-foreground", accent: "border-border" }) : null;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
      </div>
    );
  }

  if (!fetching && !guild) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <p className="font-orbitron text-muted-foreground">Bang hội không tồn tại</p>
        <button onClick={() => setLocation("/guilds")} className="text-primary text-sm underline">← Quay lại</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/guilds")} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-orbitron text-base font-bold tracking-widest text-primary">BANG HỘI</h1>
              <p className="text-xs text-muted-foreground">Chi tiết tổ chức</p>
            </div>
          </div>
        </div>

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/40 text-green-400 text-sm flex items-center gap-2"
          >
            <Check className="w-4 h-4" /> {successMsg}
          </motion.div>
        )}

        {fetching ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : guild && wl && (
          <>
            {/* Guild card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border ${wl.accent} bg-card/60 p-6 mb-6`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-orbitron text-xl font-bold text-foreground">{guild.name}</span>
                    {guild.tag && (
                      <span className="text-xs px-2 py-0.5 rounded border border-primary/40 text-primary/70 font-mono">[{guild.tag}]</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`${wl.color} font-medium`}>{wl.label}</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Crown className="w-3 h-3" /> {guild.leaderName ?? "—"} (Lv.{guild.leaderLevel ?? 1})
                    </span>
                  </div>
                  {guild.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{guild.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-cyan-400">
                    <Star className="w-4 h-4" />
                    <span className="font-mono font-bold">{guild.totalExp.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">EXP</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <Users className="w-4 h-4" />
                    <span>{guild.memberCount} thành viên</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                {!myCharInGuild ? (
                  <button
                    onClick={() => { setAction("join"); setActionErr(""); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 text-sm font-orbitron tracking-wider hover:bg-cyan-500/20 transition-colors"
                  >
                    <LogIn className="w-4 h-4" /> GIA NHẬP
                  </button>
                ) : !isLeader ? (
                  <button
                    onClick={() => { setAction("leave"); setActionErr(""); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/40 text-orange-400 text-sm font-orbitron tracking-wider hover:bg-orange-500/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> RỜI BANG
                  </button>
                ) : (
                  <button
                    onClick={() => { setAction("disband"); setActionErr(""); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 text-sm font-orbitron tracking-wider hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> GIẢI TÁN
                  </button>
                )}
                {myCharInGuild && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    <span>{myCharInGuild.name} đang ở bang này ({isLeader ? "Bang Chủ" : "Thành Viên"})</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Member list */}
            <div>
              <h2 className="font-orbitron text-sm tracking-widest text-muted-foreground mb-3">
                THÀNH VIÊN ({guild.members.length})
              </h2>
              <div className="space-y-2">
                {guild.members.map((m, i) => {
                  const roleInfo = ROLE_LABELS[m.role] ?? ROLE_LABELS.member;
                  const sysIcon = SYSTEM_ICONS[(m.characterStats?.system as SystemName)] ?? "⚡";
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setLocation(`/character/${m.characterId}`)}
                      className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/30 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{sysIcon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground">{m.characterName}</span>
                            <span className={`text-xs ${roleInfo.color}`}>{roleInfo.icon} {roleInfo.label}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Lv.{m.characterLevel} · {m.characterExp.toLocaleString()} EXP
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.joinedAt).toLocaleDateString("vi-VN")}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action confirm modal */}
      <AnimatePresence>
        {action && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-6"
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
            >
              {action === "join" && (
                <>
                  <h3 className="font-orbitron text-base font-bold text-cyan-400 mb-4">GIA NHẬP BANG HỘI</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Chọn nhân vật để gia nhập <span className="text-foreground font-medium">{guild?.name}</span>
                  </p>
                  <select
                    value={selectedChar}
                    onChange={e => setSelectedChar(e.target.value)}
                    className="w-full px-3 py-2 mb-4 rounded-lg bg-background border border-border text-sm focus:border-primary/60 focus:outline-none"
                  >
                    <option value="">— Chọn nhân vật —</option>
                    {myChars.filter(c => !memberCharIds.has(c.id)).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Lv.{c.level})
                      </option>
                    ))}
                  </select>
                </>
              )}
              {action === "leave" && (
                <>
                  <div className="flex items-center gap-2 text-orange-400 mb-3">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="font-orbitron text-base font-bold">RỜI BANG HỘI</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Xác nhận rời bang <span className="text-foreground font-medium">{guild?.name}</span>?
                    Hành động này không thể hoàn tác.
                  </p>
                </>
              )}
              {action === "disband" && (
                <>
                  <div className="flex items-center gap-2 text-red-400 mb-3">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="font-orbitron text-base font-bold">GIẢI TÁN BANG HỘI</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Giải tán <span className="text-foreground font-medium">{guild?.name}</span>? Tất cả thành viên sẽ bị đuổi ra. Không thể hoàn tác.
                  </p>
                </>
              )}
              {actionErr && <p className="text-red-400 text-xs mb-3">{actionErr}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => { setAction(null); setActionErr(""); setSelectedChar(""); }}
                  className="flex-1 py-2 rounded-lg border border-border hover:bg-muted text-sm transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={doAction}
                  disabled={actionLoading}
                  className={`flex-1 py-2 rounded-lg text-sm font-orbitron tracking-wider transition-colors flex items-center justify-center gap-2 ${
                    action === "disband"
                      ? "bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30"
                      : action === "leave"
                      ? "bg-orange-500/20 border border-orange-500/50 text-orange-400 hover:bg-orange-500/30"
                      : "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30"
                  }`}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    action === "join" ? "GIA NHẬP" : action === "leave" ? "RỜI BANG" : "GIẢI TÁN"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
