import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ChevronLeft, Zap, RotateCcw, Loader2, Home, Bot, BookOpen, Sparkles, PenLine, List, SendHorizonal, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getWorld, SYSTEM_ICONS, type SystemName } from "@/lib/worlds";
import { getStartNode, getNode, SYSTEM_BONUSES, type StoryNode, type StoryChoice } from "@/lib/narrative";

interface Character {
  id: string;
  name: string;
  level: number;
  exp: number;
  stats: {
    system: SystemName;
    world_slug: string;
  };
}

interface HistoryEntry {
  node: StoryNode;
  chosen?: StoryChoice;
}

type PlayMode = "ai" | "static";
type InputMode = "choice" | "free";

const TAG_LABELS: Record<string, string> = {
  combat: "⚔ chiến đấu",
  wisdom: "☯ trí tuệ",
  trade: "💹 giao dịch",
  explore: "🗺 khám phá",
};

const SYSTEM_BONUS_MAP: Record<string, { tag: string; bonus: number }> = {
  "Kiếm Thần Hệ Thống": { tag: "combat", bonus: 10 },
  "Thương Nhân Hệ Thống": { tag: "trade", bonus: 15 },
  "Bất Tử Tu Tiên Hệ Thống": { tag: "wisdom", bonus: 12 },
  "Triệu Hồi Hệ Thống": { tag: "combat", bonus: 8 },
  "Luyện Đan Hệ Thống": { tag: "wisdom", bonus: 10 },
  "Ẩn Sát Hệ Thống": { tag: "explore", bonus: 12 },
  "Cơ Khí Hệ Thống": { tag: "explore", bonus: 10 },
  "Thần Thú Hệ Thống": { tag: "combat", bonus: 8 },
  "Tử Linh Hệ Thống": { tag: "combat", bonus: 9 },
};

export default function PlayPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [character, setCharacter] = useState<Character | null>(null);
  const [fetching, setFetching] = useState(true);
  const [mode, setMode] = useState<PlayMode>("ai");
  const [inputMode, setInputMode] = useState<InputMode>("choice");
  const [freeText, setFreeText] = useState("");
  const [currentNode, setCurrentNode] = useState<StoryNode | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [aiHistory, setAiHistory] = useState<string[]>([]);
  const [totalExp, setTotalExp] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [expFlash, setExpFlash] = useState<number | null>(null);
  const [typeText, setTypeText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const typeInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const freeInputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    loadCharacter();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [typeText, currentNode, aiLoading]);

  useEffect(() => {
    return () => { if (typeInterval.current) clearInterval(typeInterval.current); };
  }, []);

  async function loadCharacter() {
    try {
      const res = await fetch("/api/characters", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data: Character[] = await res.json();
      if (data.length > 0) {
        const char = data[0];
        setCharacter(char);
        setTotalExp(char.exp ?? 0);
        startAiSession(char);
      }
    } catch {
    } finally {
      setFetching(false);
    }
  }

  async function startAiSession(char: Character) {
    setMode("ai");
    setHistory([]);
    setAiHistory([]);
    setCurrentNode(null);
    setAiError(null);
    await fetchAiNode(char, null, []);
  }

  function startStaticSession(char: Character) {
    setMode("static");
    setHistory([]);
    setAiError(null);
    const start = getStartNode(char.stats?.world_slug ?? "");
    if (start) startTypewriter(start);
  }

  async function fetchAiNode(
    char: Character,
    choiceLabel: string | null,
    currentHistory: string[],
    freeInput?: string
  ) {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/narrative/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          characterId: char.id,
          choiceLabel,
          history: currentHistory,
          freeInput: freeInput ?? null,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.fallback) {
        setAiError("AI Game Master tạm thời không khả dụng — chuyển sang Chế Độ Lịch Sử.");
        setMode("static");
        const start = getStartNode(char.stats?.world_slug ?? "");
        if (start) startTypewriter(start);
        return;
      }

      startTypewriter(data as StoryNode);
    } catch {
      setAiError("Lỗi kết nối AI — chuyển sang Chế Độ Lịch Sử.");
      setMode("static");
      const start = getStartNode(char.stats?.world_slug ?? "");
      if (start) startTypewriter(start);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleFreeSubmit() {
    if (!character || !currentNode || isTyping || choosing || !freeText.trim() || aiLoading) return;
    const input = freeText.trim();
    setFreeText("");
    setChoosing(true);

    const gained = 25;
    const newHistory = [...history, { node: currentNode, chosen: { id: "free", label: input, nextNodeId: "ai_next", expGain: gained, tag: "explore" } as StoryChoice }];
    setHistory(newHistory);
    setTotalExp(e => e + gained);
    setExpFlash(gained);
    setTimeout(() => setExpFlash(null), 1500);

    fetch(`/api/characters/${character.id}/exp`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: gained }),
    }).catch(() => {});

    await new Promise(r => setTimeout(r, 300));
    setChoosing(false);

    const newAiHistory = [...aiHistory, `Người chơi hành động tự do: "${input}"`];
    setAiHistory(newAiHistory);
    await fetchAiNode(character, null, newAiHistory, input);
  }

  function startTypewriter(node: StoryNode) {
    setCurrentNode(node);
    setTypeText("");
    setIsTyping(true);
    if (typeInterval.current) clearInterval(typeInterval.current);
    const text = node.text;
    let i = 0;
    typeInterval.current = setInterval(() => {
      i++;
      setTypeText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typeInterval.current!);
        setIsTyping(false);
      }
    }, 16);
  }

  function skipTypewriter() {
    if (!currentNode || !isTyping) return;
    if (typeInterval.current) clearInterval(typeInterval.current);
    setTypeText(currentNode.text);
    setIsTyping(false);
  }

  async function handleChoice(choice: StoryChoice) {
    if (!character || !currentNode || isTyping || choosing) return;
    setChoosing(true);

    const sysBonus = SYSTEM_BONUS_MAP[character.stats.system];
    const bonus = sysBonus?.tag === choice.tag ? sysBonus.bonus : 0;
    const gained = choice.expGain + bonus;

    const newHistory = [...history, { node: currentNode, chosen: choice }];
    setHistory(newHistory);
    setTotalExp(e => e + gained);
    setExpFlash(gained);
    setTimeout(() => setExpFlash(null), 1500);

    fetch(`/api/characters/${character.id}/exp`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: gained }),
    }).catch(() => {});

    await new Promise(r => setTimeout(r, 300));
    setChoosing(false);

    if (mode === "ai") {
      const newAiHistory = [...aiHistory, `Người chơi chọn: "${choice.label}"`];
      setAiHistory(newAiHistory);
      await fetchAiNode(character, choice.label, newAiHistory);
    } else {
      const nextNode = getNode(character.stats.world_slug, choice.nextNodeId);
      if (nextNode) startTypewriter(nextNode);
    }
  }

  function restart() {
    if (!character) return;
    setTotalExp(character.exp ?? 0);
    startAiSession(character);
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-orbitron text-primary animate-pulse tracking-widest">ĐANG KHỞI ĐỘNG...</div>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4">
        <p className="font-mono text-muted-foreground">Chưa có nhân vật. Hãy tạo nhân vật trước.</p>
        <Button onClick={() => setLocation("/worlds")} className="rounded-none font-orbitron">CHỌN THẾ GIỚI</Button>
      </div>
    );
  }

  const worldSlug = character.stats.world_slug;
  const world = getWorld(worldSlug);
  const worldColor = world?.color ?? "hsl(var(--primary))";
  const systemIcon = SYSTEM_ICONS[character.stats.system] ?? "⚡";
  const systemBonus = SYSTEM_BONUSES[character.stats.system];
  const isEnding = (currentNode?.isEnding ?? false) && mode === "static";

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative flex flex-col">
      {/* Background */}
      <div
        className="absolute top-0 left-0 w-full h-64 pointer-events-none z-0"
        style={{ background: `radial-gradient(ellipse at 50% -10%, ${worldColor}20, transparent 60%)` }}
      />
      <div
        className="absolute inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(to right, ${worldColor} 1px, transparent 1px), linear-gradient(to bottom, ${worldColor} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 px-4 md:px-6 py-3 flex items-center justify-between border-b border-border/40 flex-shrink-0">
        <button
          onClick={() => setLocation("/dashboard")}
          className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> BẢNG ĐIỀU KHIỂN
        </button>
        <div className="flex items-center gap-2">
          {/* Input mode toggle — only in AI mode */}
          {mode === "ai" && (
            <div className="flex items-center rounded border border-border/50 overflow-hidden">
              <button
                onClick={() => setInputMode("choice")}
                title="Chế độ lựa chọn"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono transition-colors ${
                  inputMode === "choice"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="w-3 h-3" /> Chọn
              </button>
              <button
                onClick={() => { setInputMode("free"); setTimeout(() => freeInputRef.current?.focus(), 100); }}
                title="Chế độ tự do — gõ hành động tùy ý"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono transition-colors border-l border-border/50 ${
                  inputMode === "free"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <PenLine className="w-3 h-3" /> Tự Do
              </button>
            </div>
          )}

          {/* Play mode toggle */}
          <div className="flex items-center rounded border border-border/50 overflow-hidden">
            <button
              onClick={() => { character && startAiSession(character); setInputMode("choice"); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono transition-colors ${
                mode === "ai"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bot className="w-3 h-3" /> AI
            </button>
            <button
              onClick={() => character && startStaticSession(character)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono transition-colors border-l border-border/50 ${
                mode === "static"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="w-3 h-3" /> Lịch Sử
            </button>
          </div>

          <div className="relative">
            <div className="font-mono text-xs border border-border/50 px-3 py-1 flex items-center gap-2">
              <Zap className="w-3 h-3" style={{ color: worldColor }} />
              <span style={{ color: worldColor }}>{totalExp} EXP</span>
            </div>
            <AnimatePresence>
              {expFlash !== null && (
                <motion.div
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -24 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2 }}
                  className="absolute -top-6 left-1/2 -translate-x-1/2 font-orbitron text-xs font-bold whitespace-nowrap"
                  style={{ color: worldColor }}
                >
                  +{expFlash} EXP
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="font-mono text-xs border border-border/50 px-3 py-1 flex items-center gap-2">
            <span>{systemIcon}</span>
            <span className="text-muted-foreground">{character.name}</span>
          </div>
        </div>
      </nav>

      <div className="relative z-10 flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 md:px-6 py-6">

        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          {world && <world.icon className="w-5 h-5" style={{ color: worldColor }} strokeWidth={1.5} />}
          <div>
            <span className="font-orbitron text-sm font-bold tracking-wider" style={{ color: worldColor }}>
              {world?.name}
            </span>
            <span className="font-mono text-xs text-muted-foreground ml-3">{world?.title}</span>
          </div>
          {mode === "ai" && (
            <div className="flex items-center gap-1 ml-2 text-xs font-mono" style={{ color: worldColor }}>
              <Sparkles className="w-3 h-3" />
              <span className="opacity-70">AI Game Master</span>
            </div>
          )}
          {history.length > 0 && (
            <button
              onClick={restart}
              className="ml-auto font-mono text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Bắt Đầu Lại
            </button>
          )}
        </div>

        {/* AI error banner */}
        <AnimatePresence>
          {aiError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 border border-orange-500/40 bg-orange-500/10 px-4 py-2 font-mono text-xs text-orange-400 flex items-center gap-2"
            >
              <Bot className="w-3.5 h-3.5 shrink-0" />
              {aiError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* System bonus hint */}
        {systemBonus && history.length === 0 && !aiLoading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 border border-dashed px-4 py-2 font-mono text-xs text-muted-foreground flex items-center gap-2"
            style={{ borderColor: `${worldColor}50` }}
          >
            <span style={{ color: worldColor }}>{systemIcon}</span>
            {systemBonus}
          </motion.div>
        )}

        {/* History */}
        <div className="space-y-6 mb-6">
          {history.map((entry, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="opacity-40">
              <div className="font-mono text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {entry.node.text.replace(/\*([^*]+)\*/g, "$1")}
              </div>
              {entry.chosen && (
                <div className="mt-3 flex items-center gap-2 font-mono text-xs" style={{ color: worldColor }}>
                  <span className="border border-current px-2 py-0.5 opacity-60">▶ {entry.chosen.label}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* AI loading */}
        <AnimatePresence>
          {aiLoading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 gap-4"
            >
              <div className="relative">
                <motion.div
                  className="w-14 h-14 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: `${worldColor}40` }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <motion.div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: worldColor }}
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                </motion.div>
                <Bot className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: worldColor }} />
              </div>
              <div className="font-mono text-xs text-muted-foreground tracking-widest">
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  THIÊN ĐẠO ĐANG QUAN SÁT...
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current node */}
        <AnimatePresence mode="wait">
          {currentNode && !aiLoading && (
            <motion.div
              key={currentNode.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="flex-1"
            >
              {/* Story text */}
              <div
                className="relative border border-border/60 bg-card/50 backdrop-blur-sm p-6 mb-6 cursor-pointer"
                style={{ boxShadow: `0 0 40px ${worldColor}08` }}
                onClick={skipTypewriter}
              >
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: worldColor }} />
                <div className="absolute top-0 right-0 w-8 h-px" style={{ backgroundColor: worldColor }} />

                {/* AI badge */}
                {mode === "ai" && !isTyping && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-40">
                    <Sparkles className="w-3 h-3" style={{ color: worldColor }} />
                    <span className="font-mono text-[10px]" style={{ color: worldColor }}>AI</span>
                  </div>
                )}

                {isTyping && (
                  <motion.div
                    className="absolute left-0 right-0 h-px pointer-events-none opacity-30"
                    style={{ backgroundColor: worldColor }}
                    animate={{ top: ["10%", "90%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                )}

                <p className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {typeText.split(/(\*[^*]+\*)/).map((part, i) =>
                    part.startsWith("*") && part.endsWith("*")
                      ? <span key={i} style={{ color: worldColor }} className="font-semibold">{part.slice(1, -1)}</span>
                      : <span key={i}>{part}</span>
                  )}
                  {isTyping && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="inline-block w-2 h-4 ml-0.5 align-middle"
                      style={{ backgroundColor: worldColor }}
                    />
                  )}
                </p>

                {isTyping && (
                  <p className="font-mono text-xs text-muted-foreground/40 mt-3 text-right">[nhấn để bỏ qua]</p>
                )}
              </div>

              {/* Choices / Free Input */}
              {!isTyping && (
                <AnimatePresence mode="wait">
                  {isEnding ? (
                    <motion.div key="ending" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div
                        className="border font-mono text-xs px-4 py-2 text-center tracking-widest"
                        style={{ borderColor: `${worldColor}60`, color: worldColor }}
                      >
                        ✦ CHƯƠNG NÀY KẾT THÚC ✦
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={restart}
                          variant="outline"
                          className="rounded-none font-orbitron text-xs tracking-widest border-border hover:border-primary/50"
                        >
                          <RotateCcw className="w-3 h-3 mr-2" /> CHƠI LẠI
                        </Button>
                        <Button
                          onClick={() => setLocation("/dashboard")}
                          className="rounded-none font-orbitron text-xs tracking-widest border"
                          style={{ borderColor: worldColor, background: `${worldColor}15`, color: worldColor }}
                        >
                          <Home className="w-3 h-3 mr-2" /> VỀ BẢNG ĐIỀU KHIỂN
                        </Button>
                      </div>
                    </motion.div>
                  ) : mode === "ai" && inputMode === "free" ? (
                    /* ── FREE EXPLORATION INPUT ── */
                    <motion.div
                      key="free-input"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="space-y-3"
                    >
                      <p className="font-mono text-xs text-muted-foreground tracking-widest">
                        — NHẬP HÀNH ĐỘNG TỰ DO —
                      </p>
                      <div
                        className="border bg-card/30 focus-within:border-opacity-80 transition-all"
                        style={{ borderColor: `${worldColor}40` }}
                      >
                        <textarea
                          ref={freeInputRef}
                          value={freeText}
                          onChange={e => setFreeText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleFreeSubmit(); }
                          }}
                          placeholder={`Ngươi muốn làm gì? (Enter để gửi)\nVí dụ: "Tôi muốn vào khu rừng phía Bắc" hoặc "Luyện kiếm đến tận đêm khuya"`}
                          rows={3}
                          disabled={choosing || aiLoading}
                          className="w-full bg-transparent px-4 py-3 font-mono text-sm text-foreground/90 placeholder:text-muted-foreground/30 resize-none outline-none disabled:opacity-50"
                          style={{ caretColor: worldColor }}
                        />
                        <div className="flex items-center justify-between px-4 py-2 border-t border-border/20">
                          <span className="font-mono text-xs text-muted-foreground/40">
                            {freeText.length}/200 ký tự · +25 EXP khi gửi
                          </span>
                          <button
                            onClick={handleFreeSubmit}
                            disabled={!freeText.trim() || choosing || aiLoading}
                            className="flex items-center gap-2 px-4 py-1.5 font-orbitron text-xs font-bold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
                            style={{ color: worldColor, borderColor: worldColor, border: "1px solid" }}
                          >
                            <SendHorizonal className="w-3.5 h-3.5" /> GỬI
                          </button>
                        </div>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground/30 flex items-center gap-1">
                        <PenLine className="w-3 h-3" /> AI Game Master sẽ phản hồi theo hành động của ngươi
                      </p>
                    </motion.div>
                  ) : (
                    /* ── CHOICE BUTTONS ── */
                    <motion.div
                      key="choices"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="space-y-3"
                    >
                      <p className="font-mono text-xs text-muted-foreground tracking-widest mb-4">
                        — CHỌN HÀNH ĐỘNG CỦA NGƯƠI —
                      </p>
                      {currentNode.choices.map((choice, i) => {
                        const sysBonus = SYSTEM_BONUS_MAP[character.stats.system];
                        const hasBonus = sysBonus?.tag === choice.tag;
                        return (
                          <motion.button
                            key={choice.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            disabled={choosing || aiLoading}
                            onClick={() => handleChoice(choice)}
                            className="w-full text-left group border border-border/60 bg-card/30 hover:bg-card/60 px-5 py-4 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                            whileHover={{ borderColor: worldColor }}
                          >
                            <div
                              className="absolute left-0 top-0 h-full w-0 group-hover:w-1 transition-all duration-200"
                              style={{ backgroundColor: worldColor }}
                            />
                            <div className="flex items-start gap-4 pl-2">
                              <span
                                className="font-orbitron text-xs font-bold mt-0.5 flex-shrink-0"
                                style={{ color: worldColor }}
                              >
                                {String.fromCharCode(65 + i)}.
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="font-mono text-sm text-foreground/90 group-hover:text-foreground transition-colors leading-relaxed">
                                  {choice.label}
                                </span>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="font-mono text-xs text-muted-foreground/50">
                                    +{choice.expGain} EXP
                                    {hasBonus && (
                                      <span style={{ color: worldColor }}> +{sysBonus.bonus} hệ thống</span>
                                    )}
                                  </span>
                                  {choice.tag && (
                                    <span className="font-mono text-xs border border-border/30 px-1.5 py-px text-muted-foreground/40">
                                      {TAG_LABELS[choice.tag] ?? choice.tag}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
