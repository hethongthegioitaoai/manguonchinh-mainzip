import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, User, Trash2, Loader2, AlertTriangle, CheckCircle2, Settings, Globe, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getWorld, type SystemName } from "@/lib/worlds";

interface Character {
  id: string;
  name: string;
  level: number;
  exp: number;
  stats: { system: SystemName; world_slug: string };
}

interface UserInfo {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  emailVerified?: boolean;
}

export default function SettingsPage() {
  const { user, loading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [fetching, setFetching] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ type: "ok" | "err"; text: string; devUrl?: string } | null>(null);

  async function handleResendVerification() {
    setResendLoading(true);
    setResendMsg(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setResendMsg({ type: "err", text: data.message ?? "Lỗi" });
      } else {
        setResendMsg({ type: "ok", text: data.message, devUrl: data.verifyUrl });
      }
    } catch {
      setResendMsg({ type: "err", text: "Không thể kết nối máy chủ" });
    } finally {
      setResendLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      setPwError("Vui lòng nhập đầy đủ"); return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError("Mật khẩu mới không khớp"); return;
    }
    if (pwForm.next.length < 6) {
      setPwError("Mật khẩu mới phải có ít nhất 6 ký tự"); return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.message ?? "Lỗi"); return; }
      setPwSuccess(data.message);
      setPwForm({ current: "", next: "", confirm: "" });
      setTimeout(() => setPwSuccess(null), 4000);
    } catch {
      setPwError("Không thể kết nối máy chủ");
    } finally {
      setPwLoading(false);
    }
  }

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/characters", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/auth/user", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([chars, info]) => {
        setCharacters(chars ?? []);
        setUserInfo(info);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  async function handleDeleteCharacter() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/characters/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Xoá nhân vật thất bại");
      setCharacters((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteSuccess(`Đã xoá "${deleteTarget.name}"`);
      setTimeout(() => setDeleteSuccess(null), 3000);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setDeleting(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName =
    userInfo?.firstName
      ? `${userInfo.firstName}${userInfo.lastName ? " " + userInfo.lastName : ""}`
      : userInfo?.email ?? "—";

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-64 pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse at 50% -20%, hsl(var(--primary)/0.12), transparent 65%)" }}
      />
      <div className="absolute inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(to right, hsl(var(--primary)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/dashboard")}
            className="rounded-none font-mono text-xs text-muted-foreground hover:text-primary border border-transparent hover:border-primary/30 transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> QUAY LẠI
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" strokeWidth={1.5} />
          <span className="font-orbitron text-sm tracking-widest text-primary">CÀI ĐẶT</span>
        </div>
        <div className="w-24" />
      </nav>

      <div className="relative z-10 max-w-2xl mx-auto px-4 md:px-8 py-10 space-y-8">

        <AnimatePresence>
          {deleteSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 border border-green-500/40 bg-green-500/10 px-4 py-3 font-mono text-sm text-green-400"
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {deleteSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-border/60 bg-card/50 backdrop-blur-md overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-border/40 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="font-orbitron text-sm tracking-widest text-primary">TÀI KHOẢN</span>
          </div>
          <div className="p-6 space-y-4">
            {fetching ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "TÊN", value: displayName },
                  { label: "EMAIL", value: userInfo?.email ?? "—" },
                  { label: "USER ID", value: userInfo?.id ? `#${userInfo.id.slice(0, 8)}...` : "—" },
                  { label: "TRẠNG THÁI", value: "ONLINE" },
                ].map(({ label, value }) => (
                  <div key={label} className="border border-border/40 bg-background/40 px-4 py-3">
                    <div className="font-mono text-xs text-muted-foreground/60 tracking-widest mb-1">{label}</div>
                    <div className="font-orbitron text-sm font-bold truncate">{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.section>

        {/* Email Verification Section */}
        {!fetching && userInfo && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`border backdrop-blur-md overflow-hidden ${
              userInfo.emailVerified
                ? "border-green-500/30 bg-green-950/20"
                : "border-yellow-500/30 bg-yellow-950/20"
            }`}
          >
            <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${userInfo.emailVerified ? "text-green-400" : "text-yellow-400"}`}
                  strokeWidth={1.5}
                />
                <span className="font-orbitron text-sm tracking-widest text-foreground">XÁC THỰC EMAIL</span>
              </div>
              <span
                className={`font-mono text-[10px] tracking-widest px-2 py-0.5 border ${
                  userInfo.emailVerified
                    ? "text-green-400 border-green-500/40 bg-green-500/10"
                    : "text-yellow-400 border-yellow-500/40 bg-yellow-500/10"
                }`}
              >
                {userInfo.emailVerified ? "ĐÃ XÁC THỰC" : "CHƯA XÁC THỰC"}
              </span>
            </div>
            <div className="p-6">
              {userInfo.emailVerified ? (
                <p className="font-mono text-xs text-green-400/70 leading-relaxed">
                  ✓ Email <strong>{userInfo.email}</strong> đã được xác thực. Tài khoản của bạn an toàn.
                </p>
              ) : (
                <div className="space-y-4">
                  <p className="font-mono text-xs text-yellow-300/70 leading-relaxed">
                    Email chưa được xác thực. Nhấn nút bên dưới để gửi lại email xác nhận đến{" "}
                    <strong>{userInfo.email}</strong>.
                  </p>

                  <AnimatePresence>
                    {resendMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={`px-3 py-2 border font-mono text-xs leading-relaxed ${
                          resendMsg.type === "ok"
                            ? "border-green-500/40 bg-green-900/20 text-green-300"
                            : "border-red-500/40 bg-red-900/20 text-red-300"
                        }`}
                      >
                        {resendMsg.text}
                        {resendMsg.devUrl && (
                          <div className="mt-2">
                            <a
                              href={resendMsg.devUrl}
                              className="text-cyan-400 underline break-all"
                            >
                              {resendMsg.devUrl}
                            </a>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    variant="ghost"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="rounded-none font-orbitron text-xs tracking-widest border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 transition-all"
                  >
                    {resendLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {resendLoading ? "ĐANG GỬI..." : "GỬI LẠI EMAIL XÁC THỰC"}
                  </Button>
                </div>
              )}
            </div>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-border/60 bg-card/50 backdrop-blur-md overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-border/40 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="font-orbitron text-sm tracking-widest text-primary">NHÂN VẬT CỦA NGƯƠI</span>
          </div>
          <div className="p-6 space-y-3">
            {fetching ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : characters.length === 0 ? (
              <div className="text-center py-8 font-mono text-xs text-muted-foreground/50">
                Chưa có nhân vật nào. Hãy tạo một nhân vật!
              </div>
            ) : (
              characters.map((char) => {
                const world = getWorld(char.stats.world_slug);
                const worldColor = world?.color ?? "hsl(var(--primary))";
                return (
                  <div
                    key={char.id}
                    className="border border-border/40 bg-background/30 px-4 py-3 flex items-center gap-4"
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center border flex-shrink-0 text-sm"
                      style={{ borderColor: `${worldColor}50`, backgroundColor: `${worldColor}15` }}
                    >
                      {world ? <world.icon className="w-4 h-4" style={{ color: worldColor }} strokeWidth={1.5} /> : "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-orbitron text-sm font-bold truncate">{char.name}</div>
                      <div className="font-mono text-xs text-muted-foreground/70 mt-0.5">
                        {world?.name} · Cấp {char.level} · {char.stats.system}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setDeleteTarget(char); setDeleteError(null); }}
                      className="rounded-none text-destructive/60 hover:text-destructive border border-transparent hover:border-destructive/30 transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })
            )}
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocation("/worlds")}
                className="rounded-none font-orbitron text-xs tracking-widest border-primary/40 text-primary hover:bg-primary/10 transition-all"
              >
                + TẠO NHÂN VẬT MỚI
              </Button>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="border border-border/60 bg-card/50 backdrop-blur-md overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-border/40 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="font-orbitron text-sm tracking-widest text-primary">ĐỔI MẬT KHẨU</span>
          </div>
          <div className="p-6">
            <AnimatePresence>
              {pwSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-3 border border-green-500/40 bg-green-500/10 px-4 py-3 font-mono text-sm text-green-400 mb-4"
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {pwSuccess}
                </motion.div>
              )}
            </AnimatePresence>

            {pwError && (
              <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono text-xs text-destructive mb-4">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {pwError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                { label: "MẬT KHẨU HIỆN TẠI", key: "current" as const, placeholder: "••••••••" },
                { label: "MẬT KHẨU MỚI", key: "next" as const, placeholder: "••••••••" },
                { label: "XÁC NHẬN MẬT KHẨU MỚI", key: "confirm" as const, placeholder: "••••••••" },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase">
                    {label}
                  </label>
                  <input
                    type="password"
                    value={pwForm[key]}
                    onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    disabled={pwLoading}
                    className="w-full bg-background/40 border border-border/50 focus:border-primary/50 px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/20 outline-none transition-colors disabled:opacity-50"
                  />
                </div>
              ))}
              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={pwLoading}
                  className="rounded-none font-orbitron text-xs tracking-widest border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                  variant="ghost"
                >
                  {pwLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {pwLoading ? "ĐANG XỬ LÝ..." : "CẬP NHẬT MẬT KHẨU"}
                </Button>
              </div>
            </form>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-destructive/30 bg-destructive/5 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-destructive/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive/70" strokeWidth={1.5} />
            <span className="font-orbitron text-sm tracking-widest text-destructive/70">VÙNG NGUY HIỂM</span>
          </div>
          <div className="p-6">
            <p className="font-mono text-xs text-muted-foreground mb-4">
              Đăng xuất khỏi hệ thống. Session sẽ bị huỷ hoàn toàn.
            </p>
            <Button
              variant="ghost"
              onClick={signOut}
              className="rounded-none font-orbitron text-xs tracking-widest border border-destructive/40 text-destructive hover:bg-destructive/10 transition-all"
            >
              DISCONNECT — ĐĂNG XUẤT
            </Button>
          </div>
        </motion.section>
      </div>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-card border border-destructive/40 p-8 max-w-sm w-full space-y-5"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
                <div className="font-orbitron text-lg font-bold text-destructive tracking-widest">XÁC NHẬN XOÁ</div>
              </div>
              <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                Xoá nhân vật{" "}
                <span className="text-foreground font-bold">"{deleteTarget.name}"</span>?
                Hành động này không thể hoàn tác. Toàn bộ lịch sử chiến đấu và nhiệm vụ sẽ bị xoá.
              </p>
              {deleteError && (
                <p className="font-mono text-xs text-destructive border border-destructive/30 bg-destructive/10 px-3 py-2">
                  {deleteError}
                </p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 rounded-none font-orbitron text-xs tracking-widest border-border"
                >
                  HUỶ
                </Button>
                <Button
                  disabled={deleting}
                  onClick={handleDeleteCharacter}
                  className="flex-1 rounded-none font-orbitron text-xs tracking-widest bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "XOÁ"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
