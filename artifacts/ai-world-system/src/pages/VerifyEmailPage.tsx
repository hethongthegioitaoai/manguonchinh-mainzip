import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

function getTokenFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const token = getTokenFromUrl();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token không hợp lệ.");
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.message?.includes("thành công") || data.message?.includes("trước đó")) {
          setStatus("success");
        } else {
          setStatus("error");
        }
        setMessage(data.message ?? "Lỗi không xác định");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Không thể kết nối máy chủ");
      });
  }, [token]);

  const isSuccess = status === "success";

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(0,60,80,0.5)_0%,rgba(20,0,40,0.6)_50%,#000_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,255,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,240,1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm px-4">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="font-mono text-[10px] tracking-[0.5em] text-cyan-500/50 uppercase mb-2">◈ NEURAL_GATEWAY ◈</p>
          <h1
            className="font-orbitron text-2xl font-black tracking-wider"
            style={{
              background: "linear-gradient(135deg,#fff 0%,#00fff0 50%,#b000ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            XÁC THỰC EMAIL
          </h1>
        </motion.div>

        <motion.div
          className="relative p-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          style={{
            background: "linear-gradient(135deg,rgba(0,20,30,0.95),rgba(10,0,25,0.95))",
            border: `1px solid ${isSuccess ? "rgba(0,255,120,0.3)" : status === "loading" ? "rgba(0,255,240,0.2)" : "rgba(255,50,80,0.3)"}`,
          }}
        >
          <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60" />
          <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60" />
          <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60" />
          <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60" />

          <div className="flex flex-col items-center gap-5 text-center">
            {status === "loading" && (
              <>
                <motion.div
                  className="w-12 h-12 rounded-full border-2 border-cyan-400/30 border-t-cyan-400"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <p className="font-mono text-sm text-cyan-400/70 tracking-wider">Đang xác thực...</p>
              </>
            )}

            {status === "success" && (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="text-5xl"
                >
                  ✓
                </motion.div>
                <div>
                  <p className="font-orbitron text-base font-bold text-green-400 tracking-widest mb-2">THÀNH CÔNG</p>
                  <p className="font-mono text-xs text-cyan-300/70 leading-relaxed">{message}</p>
                </div>
                <motion.button
                  onClick={() => setLocation("/login")}
                  className="mt-2 w-full py-3 border font-orbitron text-sm tracking-[0.2em] font-bold"
                  style={{
                    background: "linear-gradient(135deg,rgba(0,255,240,0.08),rgba(100,0,200,0.12))",
                    borderColor: "rgba(0,255,240,0.4)",
                    color: "#00fff0",
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  ĐĂNG NHẬP NGAY
                </motion.button>
              </>
            )}

            {status === "error" && (
              <>
                <div className="text-5xl text-red-400">✗</div>
                <div>
                  <p className="font-orbitron text-base font-bold text-red-400 tracking-widest mb-2">THẤT BẠI</p>
                  <p className="font-mono text-xs text-red-300/70 leading-relaxed">{message}</p>
                </div>
                <motion.button
                  onClick={() => setLocation("/login")}
                  className="mt-2 w-full py-3 border font-mono text-xs tracking-[0.2em]"
                  style={{ borderColor: "rgba(255,50,80,0.4)", color: "rgba(255,100,100,0.8)" }}
                  whileHover={{ scale: 1.02 }}
                >
                  ← QUAY LẠI ĐĂNG NHẬP
                </motion.button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
