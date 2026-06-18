import { useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { WORLDS, type World } from "@/lib/worlds";

/* ─── Per-world visual config ─── */
const WORLD_VISUALS = {
  cultivation: {
    primary: "#00fff0",
    secondary: "#ffd700",
    accent: "#b000ff",
    label: "CẢNH GIỚI CỔ ĐẠI",
    particles: "⚔ ☯ ✦ ⚡ ☽",
    glowColor: "rgba(0,255,240,0.4)",
    bgGradient: "radial-gradient(ellipse at 50% 50%, rgba(0,60,80,0.7) 0%, rgba(0,0,0,0) 70%)",
  },
  cyberpunk: {
    primary: "#ff00aa",
    secondary: "#00aaff",
    accent: "#ffff00",
    label: "CÕI KỸ THUẬT SỐ",
    particles: "◈ ⬡ ▲ ⬢ ◆",
    glowColor: "rgba(255,0,170,0.4)",
    bgGradient: "radial-gradient(ellipse at 50% 50%, rgba(80,0,60,0.7) 0%, rgba(0,0,0,0) 70%)",
  },
  zombie: {
    primary: "#39ff14",
    secondary: "#ff4400",
    accent: "#ffaa00",
    label: "VÙNG SINH TỒN",
    particles: "☣ ✸ ⬤ ◉ ✦",
    glowColor: "rgba(57,255,20,0.4)",
    bgGradient: "radial-gradient(ellipse at 50% 50%, rgba(0,50,0,0.7) 0%, rgba(0,0,0,0) 70%)",
  },
} as Record<string, typeof WORLD_VISUALS["cultivation"]>;

/* ─── Hologram orb per world ─── */
function WorldOrb({ worldId, active }: { worldId: string; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);
  const vis = WORLD_VISUALS[worldId] ?? WORLD_VISUALS.cultivation;

  useAnimationFrame((_, delta) => {
    tRef.current += delta * 0.001 * (active ? 1.4 : 0.6);
    const t = tRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const r = W * 0.34;

    // Outer pulsing glow
    const pulseR = r + 12 + Math.sin(t * 2) * 6;
    for (let i = 4; i >= 0; i--) {
      const g = ctx.createRadialGradient(cx, cy, r - 2, cx, cy, pulseR + i * 14);
      g.addColorStop(0, `${vis.primary}${active ? "44" : "22"}`);
      g.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(cx, cy, pulseR + i * 14, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    }

    // Rotating rings
    for (let ring = 0; ring < 3; ring++) {
      const ringR = r * (0.7 + ring * 0.15);
      const tilt = [0.4, 0.7, 1.1][ring];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, tilt);
      const arc = (ring % 2 === 0 ? 1 : -1);
      const start = t * arc + (ring * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, start, start + Math.PI * 1.3);
      ctx.strokeStyle = ring === 0 ? vis.primary : ring === 1 ? vis.secondary : vis.accent;
      ctx.globalAlpha = active ? 0.8 : 0.4;
      ctx.lineWidth = active ? 2 : 1;
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Inner orb
    const innerG = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r * 0.9);
    innerG.addColorStop(0, `${vis.primary}${active ? "30" : "15"}`);
    innerG.addColorStop(0.5, `${vis.accent}${active ? "15" : "08"}`);
    innerG.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = innerG; ctx.fill();

    // Scan lines
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2); ctx.clip();
    const scanY = ((t * 40) % (r * 2)) - r;
    for (let i = -8; i <= 8; i++) {
      const y = cy + scanY + i * 18;
      ctx.beginPath(); ctx.moveTo(cx - r, y); ctx.lineTo(cx + r, y);
      ctx.strokeStyle = `${vis.primary}18`; ctx.lineWidth = 1; ctx.stroke();
    }
    // Bright scan line
    const sg = ctx.createLinearGradient(cx - r, cy + scanY, cx + r, cy + scanY);
    sg.addColorStop(0, "transparent"); sg.addColorStop(0.5, `${vis.primary}60`); sg.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.moveTo(cx - r, cy + scanY); ctx.lineTo(cx + r, cy + scanY);
    ctx.strokeStyle = sg; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();

    // World-specific pattern
    if (worldId === "cultivation") {
      // Yin-yang trace
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.5);
      ctx.beginPath(); ctx.arc(0, -r * 0.25, r * 0.25, Math.PI, 0);
      ctx.strokeStyle = `${vis.primary}60`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, r * 0.25, r * 0.25, 0, Math.PI);
      ctx.strokeStyle = `${vis.secondary}60`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    } else if (worldId === "cyberpunk") {
      // Hex grid inside
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.clip();
      for (let hx = -2; hx <= 2; hx++) {
        for (let hy = -2; hy <= 2; hy++) {
          const hcx = cx + hx * 22, hcy = cy + hy * 19 + (hx % 2 === 0 ? 0 : 9.5);
          ctx.beginPath();
          for (let side = 0; side < 6; side++) {
            const angle = (side / 6) * Math.PI * 2 + t * 0.3;
            const px = hcx + 10 * Math.cos(angle), py = hcy + 10 * Math.sin(angle);
            side === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.strokeStyle = `${vis.primary}20`; ctx.lineWidth = 0.8; ctx.stroke();
        }
      }
      ctx.restore();
    } else if (worldId === "zombie") {
      // Biohazard symbol outline
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(t * 0.2);
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate((i / 3) * Math.PI * 2);
        ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.2, 0, Math.PI * 2);
        ctx.strokeStyle = `${vis.primary}30`; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
      ctx.strokeStyle = `${vis.primary}50`; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }

    // Center dot
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
    cg.addColorStop(0, vis.primary); cg.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = cg; ctx.fill();

    // Orbiting dots
    for (let d = 0; d < 5; d++) {
      const angle = t * 1.2 + (d / 5) * Math.PI * 2;
      const dr = r + 22;
      const dx = cx + Math.cos(angle) * dr;
      const dy = cy + Math.sin(angle) * dr * 0.3;
      const alpha = 0.3 + 0.7 * ((Math.sin(angle) + 1) / 2);
      ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fillStyle = `${vis.primary}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
      ctx.fill();
    }
  });

  return <canvas ref={canvasRef} width={260} height={260} className="pointer-events-none" />;
}

/* ─── Floating particles ─── */
function WorldParticles({ worldId }: { worldId: string }) {
  const vis = WORLD_VISUALS[worldId] ?? WORLD_VISUALS.cultivation;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 16 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-[10px] select-none"
          style={{
            left: `${10 + Math.random() * 80}%`,
            color: i % 2 === 0 ? vis.primary : vis.secondary,
            opacity: 0,
          }}
          animate={{
            y: [0, -80 - Math.random() * 60],
            opacity: [0, 0.7, 0],
          }}
          transition={{
            duration: 2.5 + Math.random() * 3,
            repeat: Infinity,
            delay: Math.random() * 4,
          }}
        >
          {vis.particles.split(" ")[i % 5]}
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Single World Card ─── */
function WorldCard({
  world,
  index,
  onEnter,
}: {
  world: World;
  index: number;
  onEnter: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const vis = WORLD_VISUALS[world.id] ?? WORLD_VISUALS.cultivation;

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.18, ease: "easeOut" }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative flex flex-col items-center cursor-pointer group"
      onClick={() => onEnter(world.id)}
      data-testid={`card-world-${world.id}`}
    >
      {/* Card backdrop */}
      <motion.div
        className="absolute inset-0 rounded-sm"
        style={{ background: vis.bgGradient }}
        animate={{ opacity: hovered ? 1 : 0.4 }}
        transition={{ duration: 0.3 }}
      />

      {/* Outer border glow */}
      <motion.div
        className="absolute inset-0 border"
        style={{ borderColor: vis.primary, boxShadow: `0 0 ${hovered ? 30 : 10}px ${vis.glowColor}` }}
        animate={{ opacity: hovered ? 1 : 0.35 }}
        transition={{ duration: 0.3 }}
      />

      {/* Corner decorations */}
      {[["top-0 left-0 border-t-2 border-l-2", ""], ["top-0 right-0 border-t-2 border-r-2", ""], ["bottom-0 left-0 border-b-2 border-l-2", ""], ["bottom-0 right-0 border-b-2 border-r-2", ""]].map(([cls], ci) => (
        <span key={ci} className={`absolute w-4 h-4 ${cls}`} style={{ borderColor: vis.primary }} />
      ))}

      {/* Particles */}
      <WorldParticles worldId={world.id} />

      <div className="relative z-10 flex flex-col items-center px-6 py-8 w-full">
        {/* Status badge */}
        <div className="flex items-center gap-2 mb-4 self-start">
          <motion.span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: vis.primary }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <span className="font-mono text-[9px] tracking-[0.3em] uppercase" style={{ color: vis.primary }}>
            {vis.label}
          </span>
        </div>

        {/* Hologram orb */}
        <motion.div
          animate={{ y: hovered ? -8 : 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative"
        >
          <WorldOrb worldId={world.id} active={hovered} />
          {/* Orb ground shadow */}
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-4 rounded-full"
            style={{
              background: `radial-gradient(ellipse, ${vis.glowColor} 0%, transparent 70%)`,
              filter: "blur(6px)",
            }}
          />
        </motion.div>

        {/* World name */}
        <motion.h3
          className="font-orbitron text-2xl font-black tracking-widest mt-4 mb-1"
          style={{
            color: hovered ? vis.primary : "#fff",
            textShadow: hovered ? `0 0 20px ${vis.glowColor}` : "none",
          }}
          animate={{ color: hovered ? vis.primary : "#ffffff" }}
          transition={{ duration: 0.2 }}
        >
          {world.name}
        </motion.h3>

        <p className="font-mono text-[10px] tracking-[0.25em] mb-4 uppercase" style={{ color: vis.secondary, opacity: 0.8 }}>
          {world.title}
        </p>

        <p className="text-center text-sm leading-relaxed text-gray-400 mb-6 max-w-[220px]">
          {world.description}
        </p>

        {/* Enter button */}
        <motion.button
          className="relative w-full py-3 font-orbitron text-xs tracking-[0.3em] uppercase overflow-hidden border"
          style={{
            borderColor: vis.primary,
            color: hovered ? "#000" : vis.primary,
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          data-testid={`button-enter-${world.id}`}
        >
          {/* Fill animation */}
          <motion.div
            className="absolute inset-0"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: hovered ? 1 : 0 }}
            transition={{ duration: 0.25 }}
            style={{ background: vis.primary, originX: "0%" }}
          />
          <span className="relative z-10 flex items-center justify-center gap-2">
            NHẬP THẾ GIỚI
            <motion.span animate={{ x: hovered ? 4 : 0 }} transition={{ duration: 0.2 }}>›</motion.span>
          </span>
          {/* Scanline sweep */}
          <motion.div
            className="absolute inset-0 opacity-30"
            style={{ background: "linear-gradient(90deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)" }}
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }}
          />
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ─── Enter transition overlay ─── */
function EnterOverlay({ worldId, onDone }: { worldId: string; onDone: () => void }) {
  const vis = WORLD_VISUALS[worldId] ?? WORLD_VISUALS.cultivation;
  const world = WORLDS.find(w => w.id === worldId);

  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "#000" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-32 h-32 rounded-full border-4"
        style={{ borderColor: vis.primary, boxShadow: `0 0 60px ${vis.glowColor}` }}
        animate={{ scale: [0.5, 1.5, 1], opacity: [0, 1, 0.6] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.p
        className="font-orbitron text-lg tracking-[0.5em] mt-8"
        style={{ color: vis.primary }}
        animate={{ opacity: [0, 1, 0.5, 1] }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        ĐANG NHẬP {world?.name ?? ""}
      </motion.p>
      <motion.p
        className="font-mono text-xs tracking-widest mt-2 text-gray-500"
        animate={{ opacity: [0, 1] }}
        transition={{ delay: 0.8 }}
      >
        KHỞI TẠO THẦN THỨC...
      </motion.p>
    </motion.div>
  );
}

/* ─── Main Page ─── */
export default function WorldsPage() {
  const { user, loading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [entering, setEntering] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <motion.div
          className="font-orbitron text-cyan-400 tracking-widest text-sm"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          KHỞI TẠO HỆ THỐNG...
        </motion.div>
      </div>
    );
  }

  function handleEnter(worldId: string) {
    setEntering(worldId);
  }

  function handleEnterDone() {
    const worldId = entering!;
    setEntering(null);
    setLocation(`/create-character/${worldId}`);
  }

  const displayName = user.firstName ?? user.email ?? "OPERATIVE";

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-black text-white">

      {/* Deep background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_50%,rgba(0,20,30,0.9)_0%,#000_70%)]" />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,255,240,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,240,1) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Top sweeping line */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent pointer-events-none"
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 pt-8 pb-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
          <p className="font-mono text-[10px] tracking-[0.4em] text-cyan-500/50 uppercase mb-1">◈ KẾT NỐI THÀNH CÔNG ◈</p>
          <h1 className="font-orbitron text-3xl md:text-4xl font-black tracking-wider"
            style={{
              background: "linear-gradient(135deg, #fff 0%, #00fff0 50%, #b000ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
            CHỌN THẾ GIỚI
          </h1>
        </motion.div>

        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-right hidden md:block">
            <p className="font-mono text-[9px] text-cyan-500/40 tracking-widest uppercase">OPERATIVE</p>
            <p className="font-mono text-xs text-cyan-300/70 max-w-[180px] truncate" data-testid="text-user-email">{displayName}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 font-mono text-xs text-gray-500 hover:text-red-400 transition-colors border border-gray-700 hover:border-red-500/50 px-3 py-2"
            data-testid="button-sign-out"
          >
            <LogOut className="w-3 h-3" /> THOÁT
          </button>
        </motion.div>
      </header>

      {/* Divider */}
      <motion.div
        className="relative z-10 mx-8 h-px mb-10"
        style={{ background: "linear-gradient(90deg, transparent, rgba(0,255,240,0.3), rgba(180,0,255,0.3), transparent)" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      />

      {/* World cards */}
      <main className="relative z-10 px-6 md:px-12 pb-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {WORLDS.map((world, i) => (
            <WorldCard key={world.id} world={world} index={i} onEnter={handleEnter} />
          ))}
        </div>

        {/* Bottom caption */}
        <motion.p
          className="text-center font-mono text-[9px] text-gray-600 tracking-[0.4em] uppercase mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          ⚠ CẢNH BÁO: CÓ THỂ XẢY RA MẤT ĐỒNG BỘ THẦN KINH — HÃY THẬN TRỌNG
        </motion.p>
      </main>

      {/* Enter transition overlay */}
      <AnimatePresence>
        {entering && <EnterOverlay key="overlay" worldId={entering} onDone={handleEnterDone} />}
      </AnimatePresence>
    </div>
  );
}
