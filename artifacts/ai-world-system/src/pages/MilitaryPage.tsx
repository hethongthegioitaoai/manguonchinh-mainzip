import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sword, Shield, Users, Zap, TrendingUp, ChevronLeft,
  AlertTriangle, CheckCircle2, Loader2, Bot, Star,
  Package, Flame, Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WORLD_SLUGS = ["cultivation", "cyberpunk", "wasteland"];
const WORLD_LABELS: Record<string, string> = {
  cultivation: "🌸 Tu Tiên",
  cyberpunk:   "⚡ Cyberpunk",
  wasteland:   "🏜️ Hoang Phế",
};

function StatBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-white/10 rounded-full h-2">
      <motion.div
        className="h-2 rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6 }}
      />
    </div>
  );
}

function MoraleColor(v: number) {
  if (v >= 70) return "#22c55e";
  if (v >= 40) return "#f59e0b";
  return "#ef4444";
}

function SupplyColor(v: number) {
  if (v >= 70) return "#06b6d4";
  if (v >= 40) return "#f59e0b";
  return "#ef4444";
}

export default function MilitaryPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [worldSlug, setWorldSlug] = useState(
    () => localStorage.getItem("activeWorldSlug") ?? "cultivation"
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string[] | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/military", worldSlug],
    queryFn: async () => {
      const r = await fetch(`/api/military/${worldSlug}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const armies: any[]   = data?.armies   ?? [];
  const summary: any    = data?.summary  ?? null;
  const memories: any[] = data?.memories ?? [];

  async function callApi(path: string, label: string) {
    try {
      const r = await fetch(path, { method: "POST", credentials: "include" });
      const d = await r.json();
      toast({ title: label, description: d.message ?? "Hoàn tất" });
      refetch();
      return d;
    } catch {
      toast({ title: "Lỗi", description: "Không thể kết nối server", variant: "destructive" });
    }
  }

  const establish = useMutation({
    mutationFn: () => callApi(`/api/military/establish/${worldSlug}`, "Thành Lập Quân Đội"),
  });
  const recruit = useMutation({
    mutationFn: () => callApi(`/api/military/recruit/${worldSlug}`, "Tuyển Quân"),
  });
  const train = useMutation({
    mutationFn: () => callApi(`/api/military/train/${worldSlug}`, "Huấn Luyện"),
  });
  const supply = useMutation({
    mutationFn: () => callApi(`/api/military/supply/${worldSlug}`, "Tiếp Tế"),
  });
  const tick = useMutation({
    mutationFn: () => callApi(`/api/military/tick/${worldSlug}`, "Tick Quân Đội"),
  });
  const aiDecision = useMutation({
    mutationFn: async () => {
      const d = await callApi(`/api/military/ai-decision/${worldSlug}`, "AI Chiến Lược");
      if (d?.decisions) setAiResult(d.decisions);
      return d;
    },
  });

  const anyLoading = establish.isPending || recruit.isPending || train.isPending ||
    supply.isPending || tick.isPending || aiDecision.isPending;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6 font-mono">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/dashboard")}
            className="text-cyan-400 hover:text-cyan-300 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-red-500 tracking-widest">
              ⚔ QUÂN ĐỘI NPC
            </h1>
            <p className="text-xs text-gray-500 tracking-wider mt-0.5">
              TUYỂN QUÂN · HUẤN LUYỆN · TIẾP TẾ · CHIẾN LƯỢC
            </p>
          </div>
        </div>

        {/* World selector */}
        <div className="flex gap-2 flex-wrap">
          {WORLD_SLUGS.map(slug => (
            <button key={slug}
              onClick={() => { setWorldSlug(slug); localStorage.setItem("activeWorldSlug", slug); setAiResult(null); }}
              className={`px-4 py-1.5 rounded border text-xs tracking-widest transition-all ${
                worldSlug === slug
                  ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                  : "border-white/20 text-gray-400 hover:border-cyan-500/50"
              }`}>
              {WORLD_LABELS[slug]}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { icon: Shield,   label: "Thành Lập",   sub: "Tạo quân đội mới",       fn: establish, color: "cyan" },
            { icon: Users,    label: "Tuyển Quân",   sub: "NPC gia nhập quân đội",   fn: recruit,   color: "green" },
            { icon: Star,     label: "Huấn Luyện",   sub: "Tăng trình độ chiến đấu", fn: train,     color: "yellow" },
            { icon: Package,  label: "Tiếp Tế",      sub: "Lương thực & ngân sách",  fn: supply,    color: "blue" },
            { icon: Zap,      label: "Full Tick",    sub: "Tuyển + Huấn + Tiếp",     fn: tick,      color: "purple" },
            { icon: Bot,      label: "AI Chiến Lược",sub: "Cố vấn quyết định quân sự", fn: aiDecision, color: "red" },
          ].map(({ icon: Icon, label, sub, fn, color }) => {
            const colorMap: Record<string, string> = {
              cyan:   "border-cyan-500/50 hover:border-cyan-400 bg-cyan-500/10 text-cyan-300",
              green:  "border-green-500/50 hover:border-green-400 bg-green-500/10 text-green-300",
              yellow: "border-yellow-500/50 hover:border-yellow-400 bg-yellow-500/10 text-yellow-300",
              blue:   "border-blue-500/50 hover:border-blue-400 bg-blue-500/10 text-blue-300",
              purple: "border-purple-500/50 hover:border-purple-400 bg-purple-500/10 text-purple-300",
              red:    "border-red-500/50 hover:border-red-400 bg-red-500/10 text-red-300",
            };
            return (
              <button key={label} onClick={() => fn.mutate()}
                disabled={anyLoading}
                className={`p-3 border rounded-lg text-left transition-all ${colorMap[color]} disabled:opacity-40`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-wider">{label}</span>
                  {fn.isPending && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                </div>
                <p className="text-xs text-gray-400">{sub}</p>
              </button>
            );
          })}
        </div>

        {/* AI Decision result */}
        <AnimatePresence>
          {aiResult && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="border border-red-500/40 bg-red-950/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-red-400 text-xs font-bold tracking-widest mb-2">
                <Bot className="w-4 h-4" /> AI CHIẾN LƯỢC QUÂN SỰ
              </div>
              {aiResult.map((d, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-red-500 text-xs mt-0.5">▶</span>
                  <p className="text-sm text-gray-300">{d}</p>
                </div>
              ))}
              <button onClick={() => setAiResult(null)} className="text-xs text-gray-600 hover:text-gray-400 mt-1">Đóng</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Tổng Quân Đội",   value: summary.totalArmies,                    icon: Shield,   unit: "đội",  color: "#06b6d4" },
              { label: "Tổng Quân Số",    value: summary.totalSoldiers,                  icon: Users,    unit: "người",color: "#22c55e" },
              { label: "Tinh Thần TB",    value: summary.avgMorale?.toFixed(1),           icon: Flame,    unit: "%",    color: MoraleColor(summary.avgMorale) },
              { label: "Trình Độ TB",     value: summary.avgTraining?.toFixed(1),         icon: Star,     unit: "/10",  color: "#f59e0b" },
              { label: "Tiếp Tế TB",      value: summary.avgSupply?.toFixed(1),           icon: Package,  unit: "%",    color: SupplyColor(summary.avgSupply) },
              { label: "Tổng Sức Mạnh",   value: summary.totalPower?.toLocaleString(),    icon: Zap,      unit: "pts",  color: "#ef4444" },
            ].map(({ label, value, icon: Icon, unit, color }) => (
              <div key={label} className="border border-white/10 bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  <span className="text-xs text-gray-400 tracking-wider">{label}</span>
                </div>
                <p className="text-xl font-bold" style={{ color }}>
                  {value ?? 0} <span className="text-xs text-gray-500">{unit}</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Armies list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : armies.length === 0 ? (
          <div className="text-center py-16 text-gray-600 space-y-3">
            <Sword className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-sm">Chưa có quân đội nào — nhấn "Thành Lập" để tạo</p>
            <p className="text-xs">Cần có Lãnh Thổ + Chính Phủ NPC trước</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs text-gray-500 tracking-widest uppercase">⚔ Danh Sách Quân Đội</h2>
            {armies.map((army: any) => {
              const isExpanded = expanded === army.id;
              return (
                <motion.div key={army.id} layout
                  className="border border-white/10 bg-white/5 rounded-lg overflow-hidden">
                  <button className="w-full p-4 text-left flex items-center gap-4 hover:bg-white/5 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : army.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-cyan-300 text-sm">{army.armyName}</span>
                        {army.territory && (
                          <span className="text-xs text-gray-500 border border-white/10 rounded px-1.5 py-0.5">
                            {army.territory.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <span className="text-xs text-gray-400">
                          <Users className="w-3 h-3 inline mr-1 text-green-400" />
                          {army.totalSoldiers} quân
                        </span>
                        <span className="text-xs text-gray-400">
                          <Flame className="w-3 h-3 inline mr-1 text-orange-400" />
                          {army.morale?.toFixed(0)}% tinh thần
                        </span>
                        <span className="text-xs text-gray-400">
                          <Star className="w-3 h-3 inline mr-1 text-yellow-400" />
                          Cấp {army.trainingLevel?.toFixed(1)}
                        </span>
                        <span className="text-xs font-bold text-red-400">
                          <Zap className="w-3 h-3 inline mr-1" />
                          {army.militaryPower?.toLocaleString()} sức mạnh
                        </span>
                      </div>
                    </div>
                    <div className="text-gray-600 text-xs">{isExpanded ? "▲" : "▼"}</div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">

                        {/* Stat bars */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>Tinh Thần</span>
                              <span style={{ color: MoraleColor(army.morale) }}>{army.morale?.toFixed(0)}%</span>
                            </div>
                            <StatBar value={army.morale} max={100} color={MoraleColor(army.morale)} />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>Mức Tiếp Tế</span>
                              <span style={{ color: SupplyColor(army.supplyLevel) }}>{army.supplyLevel?.toFixed(0)}%</span>
                            </div>
                            <StatBar value={army.supplyLevel} max={100} color={SupplyColor(army.supplyLevel)} />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>Trình Độ Huấn Luyện</span>
                              <span className="text-yellow-400">{army.trainingLevel?.toFixed(2)}/10</span>
                            </div>
                            <StatBar value={army.trainingLevel} max={10} color="#f59e0b" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>Sức Mạnh Quân Sự</span>
                              <span className="text-red-400">{army.militaryPower?.toLocaleString()} pts</span>
                            </div>
                            <StatBar value={Math.min(army.militaryPower, 5000)} max={5000} color="#ef4444" />
                          </div>
                        </div>

                        {/* Alerts */}
                        <div className="flex flex-wrap gap-2">
                          {army.morale < 40 && (
                            <div className="flex items-center gap-1 text-xs text-orange-400 bg-orange-950/30 border border-orange-500/30 rounded px-2 py-1">
                              <AlertTriangle className="w-3 h-3" /> Tinh thần thấp
                            </div>
                          )}
                          {army.supplyLevel < 40 && (
                            <div className="flex items-center gap-1 text-xs text-red-400 bg-red-950/30 border border-red-500/30 rounded px-2 py-1">
                              <AlertTriangle className="w-3 h-3" /> Thiếu tiếp tế
                            </div>
                          )}
                          {army.morale >= 70 && army.supplyLevel >= 70 && (
                            <div className="flex items-center gap-1 text-xs text-green-400 bg-green-950/30 border border-green-500/30 rounded px-2 py-1">
                              <CheckCircle2 className="w-3 h-3" /> Trạng thái tốt
                            </div>
                          )}
                        </div>

                        {/* Government info */}
                        {army.government && (
                          <div className="bg-white/5 rounded p-3 text-xs space-y-1">
                            <p className="text-gray-500 tracking-wider uppercase text-xs mb-2">Thông Tin Chính Phủ</p>
                            <div className="flex gap-4 flex-wrap">
                              <span className="text-gray-400">
                                Ngân quỹ: <span className="text-yellow-400">{army.government.treasury?.toLocaleString()} vàng</span>
                              </span>
                              <span className="text-gray-400">
                                Ủng hộ: <span className="text-cyan-400">{army.government.approvalRate?.toFixed(0)}%</span>
                              </span>
                              <span className="text-gray-400">
                                Thuế: <span className="text-orange-400">{army.government.taxRate?.toFixed(0)}%</span>
                              </span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Military Memories */}
        {memories.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs text-gray-500 tracking-widest uppercase">📜 Ký Ức Quân Sự</h2>
            <div className="border border-white/10 bg-white/5 rounded-lg divide-y divide-white/5 max-h-64 overflow-y-auto">
              {memories.map((m: any) => (
                <div key={m.id} className="px-4 py-2.5 flex items-start gap-3">
                  <Activity className="w-3.5 h-3.5 text-cyan-500/60 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300">{m.content}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {new Date(m.createdAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rules */}
        <div className="border border-white/10 bg-white/5 rounded-lg p-4">
          <h2 className="text-xs text-gray-500 tracking-widest uppercase mb-3">📋 Quy Tắc Hệ Thống</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-400">
            <div className="space-y-1.5">
              <p className="text-cyan-400 font-bold mb-1">Điều Kiện Tuyển Quân</p>
              <p>• Tuổi ≥ 18 và không giữ chức vụ đặc biệt</p>
              <p>• Năng lượng ≥ 50, không đói &gt; 70</p>
              <p>• Chính sách "Mở Rộng Quân Sự" tăng tỷ lệ tuyển</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-yellow-400 font-bold mb-1">Huấn Luyện Mỗi Tick</p>
              <p>• Tăng training_level (+0.1–0.2)</p>
              <p>• Tăng military_power tương ứng</p>
              <p>• Chi phí: 0.5 vàng/binh sĩ</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-red-400 font-bold mb-1">Tiếp Tế</p>
              <p>• Tiêu thực phẩm (0.3/binh) + ngân sách (0.2/binh)</p>
              <p>• Đủ tiếp tế: morale +5–15%, supply +5–15%</p>
              <p>• Thiếu tiếp tế: morale −5–15%, supply −10–25%</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-green-400 font-bold mb-1">Sức Mạnh Quân Sự</p>
              <p>• Power = soldiers × morale × training × supply</p>
              <p>• Tích hợp với Ngoại Giao & Chiến Tranh Thế Giới</p>
              <p>• AI tự điều chỉnh theo quan hệ ngoại giao</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
