import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ListChecks, CheckCircle2, XCircle, Clock, Loader2,
  RefreshCw, Zap, ChevronDown, ChevronUp, Play, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const GOAL_META: Record<string, { label: string; icon: string }> = {
  "làm_giàu":              { label: "Làm Giàu",              icon: "💰" },
  "mua_nhà":               { label: "Mua Nhà",               icon: "🏠" },
  "lập_gia_đình":          { label: "Lập Gia Đình",          icon: "👨‍👩‍👧" },
  "tham_gia_phe_phái":     { label: "Tham Gia Phe Phái",     icon: "⚔️" },
  "trở_thành_lãnh_đạo":   { label: "Trở Thành Lãnh Đạo",   icon: "👑" },
  "mở_rộng_kinh_doanh":   { label: "Mở Rộng Kinh Doanh",   icon: "📈" },
  "trở_thành_tướng_lĩnh": { label: "Trở Thành Tướng Lĩnh", icon: "🗡️" },
};

const ACTION_ICONS: Record<string, string> = {
  "tìm_việc": "🔍", "làm_việc_chăm": "💼", "tiết_kiệm": "🪙",
  "mở_cửa_hàng": "🏪", "thuê_nhân_công": "👥", "mở_rộng": "📊",
  "đánh_giá_tài_sản": "📋", "tìm_nhà": "🔑", "đàm_phán": "🤝", "mua_nhà": "🏠",
  "giao_tiếp": "💬", "kết_bạn": "👫", "hẹn_hò": "💞", "cưới_hỏi": "💍", "sinh_con": "👶",
  "tìm_hiểu": "🔎", "kết_nối": "🌐", "chứng_minh": "🏆", "gia_nhập": "✅", "xây_dựng_uy_tín": "⭐",
  "học_hỏi": "📚", "tăng_uy_tín": "📣", "gia_nhập_phe": "🏛️", "tranh_cử": "🗳️", "lãnh_đạo": "👑",
  "phân_tích_thị_trường": "📉", "mở_rộng_hàng_hoá": "📦", "tìm_đối_tác": "🤝",
  "mở_chi_nhánh": "🏬", "thống_lĩnh": "🌟",
  "rèn_luyện": "⚔️", "lập_công": "🎖️", "tuyển_quân": "🪖", "chiến_lược": "🗺️",
  "trở_thành_tướng": "🗡️",
};

interface PlanStep {
  id: string;
  planId: string;
  stepOrder: number;
  actionType: string;
  target: string;
  completed: boolean;
}

interface Goal {
  id: string;
  goalType: string;
  status: string;
}

interface Plan {
  id: string;
  npcId: string;
  goalId: string | null;
  currentStep: number;
  status: string;
  createdAt: string;
  steps: PlanStep[];
  goal: Goal | null;
}

interface NpcWithPlan {
  npc: {
    id: string;
    name: string;
    occupation: string;
    money: number;
    age: number;
    happiness: number;
  };
  plan: Plan | null;
  steps: PlanStep[];
  goal: Goal | null;
}

interface Summary {
  active: number;
  completed: number;
  failed: number;
  totalSteps: number;
  completedSteps: number;
}

function StepBadge({ step, isCurrent }: { step: PlanStep; isCurrent: boolean }) {
  const icon = ACTION_ICONS[step.actionType] ?? "▶";
  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${
      step.completed
        ? "bg-green-500/10 border border-green-400/20"
        : isCurrent
        ? "bg-cyan-500/10 border border-cyan-400/30"
        : "bg-white/3 border border-white/5"
    }`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${
        step.completed ? "bg-green-500/30 text-green-400" : isCurrent ? "bg-cyan-500/30 text-cyan-400" : "bg-white/10 text-white/30"
      }`}>
        {step.completed ? "✓" : `${step.stepOrder + 1}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-mono font-bold ${step.completed ? "text-green-400" : isCurrent ? "text-cyan-400" : "text-white/40"}`}>
          {icon} {step.actionType.replace(/_/g, " ").toUpperCase()}
        </div>
        <div className={`text-xs mt-0.5 ${step.completed ? "text-green-300/60" : isCurrent ? "text-white/60" : "text-white/30"}`}>
          {step.target}
        </div>
      </div>
      {isCurrent && !step.completed && (
        <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-mono flex-shrink-0">HIỆN TẠI</span>
      )}
    </div>
  );
}

function NpcPlanCard({ item }: { item: NpcWithPlan }) {
  const [expanded, setExpanded] = useState(false);
  const { plan, steps, goal, npc } = item;
  const goalMeta = goal ? (GOAL_META[goal.goalType] ?? { label: goal.goalType, icon: "🎯" }) : null;

  const completedCount = steps.filter((s) => s.completed).length;
  const pct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
  const statusColor = !plan ? "text-white/20" : plan.status === "hoàn_thành" ? "text-green-400" : plan.status === "thất_bại" ? "text-red-400" : "text-cyan-400";
  const statusLabel = !plan ? "Chưa có kế hoạch" : plan.status === "hoàn_thành" ? "✓ Hoàn Thành" : plan.status === "thất_bại" ? "✗ Thất Bại" : "⏳ Đang Thực Hiện";

  return (
    <motion.div className="bg-black/60 border border-white/10 rounded-xl overflow-hidden" layout>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-lg">
            {goalMeta?.icon ?? "📋"}
          </div>
          <div className="text-left">
            <div className="text-sm font-mono font-bold text-white">{npc.name}</div>
            <div className="text-xs text-white/40">{npc.occupation} · {npc.age} tuổi</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-xs font-mono font-bold ${statusColor}`}>{statusLabel}</div>
            {plan && steps.length > 0 && (
              <div className="text-xs text-white/30 font-mono">{completedCount}/{steps.length} bước · {pct}%</div>
            )}
            {goalMeta && (
              <div className="text-xs text-purple-400/60 font-mono mt-0.5">{goalMeta.icon} {goalMeta.label}</div>
            )}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3"
        >
          {!plan ? (
            <div className="text-xs text-white/30 text-center py-4 font-mono">
              Chưa có kế hoạch — Bấm "Sinh Kế Hoạch" để tạo từ mục tiêu hiện có
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mb-3">
                <motion.div
                  className={`h-1.5 rounded-full ${
                    plan.status === "hoàn_thành" ? "bg-green-400" :
                    plan.status === "thất_bại" ? "bg-red-400" : "bg-cyan-400"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              {/* Steps */}
              <div className="space-y-1.5">
                {steps.map((step) => (
                  <StepBadge
                    key={step.id}
                    step={step}
                    isCurrent={!step.completed && step.stepOrder === (plan.currentStep ?? 0)}
                  />
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function NpcPlansPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const worldSlug = localStorage.getItem("activeWorldSlug") ?? "cultivation";

  const { data: worldData, isLoading } = useQuery<NpcWithPlan[]>({
    queryKey: ["/api/npc-plans/world", worldSlug],
    queryFn: () => fetch(`/api/npc-plans/world/${worldSlug}`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["/api/npc-plans/summary", worldSlug],
    queryFn: () => fetch(`/api/npc-plans/summary/${worldSlug}`, { credentials: "include" }).then((r) => r.json()),
  });

  const generateMut = useMutation({
    mutationFn: () => fetch(`/api/npc-plans/auto-generate/${worldSlug}`, { method: "POST", credentials: "include" }).then((r) => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/npc-plans/world"] });
      qc.invalidateQueries({ queryKey: ["/api/npc-plans/summary"] });
      toast({ title: "✅ Đã sinh kế hoạch", description: data.message });
    },
    onError: () => toast({ title: "❌ Lỗi", variant: "destructive" }),
  });

  const tickMut = useMutation({
    mutationFn: () => fetch(`/api/npc-plans/tick/${worldSlug}`, { method: "POST", credentials: "include" }).then((r) => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/npc-plans/world"] });
      qc.invalidateQueries({ queryKey: ["/api/npc-plans/summary"] });
      let desc = data.message;
      if (data.completed > 0) desc += ` 🎉 ${data.completed} kế hoạch hoàn thành!`;
      if (data.failed > 0) desc += ` ⚠ ${data.failed} kế hoạch thất bại.`;
      toast({ title: "⏱ Tick kế hoạch xong", description: desc });
    },
    onError: () => toast({ title: "❌ Lỗi", variant: "destructive" }),
  });

  const stepPct = summary && summary.totalSteps > 0
    ? Math.round((summary.completedSteps / summary.totalSteps) * 100) : 0;

  const withPlan = worldData?.filter((d) => d.plan !== null) ?? [];
  const withoutPlan = worldData?.filter((d) => d.plan === null) ?? [];

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-cyan-600/30 border border-purple-500/30 flex items-center justify-center">
            <ListChecks className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold text-purple-400">KẾ HOẠCH NPC</h1>
            <p className="text-xs text-white/40 font-mono">Planning Engine · Từng bước · Điều chỉnh khi thất bại</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Đang thực hiện", value: summary?.active ?? 0,     icon: Clock,        color: "text-cyan-400" },
            { label: "Hoàn thành",     value: summary?.completed ?? 0,  icon: CheckCircle2, color: "text-green-400" },
            { label: "Thất bại",       value: summary?.failed ?? 0,     icon: XCircle,      color: "text-red-400" },
            { label: "Bước xong/tổng", value: `${summary?.completedSteps ?? 0}/${summary?.totalSteps ?? 0}`, icon: Play, color: "text-purple-400" },
          ].map((card, i) => (
            <motion.div
              key={i}
              className="bg-white/5 border border-white/10 rounded-xl p-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <card.icon className={`w-4 h-4 ${card.color} mb-1`} />
              <div className={`text-2xl font-mono font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-white/40">{card.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Overall step progress */}
        {(summary?.totalSteps ?? 0) > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <div className="flex justify-between text-xs font-mono text-white/40 mb-2">
              <span>TIẾN ĐỘ TỔNG TOÀN THẾ GIỚI</span>
              <span className="text-purple-400">{stepPct}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: `${stepPct}%` }}
                transition={{ duration: 1 }}
              />
            </div>
            <div className="text-xs text-white/30 font-mono mt-1">{summary?.completedSteps} / {summary?.totalSteps} bước hoàn thành</div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="bg-purple-500/20 border border-purple-500/40 text-purple-400 hover:bg-purple-500/30 font-mono text-xs"
          >
            {generateMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
            SINH KẾ HOẠCH TỰ ĐỘNG
          </Button>
          <Button
            onClick={() => tickMut.mutate()}
            disabled={tickMut.isPending}
            className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 font-mono text-xs"
          >
            {tickMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            TICK TIẾN ĐỘ KẾ HOẠCH
          </Button>
        </div>

        {/* World indicator */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-white/30 font-mono">THẾ GIỚI:</span>
          <span className="text-xs font-mono text-purple-400 uppercase">{worldSlug}</span>
          {withoutPlan.length > 0 && (
            <span className="text-xs text-yellow-400/60 font-mono">· {withoutPlan.length} NPC chưa có kế hoạch</span>
          )}
        </div>

        {/* NPC plan cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-mono text-sm">Đang tải...</span>
          </div>
        ) : !worldData || worldData.length === 0 ? (
          <div className="text-center py-20">
            <RotateCcw className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 font-mono text-sm">Chưa có NPC nào</p>
            <p className="text-white/20 font-mono text-xs mt-1">Seed NPC tại trang NPC Simulation trước</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* NPCs with active plans first */}
            {withPlan.map((item) => <NpcPlanCard key={item.npc.id} item={item} />)}
            {/* NPCs without plans */}
            {withoutPlan.map((item) => <NpcPlanCard key={item.npc.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}
