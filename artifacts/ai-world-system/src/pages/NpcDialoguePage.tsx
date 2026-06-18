import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Send, Loader2, User, Bot, Globe,
  Brain, Heart, Swords, AlertCircle, Star, Users,
  Shield, BookOpen, ChevronRight, ChevronDown, Sparkles,
  RefreshCw, History, X, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

/* ════════════════════════════════════════
   TYPES
════════════════════════════════════════ */
interface NpcListItem { id: string; name: string; occupation: string; age: number }

interface NpcContext {
  npc: { id: string; name: string; age: number; occupation: string; money: number; energy: number; worldSlug: string };
  personality: { kindness: number; greed: number; bravery: number; intelligence: number; curiosity: number } | null;
  emotion: { happiness: number; anger: number; fear: number; sadness: number; confidence: number; stress: number } | null;
  goals: Array<{ goalType: string; progress: number; targetValue: number; status: string }>;
  currentPlan: { steps: Array<{ actionType: string; target: string; completed: boolean }> } | null;
  relationshipWithPlayer: { score: number; type: string } | null;
  importantMemories: string[];
  faction: { name: string; type: string; role: string } | null;
  family: { spouseId: string | null; familyName: string | null } | null;
  politicalRole: string | null;
}

interface ChatMessage { role: "player" | "npc"; content: string; timestamp: string }

interface DialogueMemory {
  id: string; content: string; significance: string; createdAt: string;
}

interface DialogueResponse {
  npc_response: string;
  emotion_changes: Record<string, number>;
  memory_updates: string[];
  significance: string;
  generated_by: "gemini" | "rule-based";
}

/* ════════════════════════════════════════
   EMOTION META
════════════════════════════════════════ */
const EMOTIONS = [
  { key: "happiness",  label: "Hạnh Phúc",  icon: "😊", bar: "bg-yellow-400",  ring: "ring-yellow-400/40" },
  { key: "anger",      label: "Tức Giận",   icon: "😡", bar: "bg-red-500",     ring: "ring-red-500/40" },
  { key: "fear",       label: "Sợ Hãi",     icon: "😨", bar: "bg-purple-500",  ring: "ring-purple-500/40" },
  { key: "sadness",    label: "Buồn Bã",    icon: "😢", bar: "bg-blue-400",    ring: "ring-blue-400/40" },
  { key: "confidence", label: "Tự Tin",     icon: "💪", bar: "bg-emerald-400", ring: "ring-emerald-400/40" },
  { key: "stress",     label: "Căng Thẳng", icon: "😰", bar: "bg-orange-400",  ring: "ring-orange-400/40" },
] as const;

const SIGNIFICANCE_META: Record<string, { label: string; icon: string; color: string }> = {
  promise:  { label: "Lời Hứa",    icon: "🤝", color: "text-blue-400"   },
  insult:   { label: "Xúc Phạm",   icon: "💢", color: "text-red-400"    },
  threat:   { label: "Đe Dọa",     icon: "⚔️", color: "text-orange-400" },
  alliance: { label: "Liên Minh",  icon: "🛡️", color: "text-emerald-400"},
  secret:   { label: "Bí Mật",     icon: "🔒", color: "text-purple-400" },
  neutral:  { label: "Thường",     icon: "💬", color: "text-slate-400"  },
};

function relScoreColor(score: number) {
  if (score >= 51) return "text-emerald-400";
  if (score >= 21) return "text-blue-400";
  if (score >= -20) return "text-slate-400";
  if (score >= -60) return "text-orange-400";
  return "text-red-400";
}

function relScoreLabel(score: number) {
  if (score >= 76) return "Đồng Minh";
  if (score >= 51) return "Bạn Bè";
  if (score >= 21) return "Người Quen";
  if (score >= -20) return "Người Lạ";
  if (score >= -60) return "Đối Thủ";
  return "Kẻ Thù";
}

function dominantEmotion(emotion: NpcContext["emotion"]): string {
  if (!emotion) return "😐";
  const vals = EMOTIONS.map(e => ({ icon: e.icon, val: emotion[e.key as keyof typeof emotion] as number }));
  const top = vals.reduce((a, b) => a.val > b.val ? a : b);
  if (top.val < 40) return "😐";
  return top.icon;
}

/* ════════════════════════════════════════
   SUB-COMPONENTS
════════════════════════════════════════ */
function EmotionBar({ label, icon, value, barClass }: { label: string; icon: string; value: number; barClass: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1"><span>{icon}</span>{label}</span>
        <span className="text-slate-300 font-mono">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${barClass} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

function PersonalityDot({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct > 65 ? "bg-violet-400" : pct > 35 ? "bg-slate-500" : "bg-slate-700";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <div className="flex gap-0.5">
        {[20, 40, 60, 80, 100].map(threshold => (
          <div key={threshold} className={`w-2 h-2 rounded-full ${pct >= threshold ? color : "bg-slate-700"}`} />
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ msg, npcName }: { msg: ChatMessage; npcName: string }) {
  const isPlayer = msg.role === "player";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-2.5 ${isPlayer ? "flex-row-reverse" : "flex-row"}`}
    >
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
        isPlayer ? "bg-violet-600" : "bg-slate-600"
      }`}>
        {isPlayer ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`max-w-[78%] ${isPlayer ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        <span className="text-[10px] text-slate-500 px-1">{isPlayer ? "Người Chơi" : npcName}</span>
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isPlayer
            ? "bg-violet-600/80 text-white rounded-tr-sm"
            : "bg-slate-700/80 text-slate-100 rounded-tl-sm border border-slate-600/50"
        }`}>
          {msg.content}
        </div>
        <span className="text-[10px] text-slate-600 px-1">
          {new Date(msg.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════ */
export default function NpcDialoguePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [worldSlug, setWorldSlug] = useState("");
  const [worldInput, setWorldInput] = useState("");
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [showMemories, setShowMemories] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [flashEmotions, setFlashEmotions] = useState<Record<string, number>>({});

  // Scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Queries ── */
  const npcListQuery = useQuery<NpcListItem[]>({
    queryKey: ["npc-dialogue-list", worldSlug],
    queryFn: () => fetch(`/api/npc-dialogue/list/${worldSlug}`).then(r => r.json()),
    enabled: !!worldSlug,
  });

  const npcContextQuery = useQuery<NpcContext>({
    queryKey: ["npc-dialogue-context", selectedNpcId],
    queryFn: () => fetch(`/api/npc-dialogue/context/${selectedNpcId}`).then(r => r.json()),
    enabled: !!selectedNpcId,
    refetchInterval: 8000,
  });

  const historyQuery = useQuery<{ messages: ChatMessage[]; memories: DialogueMemory[] }>({
    queryKey: ["npc-dialogue-history", selectedNpcId],
    queryFn: () => fetch(`/api/npc-dialogue/history/${selectedNpcId}?player_id=guest`).then(r => r.json()),
    enabled: !!selectedNpcId,
  });

  // Load chat history when NPC selected
  useEffect(() => {
    if (historyQuery.data?.messages) {
      setMessages(historyQuery.data.messages);
    }
  }, [historyQuery.data]);

  /* ── Send message mutation ── */
  const sendMutation = useMutation<DialogueResponse, Error, string>({
    mutationFn: (playerMessage: string) =>
      fetch("/api/npc-dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npc_id: selectedNpcId, player_message: playerMessage, player_id: "guest" }),
      }).then(r => {
        if (!r.ok) throw new Error("Lỗi gửi tin nhắn");
        return r.json();
      }),
    onSuccess: (data) => {
      const npcMsg: ChatMessage = { role: "npc", content: data.npc_response, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, npcMsg]);

      // Flash emotion changes
      if (Object.keys(data.emotion_changes).length > 0) {
        setFlashEmotions(data.emotion_changes);
        setTimeout(() => setFlashEmotions({}), 2500);
        queryClient.invalidateQueries({ queryKey: ["npc-dialogue-context", selectedNpcId] });
      }
      if (data.memory_updates.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["npc-dialogue-history", selectedNpcId] });
        toast({ title: "💾 Ký ức mới", description: data.memory_updates[0], duration: 4000 });
      }
    },
    onError: () => toast({ title: "Lỗi", description: "Không thể gửi tin nhắn", variant: "destructive" }),
  });

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !selectedNpcId || sendMutation.isPending) return;
    const playerMsg: ChatMessage = { role: "player", content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, playerMsg]);
    setInputText("");
    sendMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleLoadWorld = () => {
    const slug = worldInput.trim();
    if (!slug) return;
    setWorldSlug(slug);
    setSelectedNpcId(null);
    setMessages([]);
  };

  const ctx = npcContextQuery.data;
  const memories = historyQuery.data?.memories ?? [];

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-slate-700/50 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <MessageCircle size={16} />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide">HỆ THỐNG ĐỐI THOẠI NPC</h1>
          <p className="text-[10px] text-slate-400">NPC Dialogue AI System</p>
        </div>
        {ctx && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-2xl">{dominantEmotion(ctx.emotion)}</span>
            <div className="text-right">
              <div className="font-semibold">{ctx.npc.name}</div>
              <div className="text-[10px] text-slate-400">{ctx.npc.occupation}</div>
            </div>
          </div>
        )}
      </div>

      {/* World selector */}
      {!worldSlug && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-4">
            <div className="text-center space-y-2 mb-6">
              <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center mx-auto">
                <Globe size={32} className="text-violet-400" />
              </div>
              <h2 className="text-lg font-bold">Chọn Thế Giới</h2>
              <p className="text-sm text-slate-400">Nhập world slug để bắt đầu hội thoại với NPC</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={worldInput}
                onChange={e => setWorldInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLoadWorld()}
                placeholder="vd: cyberpunk-city-abc1..."
                className="bg-slate-800 border-slate-600 text-slate-100"
              />
              <Button onClick={handleLoadWorld} className="bg-violet-600 hover:bg-violet-700 shrink-0">
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main layout */}
      {worldSlug && (
        <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

          {/* ── NPC List Sidebar ── */}
          <div className="w-48 shrink-0 bg-slate-800/50 border-r border-slate-700/50 flex flex-col">
            <div className="p-2.5 border-b border-slate-700/50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Nhân Vật</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setWorldSlug(""); setWorldInput(""); }}>
                  <X size={11} />
                </Button>
              </div>
              <p className="text-[9px] text-slate-500 font-mono truncate">{worldSlug}</p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {npcListQuery.isLoading && (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-violet-400" /></div>
              )}
              {npcListQuery.data?.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-8 px-3">Không có NPC nào trong thế giới này</p>
              )}
              {npcListQuery.data?.map(npc => (
                <button
                  key={npc.id}
                  onClick={() => { setSelectedNpcId(npc.id); setMessages([]); }}
                  className={`w-full text-left px-3 py-2 transition-colors hover:bg-slate-700/50 ${
                    selectedNpcId === npc.id ? "bg-violet-600/20 border-l-2 border-violet-500" : ""
                  }`}
                >
                  <div className="text-xs font-medium text-slate-200 truncate">{npc.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{npc.occupation} · {npc.age}t</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Chat Area ── */}
          {!selectedNpcId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto">
                  <Users size={28} className="text-slate-500" />
                </div>
                <p className="text-sm text-slate-500">Chọn một NPC để bắt đầu hội thoại</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {historyQuery.isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-violet-400" /></div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                    <div className="w-14 h-14 bg-slate-700/60 rounded-full flex items-center justify-center text-2xl">
                      {dominantEmotion(ctx?.emotion ?? null)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-300">{ctx?.npc.name}</p>
                      <p className="text-xs text-slate-500">{ctx?.npc.occupation} · {ctx?.npc.age} tuổi</p>
                    </div>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Bắt đầu hội thoại bằng cách nhập tin nhắn bên dưới. NPC sẽ phản hồi dựa trên tính cách, cảm xúc và quan hệ với bạn.
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => (
                      <ChatBubble key={i} msg={msg} npcName={ctx?.npc.name ?? "NPC"} />
                    ))}
                    {sendMutation.isPending && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center"><Bot size={14} /></div>
                        <div className="bg-slate-700/80 border border-slate-600/50 rounded-2xl rounded-tl-sm px-4 py-2.5">
                          <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                              <motion.div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                                animate={{ y: [0, -4, 0] }} transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.6 }} />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <div ref={chatBottomRef} />
                  </>
                )}
              </div>

              {/* Quick prompts */}
              <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
                {["Chào", "Ngươi cần gì?", "Ta muốn giao dịch", "Kể cho ta nghe", "Ta có thể giúp gì không?"].map(q => (
                  <button key={q} onClick={() => setInputText(q)}
                    className="text-[10px] px-2 py-1 rounded-full bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-slate-200 transition-colors border border-slate-600/40">
                    {q}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="px-4 pb-4">
                <div className="flex gap-2 bg-slate-800 border border-slate-600/60 rounded-xl p-1.5">
                  <input
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Nói chuyện với ${ctx?.npc.name ?? "NPC"}...`}
                    disabled={sendMutation.isPending}
                    className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none px-2"
                  />
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!inputText.trim() || sendMutation.isPending}
                    className="bg-violet-600 hover:bg-violet-700 h-8 w-8 p-0 rounded-lg"
                  >
                    {sendMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Info Sidebar ── */}
          {selectedNpcId && ctx && (
            <div className="w-64 shrink-0 bg-slate-800/50 border-l border-slate-700/50 flex flex-col overflow-y-auto">
              {/* Tabs */}
              <div className="flex border-b border-slate-700/50">
                {[
                  { id: "info", label: "Thông Tin", icon: <Info size={12} /> },
                  { id: "memories", label: "Ký Ức", icon: <History size={12} /> },
                ].map(tab => (
                  <button key={tab.id}
                    onClick={() => setShowMemories(tab.id === "memories")}
                    className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                      (showMemories ? "memories" : "info") === tab.id
                        ? "text-violet-400 border-b-2 border-violet-500"
                        : "text-slate-500 hover:text-slate-300"
                    }`}>
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>

              {/* Info tab */}
              {!showMemories && (
                <div className="p-3 space-y-4">
                  {/* NPC Profile */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-xl">
                      {dominantEmotion(ctx.emotion)}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{ctx.npc.name}</div>
                      <div className="text-[10px] text-slate-400">{ctx.npc.age} tuổi · {ctx.npc.occupation}</div>
                      {ctx.politicalRole && (
                        <div className="text-[10px] text-amber-400 flex items-center gap-0.5 mt-0.5">
                          <Shield size={9} /> {ctx.politicalRole}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Relationship */}
                  {ctx.relationshipWithPlayer && (
                    <div className="bg-slate-700/40 rounded-lg p-2.5 space-y-1.5">
                      <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <Heart size={10} /> QUAN HỆ VỚI NGƯỜI CHƠI
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${relScoreColor(ctx.relationshipWithPlayer.score)}`}>
                          {relScoreLabel(ctx.relationshipWithPlayer.score)}
                        </span>
                        <span className="text-xs font-mono text-slate-300">
                          {ctx.relationshipWithPlayer.score > 0 ? "+" : ""}{ctx.relationshipWithPlayer.score}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            ctx.relationshipWithPlayer.score >= 0 ? "bg-emerald-400" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.abs(ctx.relationshipWithPlayer.score)}%`, maxWidth: "100%" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Emotions */}
                  {ctx.emotion && (
                    <div className="bg-slate-700/40 rounded-lg p-2.5 space-y-1.5">
                      <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <Brain size={10} /> CẢM XÚC HIỆN TẠI
                      </div>
                      <div className="space-y-1.5">
                        {EMOTIONS.map(e => {
                          const val = ctx.emotion![e.key as keyof typeof ctx.emotion] as number;
                          const delta = flashEmotions[e.key];
                          return (
                            <div key={e.key} className={`relative ${delta ? "ring-1 " + e.ring + " rounded" : ""}`}>
                              <EmotionBar label={e.label} icon={e.icon} value={val} barClass={e.bar} />
                              {delta && (
                                <motion.span
                                  initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -12 }}
                                  transition={{ duration: 1.5 }}
                                  className={`absolute right-0 top-0 text-[10px] font-bold ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}
                                >
                                  {delta > 0 ? "+" : ""}{delta}
                                </motion.span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Personality */}
                  {ctx.personality && (
                    <div className="bg-slate-700/40 rounded-lg p-2.5 space-y-1.5">
                      <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <Sparkles size={10} /> TÍNH CÁCH
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { key: "kindness",     label: "Tốt Bụng" },
                          { key: "greed",        label: "Tham Lam" },
                          { key: "bravery",      label: "Dũng Cảm" },
                          { key: "intelligence", label: "Thông Minh" },
                          { key: "curiosity",    label: "Tò Mò" },
                        ].map(p => (
                          <PersonalityDot key={p.key} label={p.label} value={ctx.personality![p.key as keyof typeof ctx.personality] as number} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Goals */}
                  {ctx.goals.length > 0 && (
                    <div className="bg-slate-700/40 rounded-lg p-2.5 space-y-1.5">
                      <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <Star size={10} /> MỤC TIÊU
                      </div>
                      {ctx.goals.slice(0, 3).map((g, i) => (
                        <div key={i} className="space-y-0.5">
                          <div className="text-xs text-slate-300 truncate">{g.goalType}</div>
                          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, (g.progress / g.targetValue) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Faction */}
                  {ctx.faction && (
                    <div className="bg-slate-700/40 rounded-lg p-2.5">
                      <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                        <Users size={10} /> PHE PHÁI
                      </div>
                      <div className="text-xs text-slate-200">{ctx.faction.name}</div>
                      <div className="text-[10px] text-slate-400">{ctx.faction.role} · {ctx.faction.type}</div>
                    </div>
                  )}

                  {/* Important memories */}
                  {ctx.importantMemories.length > 0 && (
                    <div className="bg-slate-700/40 rounded-lg p-2.5 space-y-1.5">
                      <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <BookOpen size={10} /> KÝ ỨC QUAN TRỌNG
                      </div>
                      {ctx.importantMemories.slice(0, 3).map((m, i) => (
                        <p key={i} className="text-[10px] text-slate-400 leading-relaxed border-l border-slate-600 pl-2">{m}</p>
                      ))}
                    </div>
                  )}

                  {/* Refresh */}
                  <Button variant="ghost" size="sm" className="w-full text-[10px] text-slate-500 h-7"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["npc-dialogue-context", selectedNpcId] })}>
                    <RefreshCw size={10} className="mr-1" /> Làm mới trạng thái
                  </Button>
                </div>
              )}

              {/* Memories tab */}
              {showMemories && (
                <div className="p-3 space-y-2">
                  {memories.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <History size={24} className="text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-500">Chưa có ký ức hội thoại đặc biệt</p>
                      <p className="text-[10px] text-slate-600">Ký ức được tạo khi bạn hứa hẹn, đe dọa, hay đề nghị liên minh</p>
                    </div>
                  ) : (
                    memories.map(mem => {
                      const meta = SIGNIFICANCE_META[mem.significance] ?? SIGNIFICANCE_META.neutral;
                      return (
                        <div key={mem.id} className="bg-slate-700/40 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{meta.icon}</span>
                            <span className={`text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                            <span className="text-[10px] text-slate-600 ml-auto">
                              {new Date(mem.createdAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">{mem.content}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
