import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Send, Heart, Trash2, Globe, Zap, ChevronLeft, Loader2, Newspaper, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getWorld, WORLDS } from "@/lib/worlds";

interface Post {
  id: string;
  characterId: string;
  userId: string;
  worldSlug: string;
  authorName: string;
  authorSystem: string;
  authorLevel: number;
  content: string;
  postType: string;
  metadata: Record<string, unknown>;
  likes: number;
  likedByMe: boolean;
  createdAt: string;
}

interface Character {
  id: string;
  name: string;
  level: number;
  stats: { system: string; world_slug: string };
}

const POST_TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  manual:      { icon: "📝", label: "Ghi Chép",     color: "#a78bfa" },
  battle:      { icon: "⚔️", label: "Chiến Đấu",    color: "#f87171" },
  quest:       { icon: "📜", label: "Nhiệm Vụ",     color: "#facc15" },
  achievement: { icon: "🏅", label: "Thành Tựu",    color: "#fb923c" },
  dungeon:     { icon: "💀", label: "Ngục Tối",     color: "#c084fc" },
  levelup:     { icon: "⭐", label: "Thăng Cấp",    color: "#34d399" },
  pvp:         { icon: "🥊", label: "PvP",          color: "#38bdf8" },
  craft:       { icon: "🔨", label: "Chế Tạo",      color: "#f472b6" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  return `${day} ngày trước`;
}

export default function FeedPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [fetching, setFetching] = useState(true);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState("");
  const [filterWorld, setFilterWorld] = useState<string>("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/characters").then(r => r.json()).then((data: Character[]) => {
      setCharacters(data ?? []);
      if (data?.length) setActiveChar(data[0]);
    });
  }, [user]);

  const loadPosts = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    if (reset) setFetching(true); else setLoadingMore(true);
    try {
      const worldParam = filterWorld !== "all" ? `&world=${filterWorld}` : "";
      const r = await fetch(`/api/feed?limit=20&offset=${currentOffset}${worldParam}`);
      const data: Post[] = await r.json();
      if (reset) {
        setPosts(data);
        setOffset(20);
      } else {
        setPosts(prev => [...prev, ...data]);
        setOffset(currentOffset + 20);
      }
      setHasMore(data.length === 20);
    } finally {
      setFetching(false);
      setLoadingMore(false);
    }
  }, [filterWorld, offset]);

  useEffect(() => {
    if (!user) return;
    loadPosts(true);
  }, [user, filterWorld]);

  const handlePost = async () => {
    if (!draft.trim() || !activeChar) return;
    setPosting(true);
    try {
      const r = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: activeChar.id, content: draft.trim() }),
      });
      if (r.ok) {
        const newPost: Post = await r.json();
        setPosts(prev => [{ ...newPost, likedByMe: false }, ...prev]);
        setDraft("");
      }
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    const r = await fetch(`/api/feed/${postId}/like`, { method: "POST" });
    if (!r.ok) return;
    const { liked } = await r.json();
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, likes: p.likes + (liked ? 1 : -1), likedByMe: liked }
      : p
    ));
  };

  const handleDelete = async (postId: string) => {
    await fetch(`/api/feed/${postId}`, { method: "DELETE" });
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const worldColor = activeChar ? (getWorld(activeChar.stats.world_slug)?.color ?? "#22d3ee") : "#22d3ee";

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/30 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Newspaper className="w-5 h-5" style={{ color: worldColor }} strokeWidth={1.5} />
          <span className="font-orbitron text-sm font-bold tracking-widest" style={{ color: worldColor }}>
            DÒNG THỜI GIAN
          </span>
          <span className="font-mono text-xs text-muted-foreground ml-auto">
            {posts.length} bài
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Compose box */}
        {activeChar && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-border/60 bg-card/40 p-4 space-y-3"
            style={{ boxShadow: `inset 0 0 40px ${worldColor}06` }}
          >
            {/* Author selector */}
            {characters.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {characters.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveChar(c)}
                    className="font-mono text-xs border px-2 py-1 transition-all"
                    style={{
                      borderColor: activeChar?.id === c.id ? worldColor : "rgba(255,255,255,0.1)",
                      color: activeChar?.id === c.id ? worldColor : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {c.name} Lv.{c.level}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 flex items-center justify-center border flex-shrink-0 text-xs font-bold font-orbitron mt-1"
                style={{ borderColor: `${worldColor}50`, backgroundColor: `${worldColor}15`, color: worldColor }}
              >
                {activeChar.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-mono text-xs text-muted-foreground mb-1">
                  {activeChar.name} · Lv.{activeChar.level} · {activeChar.stats.system}
                </div>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePost(); }}
                  placeholder="Ghi lại khoảnh khắc hành trình... (Ctrl+Enter để đăng)"
                  maxLength={500}
                  rows={3}
                  className="w-full bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none border-b border-border/40 pb-2 leading-relaxed"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="font-mono text-xs text-muted-foreground/50">{draft.length}/500</span>
                  <Button
                    size="sm"
                    disabled={!draft.trim() || posting}
                    onClick={handlePost}
                    className="rounded-none font-orbitron text-xs tracking-widest border h-7 px-3"
                    style={{ borderColor: worldColor, background: `${worldColor}20`, color: worldColor }}
                  >
                    {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 mr-1" />ĐĂNG</>}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Filter world */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground/60" strokeWidth={1.5} />
          {[{ id: "all", name: "Tất Cả" }, ...WORLDS.map(w => ({ id: w.id, name: w.name }))].map(w => (
            <button
              key={w.id}
              onClick={() => setFilterWorld(w.id)}
              className="font-mono text-xs border px-2.5 py-1 transition-all"
              style={{
                borderColor: filterWorld === w.id ? worldColor : "rgba(255,255,255,0.1)",
                color: filterWorld === w.id ? worldColor : "rgba(255,255,255,0.35)",
                background: filterWorld === w.id ? `${worldColor}10` : "transparent",
              }}
            >
              {w.name}
            </button>
          ))}
        </div>

        {/* Feed */}
        {posts.length === 0 ? (
          <div className="text-center py-16 font-mono text-sm text-muted-foreground/40 space-y-2">
            <Newspaper className="w-10 h-10 mx-auto opacity-20" strokeWidth={1} />
            <p>Chưa có bài viết nào.</p>
            <p className="text-xs">Hãy là người đầu tiên ghi lại hành trình!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {posts.map((post, i) => {
              const typeMeta = POST_TYPE_META[post.postType] ?? POST_TYPE_META.manual;
              const postWorldColor = getWorld(post.worldSlug)?.color ?? "#22d3ee";
              const isOwn = post.userId === (user as any)?.id;

              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i < 5 ? i * 0.04 : 0 }}
                  className="border border-border/50 bg-card/30 p-4 space-y-3"
                  style={{ boxShadow: `inset 0 0 30px ${postWorldColor}04` }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 flex items-center justify-center border flex-shrink-0 text-xs font-bold font-orbitron"
                        style={{ borderColor: `${postWorldColor}50`, backgroundColor: `${postWorldColor}15`, color: postWorldColor }}
                      >
                        {post.authorName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-orbitron text-xs font-bold truncate" style={{ color: postWorldColor }}>
                          {post.authorName}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground/60 flex items-center gap-1.5 flex-wrap">
                          <span>Lv.{post.authorLevel}</span>
                          <span>·</span>
                          <span>{post.authorSystem.replace(" System", "").replace(" Hệ Thống", "")}</span>
                          <span>·</span>
                          <Globe className="w-3 h-3 inline" strokeWidth={1.5} />
                          <span>{getWorld(post.worldSlug)?.name ?? post.worldSlug}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="font-mono text-xs border px-1.5 py-0.5 flex items-center gap-1"
                        style={{ borderColor: `${typeMeta.color}40`, color: typeMeta.color, background: `${typeMeta.color}10` }}
                      >
                        {typeMeta.icon} {typeMeta.label}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <p className="font-mono text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/30">
                    <span className="font-mono text-xs text-muted-foreground/40">
                      {timeAgo(post.createdAt)}
                    </span>
                    <div className="flex items-center gap-3">
                      {isOwn && (
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="text-muted-foreground/30 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                      <button
                        onClick={() => handleLike(post.id)}
                        className="flex items-center gap-1.5 transition-all"
                        style={{ color: post.likedByMe ? "#f87171" : "rgba(255,255,255,0.3)" }}
                      >
                        <Heart className="w-3.5 h-3.5" strokeWidth={1.5} fill={post.likedByMe ? "currentColor" : "none"} />
                        <span className="font-mono text-xs">{post.likes}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Load more */}
        {hasMore && posts.length > 0 && (
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadPosts(false)}
              disabled={loadingMore}
              className="font-mono text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-none px-6"
            >
              {loadingMore ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
              TẢI THÊM
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
