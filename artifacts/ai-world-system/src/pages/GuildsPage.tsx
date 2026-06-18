import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Shield, Users, Star, Plus, Loader2,
  Search, Crown, Sword, Globe, X, Swords, ZapIcon
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { WORLDS } from "@/lib/worlds";

interface GuildEntry {
  id: string;
  name: string;
  worldSlug: string;
  description: string;
  tag: string;
  memberCount: number;
  totalExp: number;
  rank: number;
  leaderName: string;
  leaderLevel: number;
}

interface Character {
  id: string;
  name: string;
  level: number;
  stats: Record<string, any>;
  worldSlug?: string;
}

const WORLD_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  cultivation: { label: "Tu Tiên", color: "text-cyan-400", icon: "⚡" },
  cyberpunk: { label: "Cyberpunk", color: "text-purple-400", icon: "🌐" },
  wasteland: { label: "Hoang Phế", color: "text-amber-400", icon: "☢️" },
};

export default function GuildsPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [guilds, setGuilds] = useState<GuildEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeWorld, setActiveWorld] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [myChars, setMyChars] = useState<Character[]>([]);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [form, setForm] = useState({
    name: "", worldSlug: "cultivation", description: "", tag: "", characterId: "",
  });

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    loadGuilds();
    loadMyChars();
  }, [user, activeWorld]);

  async function loadGuilds() {
    setFetching(true);
    try {
      const url = activeWorld === "all" ? "/api/guilds" : `/api/guilds?world=${activeWorld}`;
      const res = await fetch(url, { credentials: "include" });
      setGuilds(res.ok ? await res.json() : []);
    } catch { setGuilds([]); }
    finally { setFetching(false); }
  }

  async function loadMyChars() {
    try {
      const res = await fetch("/api/characters", { credentials: "include" });
      const data: Character[] = res.ok ? await res.json() : [];
      setMyChars(data);
    } catch {}
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr("");
    if (!form.characterId) { setCreateErr("Chọn nhân vật tạo bang"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/guilds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setCreateErr(data.message || "Lỗi tạo bang hội"); return; }
      setShowCreate(false);
      setForm({ name: "", worldSlug: "cultivation", description: "", tag: "", characterId: "" });
      loadGuilds();
    } catch { setCreateErr("Lỗi kết nối"); }
    finally { setCreating(false); }
  }

  const filtered = guilds.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.leaderName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/dashboard")} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-orbitron text-lg font-bold tracking-widest text-primary">BANG HỘI</h1>
              <p className="text-xs text-muted-foreground">Liên minh tu luyện — sức mạnh tập thể</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/40 hover:bg-primary/20 text-primary text-sm font-orbitron tracking-wider transition-colors"
          >
            <Plus className="w-4 h-4" />
            LẬP BANG
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex gap-1 flex-1 min-w-[180px]">
            {["all", "cultivation", "cyberpunk", "wasteland"].map(w => (
              <button
                key={w}
                onClick={() => setActiveWorld(w)}
                className={`px-3 py-1.5 rounded-lg text-xs font-orbitron tracking-wider transition-colors border ${
                  activeWorld === w
                    ? "bg-primary/20 border-primary/60 text-primary"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                {w === "all" ? "TẤT CẢ" : WORLD_LABELS[w]?.label.toUpperCase() ?? w.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm bang hội..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-muted/50 border border-border focus:border-primary/60 focus:outline-none w-48"
            />
          </div>
        </div>

        {/* Guild list */}
        {fetching ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-orbitron text-sm tracking-wider">CHƯA CÓ BANG HỘI</p>
            <p className="text-xs mt-1">Lập bang đầu tiên để bắt đầu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((guild, i) => {
              const wl = WORLD_LABELS[guild.worldSlug] ?? { label: guild.worldSlug, color: "text-muted-foreground", icon: "⚔️" };
              const rankStyle = i === 0
                ? "border-yellow-500/40 bg-yellow-500/5"
                : i === 1 ? "border-slate-400/40 bg-slate-400/5"
                : i === 2 ? "border-amber-600/40 bg-amber-600/5"
                : "border-border bg-card/40";
              return (
                <motion.div
                  key={guild.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setLocation(`/guilds/${guild.id}`)}
                  className={`border rounded-xl p-4 cursor-pointer hover:bg-muted/30 transition-all ${rankStyle}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-lg font-bold text-muted-foreground w-6 shrink-0 text-center">
                        {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-orbitron text-sm font-bold text-foreground truncate">{guild.name}</span>
                          {guild.tag && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-primary/30 text-primary/70 font-mono shrink-0">
                              [{guild.tag}]
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs ${wl.color}`}>{wl.icon} {wl.label}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Crown className="w-3 h-3" /> {guild.leaderName ?? "—"} Lv.{guild.leaderLevel ?? 1}
                          </span>
                        </div>
                        {guild.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{guild.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1 text-xs text-cyan-400">
                        <Star className="w-3 h-3" />
                        <span className="font-mono">{guild.totalExp.toLocaleString()} EXP</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span>{guild.memberCount} thành viên</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md bg-card border border-border rounded-2xl p-6"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-orbitron text-base font-bold text-primary tracking-wider">LẬP BANG HỘI</h2>
                <button onClick={() => { setShowCreate(false); setCreateErr(""); }} className="p-1 rounded hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground font-orbitron tracking-wider">CHỌN NHÂN VẬT</label>
                  <select
                    value={form.characterId}
                    onChange={e => {
                      const c = myChars.find(c => c.id === e.target.value);
                      setForm(f => ({
                        ...f,
                        characterId: e.target.value,
                        worldSlug: (c?.stats as any)?.world_slug ?? f.worldSlug,
                      }));
                    }}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/60 focus:outline-none"
                    required
                  >
                    <option value="">— Chọn nhân vật —</option>
                    {myChars.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Lv.{c.level} · {WORLD_LABELS[(c.stats as any)?.world_slug ?? ""]?.label ?? "?"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-orbitron tracking-wider">TÊN BANG HỘI *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    maxLength={32}
                    placeholder="Tên bang hội (2–32 ký tự)"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/60 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-orbitron tracking-wider">TAG [TÙY CHỌN]</label>
                  <input
                    value={form.tag}
                    onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                    maxLength={8}
                    placeholder="VD: APEX (tối đa 8 ký tự)"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/60 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-orbitron tracking-wider">MÔ TẢ [TÙY CHỌN]</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    maxLength={200}
                    rows={2}
                    placeholder="Giới thiệu ngắn về bang hội..."
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/60 focus:outline-none resize-none"
                  />
                </div>
                {createErr && <p className="text-red-400 text-xs">{createErr}</p>}
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full py-2.5 rounded-lg bg-primary/20 border border-primary/50 text-primary font-orbitron text-sm tracking-wider hover:bg-primary/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  {creating ? "ĐANG TẠO..." : "LẬP BANG"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
