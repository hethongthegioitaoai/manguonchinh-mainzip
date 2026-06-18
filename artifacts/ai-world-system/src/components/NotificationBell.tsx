import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  icon: string;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}

export let refetchNotifications: (() => void) | null = null;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (res.ok) setNotifications(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refetchNotifications = fetchNotifications;
    return () => { refetchNotifications = null; };
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH", credentials: "include" });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }

  async function deleteNotif(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  async function clearAll() {
    await fetch("/api/notifications", { method: "DELETE", credentials: "include" });
    setNotifications([]);
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen(o => !o);
          if (!open) fetchNotifications();
        }}
        className="relative p-2 rounded-none border border-transparent hover:border-cyan-500/30 text-muted-foreground hover:text-cyan-400 transition-all"
        aria-label="Thông báo"
      >
        <Bell className="w-4 h-4" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center font-mono"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 z-50 border border-cyan-500/20 bg-black/95 backdrop-blur-sm shadow-2xl shadow-cyan-500/5"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/10">
              <span className="font-orbitron text-xs tracking-widest text-cyan-400">
                THÔNG BÁO
                {unreadCount > 0 && (
                  <span className="ml-2 text-red-400">({unreadCount} mới)</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="p-1 text-muted-foreground hover:text-cyan-400 transition-colors"
                    title="Đánh dấu tất cả đã đọc"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                    title="Xoá tất cả"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading && notifications.length === 0 && (
                <div className="py-6 text-center text-xs font-mono text-muted-foreground animate-pulse">
                  Đang tải...
                </div>
              )}
              {!loading && notifications.length === 0 && (
                <div className="py-8 text-center">
                  <div className="text-2xl mb-2">🔔</div>
                  <div className="text-xs font-mono text-muted-foreground">Chưa có thông báo</div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {notifications.map(n => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    onClick={() => !n.isRead && markRead(n.id)}
                    className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-white/5 cursor-default group transition-colors ${
                      n.isRead ? "opacity-50" : "hover:bg-cyan-500/5"
                    }`}
                  >
                    <span className="text-base mt-0.5 shrink-0">{n.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-semibold font-mono truncate ${n.isRead ? "text-muted-foreground" : "text-foreground"}`}>
                        {n.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {n.body}
                      </div>
                      <div className="text-[10px] text-muted-foreground/50 mt-1 font-mono">
                        {timeAgo(n.createdAt)}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteNotif(n.id); }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-red-400 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
