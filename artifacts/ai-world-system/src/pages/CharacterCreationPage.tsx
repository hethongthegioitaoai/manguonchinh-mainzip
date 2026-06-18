import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, Loader2, Zap, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  getWorld,
  SYSTEMS,
  rollSystem,
  SYSTEM_ICONS,
  SYSTEM_DESC,
  type SystemName,
} from "@/lib/worlds";

const schema = z.object({
  name: z
    .string()
    .min(2, "Tên phải có ít nhất 2 ký tự")
    .max(32, "Tên tối đa 32 ký tự")
    .regex(/^[\p{L}0-9 _'\-]+$/u, "Chỉ dùng chữ cái, số, khoảng trắng và - _ '"),
});
type FormValues = z.infer<typeof schema>;
type Phase = "form" | "rolling" | "revealed" | "saving" | "done";

/* ─── Per-system accent colors ─── */
const SYSTEM_COLORS: Record<SystemName, string> = {
  "Kiếm Thần Hệ Thống":      "#00fff0",
  "Luyện Đan Hệ Thống":      "#ff9900",
  "Thương Nhân Hệ Thống":    "#ffd700",
  "Thú Tướng Hệ Thống":      "#39ff14",
  "Bất Tử Tu Tiên Hệ Thống": "#b000ff",
  "Tử Linh Hệ Thống":        "#ff2244",
};

/* ─── Hologram canvas for revealed system ─── */
function SystemHologram({
  systemName,
  worldColor,
  spinning,
}: {
  systemName: SystemName;
  worldColor: string;
  spinning: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);
  const color = SYSTEM_COLORS[systemName] ?? worldColor;

  useAnimationFrame((_, delta) => {
    tRef.current += delta * 0.001 * (spinning ? 5 : 0.8);
    const t = tRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;

    if (spinning) {
      // Glitch/noise bars during spinning
      for (let i = 0; i < 6; i++) {
        const y = (Math.sin(t * 7 + i * 1.3) * 0.5 + 0.5) * H;
        const w = 20 + Math.random() * 60;
        ctx.fillStyle = `${color}30`;
        ctx.fillRect(cx - w / 2, y, w, 2 + Math.random() * 3);
      }
      return;
    }

    const r = W * 0.38;

    // Outer glow
    for (let i = 3; i >= 0; i--) {
      const g = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 10 + i * 12);
      g.addColorStop(0, `${color}30`);
      g.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(cx, cy, r + 10 + i * 12, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    }

    // Tilt rings
    const tilts = [0.3, 0.6, 0.95];
    const colors2 = [color, worldColor, "#ffffff40"];
    for (let ri = 0; ri < 3; ri++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, tilts[ri]);
      ctx.rotate(t * (ri % 2 === 0 ? 1 : -0.7) + ri * 1.2);
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.75 + ri * 0.1), 0, Math.PI * 1.4);
      ctx.strokeStyle = colors2[ri];
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Inner orb
    const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.85);
    ig.addColorStop(0, `${color}25`);
    ig.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = ig; ctx.fill();

    // Scan line
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.clip();
    const sy = ((t * 50) % (r * 2)) - r;
    const sg = ctx.createLinearGradient(cx - r, cy + sy, cx + r, cy + sy);
    sg.addColorStop(0, "transparent"); sg.addColorStop(0.5, `${color}50`); sg.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.moveTo(cx - r, cy + sy); ctx.lineTo(cx + r, cy + sy);
    ctx.strokeStyle = sg; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();

    // Orbiting dots
    for (let d = 0; d < 6; d++) {
      const ang = t * 1.5 + (d / 6) * Math.PI * 2;
      const dr = r + 18;
      const a = 0.3 + 0.7 * ((Math.sin(ang) + 1) / 2);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * dr, cy + Math.sin(ang) * dr * 0.32, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `${color}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
      ctx.fill();
    }

    // Center glow
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
    cg.addColorStop(0, color); cg.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = cg; ctx.fill();
  });

  return <canvas ref={canvasRef} width={220} height={220} className="pointer-events-none" />;
}

/* ─── Slot machine reel ─── */
const SLOT_ITEM_H = 80;

function SlotReel({
  items,
  finalIndex,
  spinning,
  speed,
}: {
  items: typeof SYSTEMS;
  finalIndex: number;
  spinning: boolean;
  speed: number; // px/sec
}) {
  const offsetRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const totalH = items.length * SLOT_ITEM_H;

  useAnimationFrame((_, delta) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (spinning) {
      offsetRef.current = (offsetRef.current + (delta * speed) / 1000) % totalH;
    }

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Fade gradient overlay
    const fade = ctx.createLinearGradient(0, 0, 0, H);
    fade.addColorStop(0, "rgba(0,0,0,0.9)");
    fade.addColorStop(0.25, "rgba(0,0,0,0.1)");
    fade.addColorStop(0.5, "rgba(0,0,0,0)");
    fade.addColorStop(0.75, "rgba(0,0,0,0.1)");
    fade.addColorStop(1, "rgba(0,0,0,0.9)");

    const off = offsetRef.current;
    const centerY = H / 2;

    for (let i = 0; i < items.length + 2; i++) {
      const idx = i % items.length;
      const sys = items[idx];
      const color = SYSTEM_COLORS[sys];
      const rawY = (i * SLOT_ITEM_H - off + totalH * 2) % totalH;
      const y = rawY - totalH / 2 + centerY;
      if (y < -SLOT_ITEM_H || y > H + SLOT_ITEM_H) continue;

      const distFromCenter = Math.abs(y + SLOT_ITEM_H / 2 - centerY);
      const alpha = Math.max(0, 1 - distFromCenter / (H * 0.5));
      const isCenter = distFromCenter < SLOT_ITEM_H * 0.6;

      // Row bg
      if (isCenter) {
        ctx.fillStyle = `${color}18`;
        ctx.fillRect(0, y, W, SLOT_ITEM_H);
        // Center line
        ctx.strokeStyle = `${color}80`;
        ctx.lineWidth = 1;
        ctx.strokeRect(2, y + 2, W - 4, SLOT_ITEM_H - 4);
      }

      ctx.globalAlpha = alpha * (isCenter ? 1 : 0.5);

      // Icon
      ctx.font = "28px serif";
      ctx.textAlign = "center";
      ctx.fillStyle = isCenter ? color : "#ffffff";
      ctx.fillText(SYSTEM_ICONS[sys], W * 0.22, y + SLOT_ITEM_H * 0.62);

      // Name
      ctx.font = `${isCenter ? "bold " : ""}11px monospace`;
      ctx.fillStyle = isCenter ? color : "#888";
      ctx.fillText(sys.replace(" Hệ Thống", ""), W * 0.62, y + SLOT_ITEM_H * 0.55);

      ctx.globalAlpha = 1;
    }

    // Overlay fades
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);

    // Center selector lines
    ctx.strokeStyle = "#ffffff30";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, centerY - SLOT_ITEM_H / 2); ctx.lineTo(W, centerY - SLOT_ITEM_H / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, centerY + SLOT_ITEM_H / 2); ctx.lineTo(W, centerY + SLOT_ITEM_H / 2); ctx.stroke();
  });

  return <canvas ref={canvasRef} width={260} height={320} className="pointer-events-none" />;
}

/* ─── Main Page ─── */
export default function CharacterCreationPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const world = getWorld(worldId ?? "");

  const [phase, setPhase] = useState<Phase>("form");
  const [assignedSystem, setAssignedSystem] = useState<SystemName | null>(null);
  const [slotFinalIdx, setSlotFinalIdx] = useState(0);
  const [slotSpeed, setSlotSpeed] = useState(600);
  const [slotSpinning, setSlotSpinning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "" } });

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading, setLocation]);
  useEffect(() => { if (!world) setLocation("/worlds"); }, [world, setLocation]);
  useEffect(() => () => { if (spinTimerRef.current) clearTimeout(spinTimerRef.current); }, []);

  const wc = world?.color ?? "#00fff0";

  const startRoll = useCallback((_data: FormValues) => {
    const final = rollSystem();
    const finalIdx = SYSTEMS.indexOf(final as typeof SYSTEMS[number]);
    setSlotFinalIdx(finalIdx);
    setSlotSpeed(900);
    setSlotSpinning(true);
    setPhase("rolling");
    setErrorMsg(null);

    // Decelerate
    const steps = [
      { delay: 1200, speed: 600 },
      { delay: 2000, speed: 350 },
      { delay: 2700, speed: 160 },
      { delay: 3200, speed: 60 },
    ];
    steps.forEach(({ delay, speed }) => {
      spinTimerRef.current = setTimeout(() => setSlotSpeed(speed), delay);
    });

    // Stop and reveal
    spinTimerRef.current = setTimeout(() => {
      setSlotSpinning(false);
      setAssignedSystem(final);
      setPhase("revealed");
    }, 3800);
  }, []);

  async function handleConfirm() {
    if (!assignedSystem || !user || !world) return;
    setPhase("saving");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          worldSlug: world.id,
          name: getValues("name"),
          stats: { system: assignedSystem, world_slug: world.id },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message ?? "Lỗi lưu nhân vật");
      }
      setPhase("done");
      setTimeout(() => setLocation("/dashboard"), 2500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Lỗi không xác định");
      setPhase("revealed");
    }
  }

  if (loading || !user || !world) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <motion.div className="font-orbitron text-cyan-400 text-sm tracking-widest"
          animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
          KHỞI TẠO...
        </motion.div>
      </div>
    );
  }

  const sysColor = assignedSystem ? (SYSTEM_COLORS[assignedSystem] ?? wc) : wc;

  return (
    <div className="min-h-screen w-full bg-black text-white relative overflow-hidden flex flex-col">

      {/* Background */}
      <div className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 100% 60% at 50% 0%, ${wc}20 0%, #000 60%)` }} />
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(${wc} 1px, transparent 1px), linear-gradient(90deg, ${wc} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

      {/* Sweep line */}
      <motion.div className="absolute left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${wc}50, transparent)` }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }} />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: `${wc}20` }}>
        <button onClick={() => setLocation("/worlds")}
          className="font-mono text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-2"
          data-testid="button-back-worlds">
          <ChevronLeft className="w-4 h-4" /> WORLDS
        </button>
        <div className="flex items-center gap-2">
          <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: wc }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: wc }}>
            {world.name}
          </span>
        </div>
      </nav>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 gap-8">

        {/* Title */}
        <motion.div className="text-center" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-mono text-[10px] tracking-[0.4em] mb-2" style={{ color: `${wc}80` }}>
            ◈ GIAO THỨC KHỞI TẠO DANH TÍNH ◈
          </p>
          <h1 className="font-orbitron text-3xl md:text-4xl font-black tracking-wider">
            TẠO NHÂN VẬT
          </h1>
          <motion.div className="h-px mt-2 mx-auto w-48"
            style={{ background: `linear-gradient(90deg, transparent, ${wc}, transparent)` }}
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.4 }} />
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── DONE ── */}
          {phase === "done" && (
            <motion.div key="done"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 text-center">
              <motion.div className="w-20 h-20 rounded-full border-2 flex items-center justify-center text-3xl"
                style={{ borderColor: sysColor, boxShadow: `0 0 40px ${sysColor}60` }}
                animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                {assignedSystem ? SYSTEM_ICONS[assignedSystem] : "✦"}
              </motion.div>
              <p className="font-orbitron text-xl tracking-widest" style={{ color: sysColor }}>
                DANH TÍNH ĐÃ XÁC NHẬN
              </p>
              <p className="font-mono text-xs text-gray-500 tracking-widest">
                Đang liên kết thần kinh...
              </p>
            </motion.div>
          )}

          {/* ── FORM / ROLLING / REVEALED ── */}
          {phase !== "done" && (
            <motion.div key="main"
              className="w-full max-w-2xl flex flex-col md:flex-row gap-8 items-center md:items-start">

              {/* Left: name input + roll button */}
              <motion.div className="w-full md:w-64 flex flex-col gap-4"
                initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>

                {/* Name input */}
                <div className="relative">
                  <div className="absolute top-0 left-0 w-2 h-full" style={{ background: wc }} />
                  <div className="absolute top-0 right-0 w-6 h-0.5" style={{ background: wc }} />
                  <div className="absolute bottom-0 left-0 w-6 h-0.5" style={{ background: wc }} />
                  <div className="pl-4 pr-3 py-3 bg-black/60 border" style={{ borderColor: `${wc}30` }}>
                    <label className="font-mono text-[9px] tracking-[0.3em] mb-2 block" style={{ color: wc }}>
                      DANH HIỆU
                    </label>
                    <input
                      {...register("name")}
                      placeholder="Nhập danh hiệu..."
                      autoComplete="off"
                      disabled={phase !== "form"}
                      data-testid="input-character-name"
                      className="w-full bg-transparent font-mono text-sm text-white placeholder-gray-600 outline-none border-b pb-1"
                      style={{ borderColor: `${wc}40` }}
                    />
                    {errors.name && (
                      <p className="font-mono text-[10px] text-red-400 mt-1">{errors.name.message}</p>
                    )}
                  </div>
                </div>

                {/* Roll button */}
                {phase === "form" && (
                  <motion.button
                    onClick={handleSubmit(startRoll)}
                    className="relative w-full py-4 font-orbitron text-xs tracking-[0.25em] border overflow-hidden group"
                    style={{ borderColor: wc, color: wc }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    data-testid="button-roll-system"
                  >
                    <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100"
                      style={{ background: wc }} />
                    <span className="relative z-10 group-hover:text-black transition-colors flex items-center justify-center gap-2">
                      <Zap className="w-4 h-4" /> PHÂN CÔNG HỆ THỐNG
                    </span>
                    {/* Shimmer */}
                    <motion.div className="absolute inset-0"
                      style={{ background: `linear-gradient(105deg, transparent 40%, ${wc}30 50%, transparent 60%)` }}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
                  </motion.button>
                )}

                {/* Reroll / confirm buttons */}
                {(phase === "revealed" || phase === "saving") && (
                  <motion.div className="flex flex-col gap-3"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                    <button
                      onClick={() => { setPhase("form"); setAssignedSystem(null); }}
                      disabled={phase === "saving"}
                      className="w-full py-3 font-mono text-xs tracking-widest border border-gray-700 text-gray-500 hover:text-white hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
                      data-testid="button-reroll-system"
                    >
                      <RotateCcw className="w-3 h-3" /> QUAY LẠI
                    </button>
                    <motion.button
                      onClick={handleConfirm}
                      disabled={phase === "saving"}
                      className="relative w-full py-4 font-orbitron text-xs tracking-[0.2em] border overflow-hidden"
                      style={{ borderColor: sysColor, color: sysColor, background: `${sysColor}12` }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      data-testid="button-confirm-character"
                    >
                      {phase === "saving" ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> LIÊN KẾT...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Zap className="w-4 h-4" /> XÁC NHẬN DANH TÍNH
                        </span>
                      )}
                      <motion.div className="absolute inset-0 pointer-events-none"
                        style={{ background: `linear-gradient(105deg, transparent 40%, ${sysColor}25 50%, transparent 60%)` }}
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ duration: 1.8, repeat: Infinity }} />
                    </motion.button>

                    {errorMsg && (
                      <p className="font-mono text-[10px] text-red-400 border border-red-500/30 bg-red-900/20 px-3 py-2"
                        data-testid="text-creation-error">{errorMsg}</p>
                    )}
                  </motion.div>
                )}

                {/* System info after reveal */}
                {phase === "revealed" && assignedSystem && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                    className="p-3 border text-left"
                    style={{ borderColor: `${sysColor}40`, background: `${sysColor}08` }}
                  >
                    <p className="font-mono text-[9px] tracking-widest mb-1" style={{ color: sysColor }}>
                      MÔ TẢ HỆ THỐNG
                    </p>
                    <p className="font-mono text-[10px] text-gray-400 leading-relaxed">
                      {SYSTEM_DESC[assignedSystem]}
                    </p>
                  </motion.div>
                )}
              </motion.div>

              {/* Right: slot machine + hologram */}
              <motion.div className="flex flex-col items-center gap-4 flex-1"
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>

                {phase === "form" && (
                  /* Preview slot — static */
                  <div className="relative border" style={{ borderColor: `${wc}25` }}>
                    <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${wc}60, transparent)` }} />
                    <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${wc}60, transparent)` }} />
                    <div className="px-4 py-3 font-mono text-[9px] text-center tracking-widest" style={{ color: `${wc}60` }}>
                      ◈ HỆ THỐNG NGẪU NHIÊN ◈
                    </div>
                    <div className="grid grid-cols-2 gap-1 px-4 pb-4">
                      {SYSTEMS.map((s) => (
                        <div key={s} className="flex items-center gap-2 px-2 py-1.5 border border-gray-800/60">
                          <span className="text-lg">{SYSTEM_ICONS[s]}</span>
                          <span className="font-mono text-[9px] text-gray-500">{s.replace(" Hệ Thống", "")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(phase === "rolling" || phase === "revealed" || phase === "saving") && (
                  <div className="flex flex-col items-center gap-3">
                    {/* Slot reel */}
                    <div className="relative border" style={{ borderColor: `${wc}40` }}>
                      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${wc}, transparent)` }} />
                      <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${wc}, transparent)` }} />
                      <div className="absolute left-0 inset-y-0 w-px" style={{ background: `linear-gradient(180deg, transparent, ${wc}60, transparent)` }} />
                      <div className="absolute right-0 inset-y-0 w-px" style={{ background: `linear-gradient(180deg, transparent, ${wc}60, transparent)` }} />

                      <SlotReel
                        items={SYSTEMS}
                        finalIndex={slotFinalIdx}
                        spinning={slotSpinning}
                        speed={slotSpeed}
                      />
                    </div>

                    {/* Hologram orb when revealed */}
                    <AnimatePresence>
                      {phase !== "form" && assignedSystem && (
                        <motion.div
                          key="hologram"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex flex-col items-center gap-2"
                        >
                          <SystemHologram
                            systemName={assignedSystem}
                            worldColor={wc}
                            spinning={slotSpinning}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-center"
                          >
                            <p className="font-mono text-[9px] tracking-[0.3em] mb-1" style={{ color: `${sysColor}70` }}>
                              HỆ THỐNG ĐƯỢC CHỌN
                            </p>
                            <p className="font-orbitron text-lg font-bold tracking-wide"
                              style={{ color: sysColor, textShadow: `0 0 20px ${sysColor}80` }}>
                              {assignedSystem}
                            </p>
                          </motion.div>
                        </motion.div>
                      )}

                      {/* Spinning placeholder orb */}
                      {slotSpinning && (
                        <motion.div key="spinning-orb"
                          className="flex flex-col items-center gap-2"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <SystemHologram systemName={SYSTEMS[0]} worldColor={wc} spinning={true} />
                          <motion.p className="font-mono text-[9px] tracking-[0.4em]"
                            style={{ color: `${wc}60` }}
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 0.5, repeat: Infinity }}>
                            ĐANG QUÉT CỔ VŨ KÝ...
                          </motion.p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
