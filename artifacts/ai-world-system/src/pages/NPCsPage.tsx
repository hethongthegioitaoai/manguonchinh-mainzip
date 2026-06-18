import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, MessageSquare, Send, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface NPC {
  id: string;
  name: string;
  role: string;
  goals: string[];
  personality: string;
  currentState: { mood: string; location: string; action: string; gold: number; hp: number };
  lastTickAt: string | null;
}

interface TradeOffer { item: string; price: number; }
interface InteractResult { npcName: string; response: string; moodChange: string; action: string; tradeOffer: TradeOffer | null; }

const WORLD_NAMES: Record<string, { name: string; color: string }> = {
  cultivation: { name: "Tu Tiên", color: "#a855f7" },
  cyberpunk:   { name: "Cyberpunk", color: "#06b6d4" },
  zombie:      { name: "Hoang Phế", color: "#ef4444" },
};

const MOOD_COLORS: Record<string, string> = {
  neutral: "#6b7280", happy: "#4ade80", angry: "#ef4444",
  scared: "#f59e0b", greedy: "#a855f7", determined: "#06b6d4",
};

const MOOD_LABELS: Record<string, string> = {
  neutral: "Bình thường", happy: "Vui vẻ", angry: "Tức giận",
  scared: "Sợ hãi", greedy: "Tham lam", determined: "Quyết tâm",
};

export default function NPCsPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [worldSlug, setWorldSlug] = useState<string | null>(null);
  const [npcList, setNpcList] = useState<NPC[]>([]);
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>({});
  const [roleIcons, setRoleIcons] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(false);
  const [selectedNPC, setSelectedNPC] = useState<NPC | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ from: "player" | "npc"; text: string; tradeOffer?: TradeOffer | null }>>([]);
  const [sendingChat, setSendingChat] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/characters", { credentials: "include" })
      .then(r => r.json())
      .then(chars => {
        if (chars?.length > 0) {
          const slug = chars[0]?.stats?.world_slug;
          if (slug) { setWorldSlug(slug); }
        }
      }).catch(() => {});
  }, [user]);

  useEffect(() => { if (worldSlug) loadNPCs(); }, [worldSlug]);

  async function loadNPCs() {
    if (!worldSlug) return;
    setFetching(true);
    try {
      const res = await fetch(`/api/npcs/${worldSlug}`, { credentials: "include" });
      const data = await res.json();
      setNpcList(data.npcs ?? []);
      setRoleLabels(data.roleLabels ?? {});
      setRoleIcons(data.roleIcons ?? {});
    } finally { setFetching(false); }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  async function sendMessage() {
    if (!selectedNPC || !chatInput.trim() || sendingChat) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatHistory(h => [...h, { from: "player", text: userMsg }]);
    setSendingChat(true);
    try {
      const res = await fetch(`/api/npcs/${selectedNPC.id}/interact`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data: InteractResult = await res.json();
      if (!res.ok) { showToast((data as any).message ?? "Lỗi kết nối"); return; }
      setChatHistory(h => [...h, { from: "npc", text: data.response, tradeOffer: data.tradeOffer }]);
      setNpcList(prev => prev.map(n => n.id === selectedNPC.id
        ? { ...n, currentState: { ...n.currentState, mood: data.moodChange, action: data.action } }
        : n));
      if (selectedNPC) setSelectedNPC(p => p ? { ...p, currentState: { ...p.currentState, mood: data.moodChange, action: data.action } } : p);
    } finally { setSendingChat(false); }
  }

  const worldInfo = WORLD_NAMES[worldSlug ?? ""] ?? { name: "Thế Giới", color: "hsl(var(--primary))" };
  const ACCENT = worldInfo.color;

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
          <span className="font-orbitron text-sm tracking-widest" style={{ color: ACCENT }}>
            NPC — {worldInfo.name.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {worldSlug && (
            <div className="flex gap-1">
              {Object.entries(WORLD_NAMES).map(([slug, info]) => (
                <button key={slug} onClick={() => { setWorldSlug(slug); setSelectedNPC(null); setChatHistory([]); }}
                  className="font-mono text-xs px-2 py-1 border transition-all"
                  style={{ borderColor: worldSlug === slug ? info.color : "transparent", color: worldSlug === slug ? info.color : "#6b7280" }}>
                  {info.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-8">
        {fetching && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: ACCENT }} />
          </div>
        )}

        {!fetching && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="font-orbitron text-xs tracking-widest mb-4" style={{ color: ACCENT }}>
                NHÂN VẬT NPCs — {npcList.length} AGENTS
              </div>
              {npcList.map((npc) => {
                const mood = npc.currentState?.mood ?? "neutral";
                const moodColor = MOOD_COLORS[mood] ?? "#6b7280";
                const icon = roleIcons[npc.role] ?? "👤";
                return (
                  <motion.button
                    key={npc.id}
                    whileHover={{ x: 4 }}
                    onClick={() => { setSelectedNPC(npc); setChatHistory([]); }}
                    className="w-full text-left border p-4 transition-all"
                    style={{
                      borderColor: selectedNPC?.id === npc.id ? ACCENT : "hsl(var(--border))",
                      backgroundColor: selectedNPC?.id === npc.id ? `${ACCENT}10` : "transparent",
                    }}>
                    <div className="flex items-center gap-3">
                      <div className="text-2xl flex-shrink-0">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-orbitron text-sm font-bold truncate">{npc.name}</div>
                        <div className="font-mono text-xs text-muted-foreground/60">{roleLabels[npc.role] ?? npc.role}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: moodColor }} />
                          <span className="font-mono text-xs" style={{ color: moodColor }}>{MOOD_LABELS[mood] ?? mood}</span>
                        </div>
                      </div>
                      <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground/30" />
                    </div>
                    <div className="mt-2 font-mono text-xs text-muted-foreground/40 truncate">
                      📍 {npc.currentState?.location ?? "không rõ"} — {npc.currentState?.action ?? "..."}
                    </div>
                  </motion.button>
                );
              })}

              {npcList.length === 0 && (
                <div className="text-center py-12 font-mono text-xs text-muted-foreground/40">
                  Không có NPC trong thế giới này.
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <AnimatePresence mode="wait">
                {!selectedNPC ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full min-h-[400px] border border-border/30 bg-card/20">
                    <div className="font-orbitron text-4xl text-muted-foreground/10 mb-4">👤</div>
                    <div className="font-mono text-xs text-muted-foreground/30">Chọn một NPC để bắt đầu hội thoại</div>
                  </motion.div>
                ) : (
                  <motion.div key={selectedNPC.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    className="border border-border/50 bg-card/40 flex flex-col" style={{ minHeight: 500 }}>
                    <div className="flex items-center gap-4 p-5 border-b border-border/30"
                      style={{ borderTopColor: ACCENT, borderTopWidth: 2 }}>
                      <div className="text-3xl">{roleIcons[selectedNPC.role] ?? "👤"}</div>
                      <div className="flex-1">
                        <div className="font-orbitron text-lg font-bold">{selectedNPC.name}</div>
                        <div className="font-mono text-xs text-muted-foreground/60 mt-0.5">
                          {roleLabels[selectedNPC.role] ?? selectedNPC.role} — 📍 {selectedNPC.currentState?.location}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground/40 mt-0.5 italic line-clamp-1">
                          {selectedNPC.personality}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xs text-muted-foreground/40">Mục tiêu</div>
                        {(selectedNPC.goals as string[]).slice(0, 2).map((g, i) => (
                          <div key={i} className="font-mono text-xs text-muted-foreground/60 line-clamp-1">• {g}</div>
                        ))}
                      </div>
                      <button onClick={() => { setSelectedNPC(null); setChatHistory([]); }}
                        className="text-muted-foreground/30 hover:text-foreground self-start"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-[280px] max-h-[380px]">
                      {chatHistory.length === 0 && (
                        <div className="text-center py-8 font-mono text-xs text-muted-foreground/30">
                          Gõ tin nhắn để bắt đầu hội thoại với {selectedNPC.name}...
                        </div>
                      )}
                      {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.from === "player" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] px-4 py-2 font-mono text-xs leading-relaxed ${
                            msg.from === "player"
                              ? "border border-border/50 bg-card/60 text-foreground"
                              : "border text-foreground"
                          }`}
                          style={msg.from === "npc" ? { borderColor: `${ACCENT}50`, backgroundColor: `${ACCENT}08` } : {}}>
                            {msg.from === "npc" && (
                              <div className="font-orbitron text-xs font-bold mb-1" style={{ color: ACCENT }}>
                                {selectedNPC.name}
                              </div>
                            )}
                            {msg.text}
                            {msg.tradeOffer && (
                              <div className="mt-2 pt-2 border-t border-border/30 font-mono text-xs" style={{ color: ACCENT }}>
                                💹 Đề nghị giao dịch: <strong>{msg.tradeOffer.item}</strong> — {msg.tradeOffer.price} gold
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {sendingChat && (
                        <div className="flex justify-start">
                          <div className="px-4 py-2 border font-mono text-xs" style={{ borderColor: `${ACCENT}50` }}>
                            <Loader2 className="w-3 h-3 animate-spin inline mr-1" style={{ color: ACCENT }} />
                            <span className="text-muted-foreground/40">{selectedNPC.name} đang trả lời...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 border-t border-border/30 flex gap-2">
                      <input
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder={`Nói chuyện với ${selectedNPC.name}...`}
                        disabled={sendingChat}
                        className="flex-1 bg-background border border-border/50 font-mono text-xs px-3 py-2 text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/50 disabled:opacity-50"
                      />
                      <Button size="sm" disabled={sendingChat || !chatInput.trim()} onClick={sendMessage}
                        className="rounded-none border" style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: `${ACCENT}10` }}>
                        {sendingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
