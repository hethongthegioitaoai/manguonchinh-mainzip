import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Brain, Trash2, Loader2, ScrollText, Globe, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SYSTEM_ICONS, type SystemName } from "@/lib/worlds";

interface Memory {
  id: string;
  characterId: string;
  memoryType: string;
  content: string;
  importance: number;
  worldSlug: string | null;
  createdAt: string;
}

interface WorldMemory {
  id: string;
  worldSlug: string;
  eventType: string;
  content: string;
  happenedAt: string;
}

interface Character {
  id: string;
  name: string;
  level: number;
  stats: Record<string, any>;
}

const IMPORTANCE_COLOR = (n: number) => {
  if (n >= 8) return "text-red-400 border-red-500/40";
  if (n >= 5) return "text-orange-400 border-orange-500/40";
  if (n >= 3) return "text-cyan-400 border-cyan-500/40";
  return "text-muted-foreground border-border";
};

const WORLD_LABELS: Record<string, string> = {
  cultivation: "Tu Tiên",
  cyberpunk: "Cyberpunk",
  zombie: "Hoang Phế",
  wasteland: "Hoang Phế",
};

export default function MemoriesPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [chars, setChars] = useState<Character[]>([]);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [worldMemories, setWorldMemories] = useState<WorldMemory[]>([]);
  const [fetching, setFetching] = useState(false);
  const [activeTab, setActiveTab] = useState<"char" | "world">("char");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/characters", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: Character[]) => {
        setChars(data);
        if (data.length > 0) selectChar(data[0]);
      })
      .catch(() => {});
  }, [user]);

  async function selectChar(char: Character) {
    setSelectedChar(char);
    setFetching(true);
    try {
      const [memRes, worldRes] = await Promise.all([
        fetch(`/api/memories/${char.id}`, { credentials: "include" }),
        fetch(`/api/world-memories/${(char.stats as any)?.world_slug ?? "cultivation"}`, { credentials: "include" }),
      ]);
      setMemories(memRes.ok ? await memRes.json() : []);
      setWorldMemories(worldRes.ok ? await worldRes.json() : []);
    } catch {
      setMemories([]);
      setWorldMemories([]);
    } finally {
      setFetching(false);
    }
  }

  async function deleteMemory(memId: string) {
    if (!selectedChar) return;
    setDeleting(memId);
    try {
      await fetch(`/api/memories/${selectedChar.id}/${memId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setMemories(m => m.filter(x => x.id !== memId));
    } catch {}
    finally { setDeleting(null); }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setLocation("/dashboard")} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-orbitron text-lg font-bold tracking-widest text-primary flex items-center gap-2">
              <Brain className="w-5 h-5" /> KÝ ỨC HÀNH TRÌNH
            </h1>
            <p className="text-xs text-muted-foreground">Thế giới nhớ ngươi — mỗi hành động để lại dấu vết</p>
          </div>
        </div>

        {/* Character selector */}
        {chars.length > 1 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {chars.map(c => (
              <button
                key={c.id}
                onClick={() => selectChar(c)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  selectedChar?.id === c.id
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <span>{SYSTEM_ICONS[(c.stats as any)?.system as SystemName] ?? "⚡"}</span>
                <span>{c.name}</span>
                <span className="text-xs opacity-60">Lv.{c.level}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tab */}
        <div className="flex gap-1 mb-5 border border-border/50 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab("char")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-orbitron tracking-wider transition-colors ${
              activeTab === "char" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" /> KÝ ỨC CÁ NHÂN
          </button>
          <button
            onClick={() => setActiveTab("world")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-orbitron tracking-wider transition-colors ${
              activeTab === "world" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> LỊCH SỬ THẾ GIỚI
          </button>
        </div>

        {fetching ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : activeTab === "char" ? (
          memories.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Brain className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-orbitron text-sm tracking-wider">CHƯA CÓ KÝ ỨC</p>
              <p className="text-xs mt-1">Chơi AI Narrative để tạo ký ức đầu tiên</p>
              <button
                onClick={() => setLocation("/play")}
                className="mt-4 px-4 py-2 text-xs font-orbitron border border-primary/40 text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                ĐI KHÁM PHÁ →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-mono">{memories.length} ký ức được lưu — AI Game Master đang sử dụng để cá nhân hóa câu chuyện</p>
              {memories.map((mem, i) => (
                <motion.div
                  key={mem.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`border rounded-xl p-4 bg-card/40 ${IMPORTANCE_COLOR(mem.importance)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono opacity-60">
                          {new Date(mem.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                        {mem.worldSlug && (
                          <span className="text-xs border border-current/30 px-1.5 py-0.5 rounded opacity-60">
                            {WORLD_LABELS[mem.worldSlug] ?? mem.worldSlug}
                          </span>
                        )}
                        {mem.importance >= 5 && (
                          <span className="flex items-center gap-0.5 text-xs opacity-70">
                            <Star className="w-3 h-3" /> {mem.importance >= 8 ? "Quan trọng" : "Đáng nhớ"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed font-mono text-foreground/80">{mem.content}</p>
                    </div>
                    <button
                      onClick={() => deleteMemory(mem.id)}
                      disabled={deleting === mem.id}
                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-red-400 shrink-0"
                    >
                      {deleting === mem.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          worldMemories.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Globe className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-orbitron text-sm tracking-wider">LỊCH SỬ THẾ GIỚI TRỐNG</p>
              <p className="text-xs mt-1">Các sự kiện lớn sẽ được ghi nhận ở đây</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-mono">{worldMemories.length} sự kiện đã xảy ra trong thế giới này</p>
              {worldMemories.map((ev, i) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border border-border rounded-xl p-4 bg-card/40"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">
                      {new Date(ev.happenedAt).toLocaleDateString("vi-VN")} — {WORLD_LABELS[ev.worldSlug] ?? ev.worldSlug}
                    </span>
                  </div>
                  <p className="text-sm font-mono text-foreground/80 leading-relaxed">{ev.content}</p>
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
