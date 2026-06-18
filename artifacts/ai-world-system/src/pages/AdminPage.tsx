import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Users, Zap, Globe, AlertTriangle, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface WorldStat { worldSlug: string; population: number; avgLevel: number; }
interface ActiveEvent { id: string; worldSlug: string; type: string; title: string; description: string; karmaEffect: number; createdAt: string; triggeredBy: string; }
interface AdminStats { worldStats: WorldStat[]; activeEvents: ActiveEvent[]; karmas: Record<string, number>; totalPlayers: number; }

const WORLD_NAMES: Record<string, string> = { cultivation: "Tu Tiên", cyberpunk: "Cyberpunk", zombie: "Hoang Phế" };
const EVENT_TYPE_ICONS: Record<string, string> = { calamity: "⚡", boss_spawn: "👹", dungeon_open: "🚪", festival: "🎉", war: "⚔", treasure: "💰", plague: "☣" };

const TRIGGER_FORM_DEFAULTS = { worldSlug: "cultivation", type: "calamity", title: "", description: "", durationHours: 12, karmaEffect: -10 };

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [fetching, setFetching] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [generatingWorld, setGeneratingWorld] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [triggerForm, setTriggerForm] = useState(TRIGGER_FORM_DEFAULTS);
  const [triggering, setTriggering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading, setLocation]);

  async function loadStats() {
    setFetching(true);
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (res.status === 403) { setForbidden(true); return; }
      setStats(await res.json());
    } catch {} finally { setFetching(false); }
  }

  useEffect(() => { if (user) loadStats(); }, [user]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  async function handleGenerate(worldSlug: string) {
    if (generatingWorld) return;
    setGeneratingWorld(worldSlug);
    try {
      const res = await fetch(`/api/world-events/${worldSlug}/generate`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) { showToast(data.message); return; }
      showToast(`✓ Sinh sự kiện: ${data.event.title}`);
      await loadStats();
    } finally { setGeneratingWorld(null); }
  }

  async function handleDeactivate(id: string) {
    setDeactivatingId(id);
    try {
      await fetch(`/api/world-events/${id}/deactivate`, { method: "POST", credentials: "include" });
      showToast("Đã tắt sự kiện");
      await loadStats();
    } finally { setDeactivatingId(null); }
  }

  async function handleTrigger() {
    if (!triggerForm.title || !triggerForm.description) { showToast("Vui lòng điền đầy đủ tiêu đề và mô tả"); return; }
    setTriggering(true);
    try {
      const res = await fetch("/api/admin/event/trigger", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(triggerForm),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message); return; }
      showToast(`✓ Đã kích hoạt: ${triggerForm.title}`);
      setTriggerForm(TRIGGER_FORM_DEFAULTS);
      await loadStats();
    } finally { setTriggering(false); }
  }

  const ACCENT = "hsl(var(--primary))";

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-64 pointer-events-none z-0"
        style={{ background: `radial-gradient(ellipse at 30% -10%, ${ACCENT}15, transparent 65%)` }} />

      {toast && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 font-mono text-xs px-4 py-2 border"
          style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}15` }}>
          {toast}
        </motion.div>
      )}

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}
          className="rounded-none font-mono text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50">
          <ArrowLeft className="w-4 h-4 mr-1" /> DASHBOARD
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: ACCENT }}>WORLD MONITOR — ADMIN</span>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {fetching && <div className="flex items-center justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}

        {forbidden && (
          <div className="text-center py-32 space-y-3">
            <AlertTriangle className="w-12 h-12 mx-auto text-destructive/50" />
            <div className="font-orbitron text-xl text-destructive">ACCESS DENIED</div>
            <div className="font-mono text-sm text-muted-foreground">Chỉ admin (người dùng đầu tiên) mới có quyền truy cập.</div>
          </div>
        )}

        {!fetching && !forbidden && stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "TỔNG NGƯỜI CHƠI", value: stats.totalPlayers, icon: Users },
                { label: "THẾ GIỚI HOẠT ĐỘNG", value: stats.worldStats.length, icon: Globe },
                { label: "SỰ KIỆN ĐANG XỬ LÝ", value: stats.activeEvents.length, icon: Zap },
                { label: "KARMA TB", value: Math.round(Object.values(stats.karmas).reduce((a, b) => a + b, 0) / Math.max(Object.values(stats.karmas).length, 1)), icon: RefreshCw },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="border border-border/50 bg-card/40 p-4">
                  <Icon className="w-4 h-4 mb-2" style={{ color: ACCENT }} />
                  <div className="font-orbitron text-2xl font-black" style={{ color: ACCENT }}>{value}</div>
                  <div className="font-mono text-xs text-muted-foreground/50 mt-1">{label}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="font-orbitron text-sm tracking-widest mb-4" style={{ color: ACCENT }}>THỐNG KÊ THẾ GIỚI</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.worldStats.map((ws) => {
                  const karma = stats.karmas[ws.worldSlug] ?? 0;
                  const karmaColor = karma > 20 ? "#4ade80" : karma < -20 ? "#ef4444" : "#f59e0b";
                  return (
                    <div key={ws.worldSlug} className="border border-border/50 bg-card/40 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-orbitron text-sm font-bold">{WORLD_NAMES[ws.worldSlug] ?? ws.worldSlug}</div>
                        <span className="font-mono text-xs px-2 py-0.5 border" style={{ borderColor: karmaColor, color: karmaColor }}>
                          KARMA {karma > 0 ? "+" : ""}{karma}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                        <div><span className="text-muted-foreground/50">Người chơi:</span> <span className="text-foreground font-bold">{ws.population}</span></div>
                        <div><span className="text-muted-foreground/50">Cấp TB:</span> <span className="text-foreground font-bold">{ws.avgLevel}</span></div>
                      </div>
                      <Button size="sm" disabled={generatingWorld === ws.worldSlug}
                        onClick={() => handleGenerate(ws.worldSlug)}
                        className="w-full rounded-none font-orbitron text-xs border"
                        style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
                        {generatingWorld === ws.worldSlug ? <Loader2 className="w-3 h-3 animate-spin" /> : "🤖 AI SINH SỰ KIỆN"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="font-orbitron text-sm tracking-widest mb-4" style={{ color: ACCENT }}>SỰ KIỆN ĐANG HOẠT ĐỘNG</div>
              {stats.activeEvents.length === 0 ? (
                <div className="border border-border/30 bg-card/20 p-6 text-center font-mono text-xs text-muted-foreground/40">
                  Không có sự kiện nào. Dùng "AI SINH SỰ KIỆN" để tạo sự kiện mới.
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.activeEvents.map((ev) => (
                    <div key={ev.id} className="border border-border/50 bg-card/40 p-4 flex items-start gap-4">
                      <div className="text-2xl flex-shrink-0">{EVENT_TYPE_ICONS[ev.type] ?? "📋"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-orbitron text-sm font-bold">{ev.title}</span>
                          <span className="font-mono text-xs text-muted-foreground/40">{WORLD_NAMES[ev.worldSlug] ?? ev.worldSlug}</span>
                          <span className="font-mono text-xs text-muted-foreground/30">{ev.triggeredBy === "ai" ? "🤖 AI" : "👤 Admin"}</span>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground/60 leading-relaxed line-clamp-2">{ev.description}</div>
                        <div className="font-mono text-xs mt-1" style={{ color: ev.karmaEffect >= 0 ? "#4ade80" : "#ef4444" }}>
                          Karma: {ev.karmaEffect > 0 ? "+" : ""}{ev.karmaEffect}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" disabled={deactivatingId === ev.id}
                        onClick={() => handleDeactivate(ev.id)}
                        className="rounded-none font-mono text-xs text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/30 flex-shrink-0">
                        {deactivatingId === ev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "TẮT"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-border/50 bg-card/40 p-6 space-y-4">
              <div className="font-orbitron text-sm tracking-widest" style={{ color: ACCENT }}>KÍCH HOẠT SỰ KIỆN THỦ CÔNG</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-xs text-muted-foreground/50 block mb-1">THẾ GIỚI</label>
                  <select value={triggerForm.worldSlug} onChange={(e) => setTriggerForm(p => ({ ...p, worldSlug: e.target.value }))}
                    className="w-full bg-background border border-border/50 font-mono text-xs px-3 py-2 text-foreground">
                    <option value="cultivation">Tu Tiên</option>
                    <option value="cyberpunk">Cyberpunk</option>
                    <option value="zombie">Hoang Phế</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground/50 block mb-1">LOẠI SỰ KIỆN</label>
                  <select value={triggerForm.type} onChange={(e) => setTriggerForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full bg-background border border-border/50 font-mono text-xs px-3 py-2 text-foreground">
                    {["calamity","boss_spawn","dungeon_open","festival","war","treasure","plague"].map(t => (
                      <option key={t} value={t}>{EVENT_TYPE_ICONS[t]} {t}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="font-mono text-xs text-muted-foreground/50 block mb-1">TIÊU ĐỀ</label>
                  <input value={triggerForm.title} onChange={(e) => setTriggerForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Tên sự kiện..."
                    className="w-full bg-background border border-border/50 font-mono text-xs px-3 py-2 text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/50" />
                </div>
                <div className="md:col-span-2">
                  <label className="font-mono text-xs text-muted-foreground/50 block mb-1">MÔ TẢ</label>
                  <textarea value={triggerForm.description} onChange={(e) => setTriggerForm(p => ({ ...p, description: e.target.value }))}
                    rows={3} placeholder="Mô tả sự kiện..."
                    className="w-full bg-background border border-border/50 font-mono text-xs px-3 py-2 text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/50 resize-none" />
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground/50 block mb-1">THỜI GIAN (giờ)</label>
                  <input type="number" min={1} max={168} value={triggerForm.durationHours}
                    onChange={(e) => setTriggerForm(p => ({ ...p, durationHours: Number(e.target.value) }))}
                    className="w-full bg-background border border-border/50 font-mono text-xs px-3 py-2 text-foreground outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground/50 block mb-1">KARMA EFFECT (-50 → +50)</label>
                  <input type="number" min={-50} max={50} value={triggerForm.karmaEffect}
                    onChange={(e) => setTriggerForm(p => ({ ...p, karmaEffect: Number(e.target.value) }))}
                    className="w-full bg-background border border-border/50 font-mono text-xs px-3 py-2 text-foreground outline-none focus:border-primary/50" />
                </div>
              </div>
              <Button disabled={triggering} onClick={handleTrigger}
                className="rounded-none font-orbitron text-xs tracking-widest border"
                style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
                {triggering ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <CheckCircle className="w-3 h-3 mr-2" />}
                KÍCH HOẠT SỰ KIỆN
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
