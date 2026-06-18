import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

function getTokenFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 3 + 1, height: Math.random() * 3 + 1,
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            background: i % 3 === 0 ? "rgba(0,255,240,0.8)" : i % 3 === 1 ? "rgba(180,0,255,0.6)" : "rgba(255,50,80,0.5)",
          }}
          animate={{ y: [0, -60, 0], opacity: [0, 0.8, 0], scale: [0, 1, 0] }}
          transition={{ duration: 3 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 6 }}
        />
      ))}
    </div>
  );
}

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const token = getTokenFromUrl();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password || !confirm) { setError("Vui lòng nhập đầy đủ"); return; }
    if (password !== confirm) { setError("Mật khẩu xác nhận không khớp"); return; }
    if (password.length < 6) { setError("Mật khẩu phải có ít nhất 6 ký tự"); return; }
    if (!token) { setError("Token không hợp lệ"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Lỗi"); return; }
      setDone(true);
    } catch {
      setError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(0,60,80,0.5)_0%,rgba(20,0,40,0.6)_50%,#000_100%)]" />
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `linear-gradient(rgba(0,255,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,240,1) 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
      <motion.div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none" animate={{ top: ["0%", "100%"] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />
      <FloatingParticles />

      <div className="relative z-10 w-full max-w-sm px-4">
        <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="font-mono text-[10px] tracking-[0.5em] text-cyan-500/50 uppercase mb-2">◈ NEURAL_GATEWAY ◈</p>
          <h1 className="font-orbitron text-2xl font-black tracking-wider" style={{ background: "linear-gradient(135deg,#fff 0%,#00fff0 50%,#b000ff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            MẬT KHẨU MỚI
          </h1>
        </motion.div>

        <motion.div className="relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
          <div className="relative p-6" style={{ background: "linear-gradient(135deg,rgba(0,20,30,0.95),rgba(10,0,25,0.95))", border: "1px solid rgba(0,255,240,0.2)", boxShadow: "0 0 40px rgba(0,255,240,0.05)" }}>
            <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60" />
            <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60" />
            <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60" />
            <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60" />

            {!token && !done && (
              <div className="px-3 py-3 border border-red-500/40 bg-red-900/20 font-mono text-xs text-red-400 tracking-wider">
                ⚠ Token không hợp lệ. Vui lòng yêu cầu đặt lại mật khẩu mới.
              </div>
            )}

            {done ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 text-center">
                <div className="text-4xl">✓</div>
                <div className="px-3 py-3 border border-cyan-500/40 bg-cyan-900/20 font-mono text-xs text-cyan-300 tracking-wider">
                  Đặt lại mật khẩu thành công!
                </div>
                <motion.button
                  onClick={() => setLocation("/login")}
                  className="py-3 border font-orbitron text-sm tracking-[0.2em] font-bold"
                  style={{ background: "linear-gradient(135deg,rgba(0,255,240,0.08),rgba(100,0,200,0.12))", borderColor: "rgba(0,255,240,0.4)", color: "#00fff0" }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                >
                  ĐĂNG NHẬP NGAY
                </motion.button>
              </motion.div>
            ) : token ? (
              <>
                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 px-3 py-2 border border-red-500/40 bg-red-900/20 font-mono text-xs text-red-400 tracking-wider">
                    ⚠ {error}
                  </motion.div>
                )}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {[
                    { label: "Mật khẩu mới", val: password, set: setPassword },
                    { label: "Xác nhận mật khẩu", val: confirm, set: setConfirm },
                  ].map(({ label, val, set }) => (
                    <div key={label} className="flex flex-col gap-1">
                      <label className="font-mono text-[10px] tracking-[0.3em] text-cyan-500/60 uppercase">{label}</label>
                      <div className="relative">
                        <input
                          type="password" value={val} onChange={e => set(e.target.value)}
                          placeholder="••••••••" disabled={loading}
                          className="w-full bg-transparent border border-cyan-500/30 focus:border-cyan-400/70 px-3 py-2.5 font-mono text-sm text-cyan-100 placeholder:text-cyan-500/20 outline-none transition-colors"
                          style={{ background: "rgba(0,255,240,0.03)" }}
                        />
                        <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400/60" />
                        <span className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-400/60" />
                        <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-400/60" />
                        <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-400/60" />
                      </div>
                    </div>
                  ))}
                  <motion.button
                    type="submit" disabled={loading}
                    className="relative mt-2 py-3 border font-orbitron text-sm tracking-[0.2em] font-bold disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,rgba(0,255,240,0.08),rgba(100,0,200,0.12))", borderColor: "rgba(0,255,240,0.4)", color: "#00fff0", textShadow: "0 0 10px rgba(0,255,240,0.8)" }}
                    whileHover={loading ? {} : { scale: 1.02 }} whileTap={loading ? {} : { scale: 0.97 }}
                  >
                    {loading ? "ĐANG XỬ LÝ..." : "CẬP NHẬT MẬT KHẨU"}
                  </motion.button>
                </form>
              </>
            ) : null}
          </div>
        </motion.div>

        {!done && (
          <motion.button
            onClick={() => setLocation("/forgot-password")}
            className="mt-6 w-full font-mono text-xs text-cyan-500/40 hover:text-cyan-400 transition-colors tracking-widest text-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          >
            ← YÊU CẦU TOKEN MỚI
          </motion.button>
        )}
      </div>
    </div>
  );
}
