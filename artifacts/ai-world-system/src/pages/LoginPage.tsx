import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, useAnimationFrame } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

function useSearchParam(key: string) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

function HologramOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    angleRef.current += 0.008;
    const t = angleRef.current;
    const cx = W / 2, cy = H / 2, r = W * 0.38;
    for (let i = 3; i >= 0; i--) {
      const grad = ctx.createRadialGradient(cx, cy, r - 4, cx, cy, r + 6 + i * 10);
      grad.addColorStop(0, `rgba(0,255,240,${0.18 - i * 0.04})`);
      grad.addColorStop(1, "rgba(0,255,240,0)");
      ctx.beginPath(); ctx.arc(cx, cy, r + 6 + i * 10, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();
    }
    const arcCount = 4;
    for (let a = 0; a < arcCount; a++) {
      const offset = (a / arcCount) * Math.PI * 2;
      const start = t + offset, end = start + Math.PI * 1.1;
      ctx.beginPath(); ctx.arc(cx, cy, r, start, end);
      ctx.strokeStyle = `rgba(0,255,240,${0.5 + 0.4 * Math.sin(t * 2 + a)})`;
      ctx.lineWidth = 1.5; ctx.stroke();
    }
    const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.85);
    innerGrad.addColorStop(0, "rgba(0,255,240,0.07)");
    innerGrad.addColorStop(0.6, "rgba(80,0,200,0.04)");
    innerGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = innerGrad; ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2); ctx.clip();
    const scanY = ((t * 60) % (r * 2)) - r;
    for (let i = -5; i <= 5; i++) {
      const y = cy + scanY + i * 22;
      ctx.beginPath(); ctx.moveTo(cx - r, y); ctx.lineTo(cx + r, y);
      ctx.strokeStyle = `rgba(0,255,240,${0.04 + 0.02 * Math.abs(Math.sin(i))})`;
      ctx.lineWidth = 1; ctx.stroke();
    }
    const brightY = cy + scanY;
    const scanGrad = ctx.createLinearGradient(cx - r, brightY, cx + r, brightY);
    scanGrad.addColorStop(0, "rgba(0,255,240,0)");
    scanGrad.addColorStop(0.5, "rgba(0,255,240,0.3)");
    scanGrad.addColorStop(1, "rgba(0,255,240,0)");
    ctx.beginPath(); ctx.moveTo(cx - r, brightY); ctx.lineTo(cx + r, brightY);
    ctx.strokeStyle = scanGrad; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    const dotCount = 6;
    for (let d = 0; d < dotCount; d++) {
      const dotAngle = t * 1.4 + (d / dotCount) * Math.PI * 2;
      const dotR = r + 18;
      const dx = cx + Math.cos(dotAngle) * dotR;
      const dy = cy + Math.sin(dotAngle) * dotR * 0.35;
      const alpha = 0.3 + 0.7 * ((Math.sin(dotAngle) + 1) / 2);
      ctx.beginPath(); ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,255,240,${alpha})`; ctx.fill();
    }
    const dotGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
    dotGrad.addColorStop(0, "rgba(0,255,240,1)");
    dotGrad.addColorStop(1, "rgba(0,255,240,0)");
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = dotGrad; ctx.fill();
  });

  return <canvas ref={canvasRef} width={220} height={220} className="pointer-events-none" />;
}

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 ? "rgba(0,255,240,0.8)" : i % 3 === 1 ? "rgba(180,0,255,0.6)" : "rgba(255,50,80,0.5)",
          }}
          animate={{ y: [0, -60 - Math.random() * 80, 0], opacity: [0, 0.8, 0], scale: [0, 1, 0] }}
          transition={{ duration: 3 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 6, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function InputField({
  label, type = "text", value, onChange, placeholder, disabled
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[10px] tracking-[0.3em] text-cyan-500/60 uppercase">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent border border-cyan-500/30 focus:border-cyan-400/70 px-3 py-2.5 font-mono text-sm text-cyan-100 placeholder:text-cyan-500/20 outline-none transition-colors disabled:opacity-50"
          style={{ background: "rgba(0,255,240,0.03)" }}
        />
        <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400/60" />
        <span className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-400/60" />
        <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-400/60" />
        <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-400/60" />
      </div>
    </div>
  );
}

function WorldTransitionOverlay({ username }: { username: string }) {
  const steps = [
    "KHỞI TẠO THẦN KINH KẾT NỐI...",
    "XÁC THỰC DANH TÍNH CHIẾN BINH...",
    "TẢI DỮ LIỆU THẾ GIỚI SONG SONG...",
    "MỞ CỔNG VÀO HƯ VÔ...",
  ];
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        const next = p + 1.4;
        if (next >= 100) { clearInterval(interval); return 100; }
        return next;
      });
    }, 28);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 480);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ background: "radial-gradient(ellipse 90% 80% at 50% 50%, rgba(0,30,40,0.98) 0%, rgba(5,0,15,1) 60%, #000 100%)" }}
    >
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "linear-gradient(rgba(0,255,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,240,1) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Scanning line */}
      <motion.div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(0,255,240,0.6) 30%, rgba(180,0,255,0.8) 50%, rgba(0,255,240,0.6) 70%, transparent 100%)" }}
        animate={{ top: ["0%", "100%", "0%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      />

      {/* Glowing circle */}
      <div className="relative flex items-center justify-center mb-10">
        <motion.div
          className="absolute rounded-full"
          style={{ width: 180, height: 180, background: "radial-gradient(circle, rgba(0,255,240,0.12) 0%, rgba(100,0,200,0.08) 60%, transparent 100%)" }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-cyan-400/30"
            style={{ width: 80 + i * 50, height: 80 + i * 50 }}
            animate={{ rotate: 360 * (i % 2 === 0 ? 1 : -1), opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 2 + i * 0.7, repeat: Infinity, ease: "linear" }}
          />
        ))}
        <motion.div
          className="w-16 h-16 rounded-full flex items-center justify-center border border-cyan-400/50"
          style={{ background: "radial-gradient(circle, rgba(0,255,240,0.2), rgba(100,0,200,0.1))", boxShadow: "0 0 30px rgba(0,255,240,0.4)" }}
          animate={{ boxShadow: ["0 0 20px rgba(0,255,240,0.3)", "0 0 50px rgba(0,255,240,0.8)", "0 0 20px rgba(0,255,240,0.3)"] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <motion.span
            className="text-2xl"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >⚡</motion.span>
        </motion.div>
      </div>

      {/* Username greeting */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <p className="font-mono text-[10px] tracking-[0.4em] text-cyan-500/50 uppercase mb-1">CHIẾN BINH ĐÃ ĐƯỢC NHẬN DIỆN</p>
        <motion.h2
          className="font-orbitron text-2xl font-black tracking-wider"
          style={{ background: "linear-gradient(135deg, #00fff0 0%, #b000ff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 16px rgba(0,255,240,0.5))" }}
          animate={{ filter: ["drop-shadow(0 0 10px rgba(0,255,240,0.4))", "drop-shadow(0 0 24px rgba(0,255,240,0.9))", "drop-shadow(0 0 10px rgba(0,255,240,0.4))"] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {username.toUpperCase()}
        </motion.h2>
      </motion.div>

      {/* Status message */}
      <div className="h-5 mb-6">
        <motion.p
          key={step}
          className="font-mono text-[11px] tracking-[0.25em] text-cyan-400/70 uppercase text-center"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {steps[step]}
        </motion.p>
      </div>

      {/* Progress bar */}
      <div className="w-72 relative">
        <div className="w-full h-px bg-cyan-500/15 mb-1" />
        <div className="w-full h-[3px] relative overflow-hidden" style={{ background: "rgba(0,255,240,0.08)", border: "1px solid rgba(0,255,240,0.15)" }}>
          <motion.div
            className="h-full"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, rgba(0,255,240,0.6), rgba(180,0,255,0.8))", boxShadow: "0 0 10px rgba(0,255,240,0.5)" }}
          />
          <motion.div
            className="absolute top-0 bottom-0 w-6"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)", left: `${Math.max(0, progress - 8)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="font-mono text-[9px] text-cyan-500/30 tracking-widest">LOADING</span>
          <span className="font-mono text-[9px] text-cyan-400/60 tracking-widest">{Math.round(progress)}%</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const authError = useSearchParam("error");

  const [tab, setTab] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ login: "", password: "" });
  const [regForm, setRegForm] = useState({ username: "", email: "", password: "", confirmPassword: "", firstName: "" });

  useEffect(() => {
    if (!loading && user && !transitioning) setLocation("/worlds");
  }, [user, loading, setLocation, transitioning]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!loginForm.login || !loginForm.password) {
      setError("Vui lòng nhập đầy đủ thông tin"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ login: loginForm.login, password: loginForm.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Đăng nhập thất bại"); return; }
      queryClient.setQueryData(["/api/auth/user"], {
        id: data.id,
        email: data.email,
        username: data.username,
        firstName: data.firstName,
        emailVerified: data.emailVerified ?? false,
      });
      setTransitioning(data.username ?? data.firstName ?? loginForm.login);
      setTimeout(() => setLocation("/worlds"), 2200);
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!regForm.username || !regForm.email || !regForm.password) {
      setError("Vui lòng nhập đầy đủ thông tin"); return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp"); return;
    }
    if (regForm.password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: regForm.username,
          email: regForm.email,
          password: regForm.password,
          firstName: regForm.firstName || regForm.username,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Đăng ký thất bại"); return; }
      queryClient.setQueryData(["/api/auth/user"], {
        id: data.id,
        email: data.email,
        username: data.username,
        firstName: data.firstName,
        emailVerified: data.emailVerified ?? false,
      });
      setTransitioning(data.username ?? regForm.username);
      setTimeout(() => setLocation("/worlds"), 2200);
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-black">
      {transitioning && <WorldTransitionOverlay username={transitioning} />}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(0,60,80,0.5)_0%,rgba(20,0,40,0.6)_50%,#000_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,255,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,240,1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none"
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      <FloatingParticles />

      <div className="relative z-10 w-full max-w-md px-4 flex flex-col items-center gap-6">
        {/* Title */}
        <motion.div className="text-center" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <motion.p
            className="font-mono text-[10px] tracking-[0.5em] text-cyan-500/60 uppercase mb-2"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            ◈ NEURAL_GATEWAY v4.0.1 ◈
          </motion.p>
          <h1
            className="font-orbitron text-3xl md:text-4xl font-black tracking-wider"
            style={{
              background: "linear-gradient(135deg, #fff 0%, #00fff0 40%, #b000ff 80%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 20px rgba(0,255,240,0.4))",
            }}
          >
            AI WORLD SYSTEM
          </h1>
        </motion.div>

        {/* Orb */}
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }}>
          <HologramOrb />
        </motion.div>

        {/* Auth card */}
        <motion.div
          className="w-full relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {/* Card border */}
          <div
            className="relative p-6"
            style={{
              background: "linear-gradient(135deg, rgba(0,20,30,0.95) 0%, rgba(10,0,25,0.95) 100%)",
              border: "1px solid rgba(0,255,240,0.2)",
              boxShadow: "0 0 40px rgba(0,255,240,0.06), inset 0 0 40px rgba(0,0,0,0.5)",
            }}
          >
            <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60" />
            <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60" />
            <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60" />
            <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60" />

            {/* Tabs */}
            <div className="flex mb-6 border-b border-cyan-500/20">
              {(["login", "register"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(null); setSuccess(null); }}
                  className="flex-1 py-2 font-mono text-xs tracking-[0.2em] uppercase transition-all"
                  style={{
                    color: tab === t ? "#00fff0" : "rgba(0,255,240,0.3)",
                    borderBottom: tab === t ? "2px solid #00fff0" : "2px solid transparent",
                    textShadow: tab === t ? "0 0 10px rgba(0,255,240,0.8)" : "none",
                  }}
                >
                  {t === "login" ? "ĐĂNG NHẬP" : "ĐĂNG KÝ"}
                </button>
              ))}
            </div>

            {/* Error / success banners */}
            {(authError || error) && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 px-3 py-2 border border-red-500/40 bg-red-900/20 font-mono text-xs text-red-400 tracking-wider"
              >
                ⚠ {error ?? decodeURIComponent(authError!)}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 px-3 py-2 border border-cyan-500/40 bg-cyan-900/20 font-mono text-xs text-cyan-400 tracking-wider"
              >
                ✓ {success}
              </motion.div>
            )}

            {/* Login form */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <InputField
                  label="Tên đăng nhập / Email"
                  value={loginForm.login}
                  onChange={v => setLoginForm(f => ({ ...f, login: v }))}
                  placeholder="username hoặc email@..."
                  disabled={submitting}
                />
                <InputField
                  label="Mật khẩu"
                  type="password"
                  value={loginForm.password}
                  onChange={v => setLoginForm(f => ({ ...f, password: v }))}
                  placeholder="••••••••"
                  disabled={submitting}
                />
                <SubmitButton loading={submitting} label="ĐĂNG NHẬP" />
                <div className="text-center">
                  <a
                    href="/forgot-password"
                    className="font-mono text-[10px] text-cyan-500/40 hover:text-cyan-400 transition-colors tracking-widest"
                  >
                    Quên mật khẩu?
                  </a>
                </div>
              </form>
            )}

            {/* Register form */}
            {tab === "register" && (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <InputField
                  label="Tên hiệu (username)"
                  value={regForm.username}
                  onChange={v => setRegForm(f => ({ ...f, username: v }))}
                  placeholder="kiemthan99"
                  disabled={submitting}
                />
                <InputField
                  label="Tên nhân vật"
                  value={regForm.firstName}
                  onChange={v => setRegForm(f => ({ ...f, firstName: v }))}
                  placeholder="Kiếm Thần Vô Danh"
                  disabled={submitting}
                />
                <InputField
                  label="Email"
                  type="email"
                  value={regForm.email}
                  onChange={v => setRegForm(f => ({ ...f, email: v }))}
                  placeholder="email@example.com"
                  disabled={submitting}
                />
                <InputField
                  label="Mật khẩu"
                  type="password"
                  value={regForm.password}
                  onChange={v => setRegForm(f => ({ ...f, password: v }))}
                  placeholder="ít nhất 6 ký tự"
                  disabled={submitting}
                />
                <InputField
                  label="Xác nhận mật khẩu"
                  type="password"
                  value={regForm.confirmPassword}
                  onChange={v => setRegForm(f => ({ ...f, confirmPassword: v }))}
                  placeholder="nhập lại mật khẩu"
                  disabled={submitting}
                />
                <SubmitButton loading={submitting} label="TẠO TÀI KHOẢN" />
              </form>
            )}
          </div>
        </motion.div>

        {/* Bottom status */}
        <motion.div
          className="flex gap-8 font-mono text-[10px] text-cyan-500/30 tracking-widest"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
        >
          {["SYS_ONLINE", "DB_LINKED", "AI_READY"].map(label => (
            <div key={label} className="flex items-center gap-1.5">
              <motion.span
                className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400"
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: Math.random() }}
              />
              {label}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      className="relative group mt-2 cursor-pointer select-none disabled:opacity-60 disabled:cursor-not-allowed"
      whileHover={loading ? {} : { scale: 1.02 }}
      whileTap={loading ? {} : { scale: 0.97 }}
    >
      <motion.div
        className="absolute -inset-1 rounded-sm"
        style={{ background: "linear-gradient(135deg, rgba(0,255,240,0.25), rgba(180,0,255,0.25))", filter: "blur(8px)" }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <div
        className="relative py-3 border flex items-center justify-center gap-3"
        style={{
          background: "linear-gradient(135deg, rgba(0,255,240,0.08), rgba(100,0,200,0.12))",
          borderColor: "rgba(0,255,240,0.4)",
          boxShadow: "0 0 16px rgba(0,255,240,0.15), inset 0 0 16px rgba(0,255,240,0.04)",
        }}
      >
        <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400" />
        <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-400" />
        <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400" />
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400" />

        {loading ? (
          <motion.div
            className="w-4 h-4 rounded-full border-2 border-cyan-400/40 border-t-cyan-400"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        ) : null}
        <span className="font-orbitron text-sm tracking-[0.2em] font-bold" style={{ color: "#00fff0", textShadow: "0 0 10px rgba(0,255,240,0.8)" }}>
          {loading ? "ĐANG XỬ LÝ..." : label}
        </span>
      </div>
    </motion.button>
  );
}
