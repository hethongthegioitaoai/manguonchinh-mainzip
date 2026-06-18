import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
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
          transition={{ duration: 3 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 6 }}
        />
      ))}
    </div>
  );
}

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message: string; devToken?: string; resetUrl?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email) { setError("Vui lòng nhập email"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Lỗi"); return; }
      setResult(data);
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
            KHÔI PHỤC MẬT KHẨU
          </h1>
        </motion.div>

        <motion.div className="relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
          <div className="relative p-6" style={{ background: "linear-gradient(135deg,rgba(0,20,30,0.95),rgba(10,0,25,0.95))", border: "1px solid rgba(0,255,240,0.2)", boxShadow: "0 0 40px rgba(0,255,240,0.05)" }}>
            <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60" />
            <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60" />
            <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60" />
            <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60" />

            {!result ? (
              <>
                <p className="font-mono text-xs text-cyan-500/60 tracking-wider mb-5 leading-relaxed">
                  Nhập email đăng ký. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
                </p>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 px-3 py-2 border border-red-500/40 bg-red-900/20 font-mono text-xs text-red-400 tracking-wider">
                    ⚠ {error}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] tracking-[0.3em] text-cyan-500/60 uppercase">Email</label>
                    <div className="relative">
                      <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="email@example.com" disabled={loading}
                        className="w-full bg-transparent border border-cyan-500/30 focus:border-cyan-400/70 px-3 py-2.5 font-mono text-sm text-cyan-100 placeholder:text-cyan-500/20 outline-none transition-colors"
                        style={{ background: "rgba(0,255,240,0.03)" }}
                      />
                      <span className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400/60" />
                      <span className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-400/60" />
                      <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-400/60" />
                      <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-400/60" />
                    </div>
                  </div>

                  <motion.button
                    type="submit" disabled={loading}
                    className="relative mt-2 py-3 border font-orbitron text-sm tracking-[0.2em] font-bold disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,rgba(0,255,240,0.08),rgba(100,0,200,0.12))", borderColor: "rgba(0,255,240,0.4)", color: "#00fff0", textShadow: "0 0 10px rgba(0,255,240,0.8)" }}
                    whileHover={loading ? {} : { scale: 1.02 }} whileTap={loading ? {} : { scale: 0.97 }}
                  >
                    {loading ? "ĐANG GỬI..." : "GỬI LIÊN KẾT"}
                  </motion.button>
                </form>
              </>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                <div className="px-3 py-3 border border-cyan-500/40 bg-cyan-900/20 font-mono text-xs text-cyan-300 tracking-wider leading-relaxed">
                  ✓ {result.message}
                </div>

                {result.devToken && (
                  <div className="mt-2">
                    <p className="font-mono text-[10px] text-yellow-400/70 tracking-wider mb-2 uppercase">⚠ Chế độ phát triển — Token trực tiếp:</p>
                    <div className="px-3 py-2 border border-yellow-500/30 bg-yellow-900/10 font-mono text-[11px] text-yellow-300 break-all leading-relaxed">
                      {result.devToken}
                    </div>
                    <button
                      onClick={() => setLocation(`/reset-password?token=${result.devToken}`)}
                      className="mt-3 w-full py-2 border border-cyan-500/40 font-mono text-xs text-cyan-400 tracking-wider hover:bg-cyan-900/20 transition-colors"
                    >
                      → ĐẶT LẠI NGAY
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>

        <motion.button
          onClick={() => setLocation("/login")}
          className="mt-6 w-full font-mono text-xs text-cyan-500/40 hover:text-cyan-400 transition-colors tracking-widest text-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        >
          ← QUAY LẠI ĐĂNG NHẬP
        </motion.button>
      </div>
    </div>
  );
}
