import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Target, TrendingUp, CheckCircle2, Clock, Loader2, RefreshCw, Zap, ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const GOAL_META: Record<string, { label: string; icon: string; color: string }> = {
  "làm_giàu":              { label: "Làm Giàu",              icon: "💰", color: "text-yellow-400" },
  "mua_nhà":               { label: "Mua Nhà",               icon: "🏠", color: "text-cyan-400" },
  "lập_gia_đình":          { label: "Lập Gia Đình",          icon: "👨‍👩‍👧", color: "text-pink-400" },
  "tham_gia_phe_phái":     { label: "Tham Gia Phe Phái",     icon: "⚔️", color: "text-purple-400" },
  "trở_thành_lãnh_đạo":   { label: "Trở Thành Lãnh Đạo",   icon: "👑", color: "text-amber-400" },
  "mở_rộng_kinh_doanh":   { label: "Mở Rộng Kinh Doanh",   icon: "📈", color: "text-green-400" },
  "trở_thành_tướng_lĩnh": { label: "Trở Thành Tướng Lĩnh", icon: "🗡️", color: "text-red-400" },
};

interface Goal {
  id: string;
  npcId: string;
  goalType: string;
  targetValue: number;
  progress: number;
  priority: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface NpcWithGoals {
  npc: {
    id: string;
    name: string;
    occupation: string;
    money: number;
    age: number;
    happiness: number;
    worldSlug: string;
  };
  goals: Goal[];
}

interface Summary {
  total: number;
  active: number;
  completed: number;
  byType: Record<string, number>;
}

function ProgressBar({ progress, target, status }: { progress: number; target: number; status: string }) {
  const pct = Math.min(100, Math.round((progress / target) * 100));
  const color = status === "completed" ? "bg-green-400" : pct > 66 ? "bg-cyan-400" : pct > 33 ? "bg-yellow-400" : "bg-red-400/80";
  return (
    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
      <motion.div
        className={`h-2 rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8 }}
      />
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const meta = GOAL_META[goal.goalType] ?? { label: goal.goalType, icon: "🎯", color: "text-cyan-400" };
  const pct = Math.min(100, Math.round((goal.progress / goal.targetValue) * 100));
  const priorityStars = "★".repeat(goal.priority) + "☆".repeat(Math.max(0, 3 - goal.priority));

  return (
    <div className={`bg-white/5 border rounded-lg p-3 space-y-2 ${goal.status === "completed" ? "border-green-400/40" : "border-white/10"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <span className={`text-sm font-mono font-bold ${meta.color}`}>{meta.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-yellow-400/70">{priorityStars}</span>
          {goal.status === "completed" ? (
            <span className="text-xs bg-green-500/20 text-green-400 border border-green-400/30 px-2 py-0.5 rounded font-mono">✓ XONG</span>
          ) : (
            <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-400/20 px-2 py-0.5 rounded font-mono">ĐANG THỰC HIỆN</span>
          )}
        </div>
      </div>
      <ProgressBar progress={goal.progress} target={goal.targetValue} status={goal.status} />
      <div className="flex justify-between text-xs text-white/40 font-mono">
        <span>{goal.progress.toLocaleString()} / {goal.targetValue.toLocaleString()}</span>
        <span className="text-cyan-400/70">{pct}%</span>
      </div>
    </div>
  );
}

function NpcGoalCard({ item }: { item: NpcWithGoals }) {
  const [expanded, setExpanded] = useState(false);
  const activeGoals = item.goals.filter((g) => g.status === "active");
  const completedGoals = item.goals.filter((g) => g.status === "completed");
  const topGoal = activeGoals[0];
  const meta = topGoal ? (GOAL_META[topGoal.goalType] ?? { label: topGoal.goalType, icon: "🎯", color: "text-cyan-400" }) : null;

  return (
    <motion.div
      className="bg-black/60 border border-white/10 rounded-xl overflow-hidden"
      layout
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-lg">
            {meta?.icon ?? "👤"}
          </div>
          <div className="text-left">
            <div className="text-sm font-mono font-bold text-white">{item.npc.name}</div>
            <div className="text-xs text-white/40">{item.npc.occupation} · {item.npc.age} tuổi</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            {meta && topGoal && (
              <div className={`text-xs font-mono ${meta.color}`}>{meta.icon} {meta.label}</div>
            )}
            <div className="text-xs text-white/30 font-mono">
              {activeGoals.length} đang theo đuổi · {completedGoals.length} đã đạt
            </div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3"
        >
          {item.goals.length === 0 ? (
            <div className="text-xs text-white/30 text-center py-3 font-mono">Chưa có mục tiêu nào — Bấm "Sinh Mục Tiêu"</div>
          ) : (
            item.goals
              .sort((a, b) => b.priority - a.priority || (a.status === "completed" ? 1 : -1))
              .map((goal) => <GoalCard key={goal.id} goal={goal} />)
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function NpcLongTermGoalsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const worldSlug = localStorage.getItem("activeWorldSlug") ?? "cultivation";

  const { data: worldData, isLoading: loadingWorld } = useQuery<NpcWithGoals[]>({
    queryKey: ["/api/npc-goals/world", worldSlug],
    queryFn: () => fetch(`/api/npc-goals/world/${worldSlug}`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["/api/npc-goals/summary", worldSlug],
    queryFn: () => fetch(`/api/npc-goals/summary/${worldSlug}`, { credentials: "include" }).then((r) => r.json()),
  });

  const generateMut = useMutation({
    mutationFn: () => fetch(`/api/npc-goals/auto-generate/${worldSlug}`, { method: "POST", credentials: "include" }).then((r) => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/npc-goals/world"] });
      qc.invalidateQueries({ queryKey: ["/api/npc-goals/summary"] });
      toast({ title: "✅ Đã sinh mục tiêu", description: data.message });
    },
    onError: () => toast({ title: "❌ Lỗi", variant: "destructive" }),
  });

  const tickMut = useMutation({
    mutationFn: () => fetch(`/api/npc-goals/tick/${worldSlug}`, { method: "POST", credentials: "include" }).then((r) => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/npc-goals/world"] });
      qc.invalidateQueries({ queryKey: ["/api/npc-goals/summary"] });
      let desc = data.message;
      if (data.completed > 0) desc += ` 🎉 ${data.completed} mục tiêu hoàn thành!`;
      toast({ title: "⏱ Tick mục tiêu xong", description: desc });
    },
    onError: () => toast({ title: "❌ Lỗi", variant: "destructive" }),
  });

  const goalTypeNames = Object.entries(summary?.byType ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-purple-600/30 border border-cyan-500/30 flex items-center justify-center">
            <Target className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold text-cyan-400">MỤC TIÊU DÀI HẠN NPC</h1>
            <p className="text-xs text-white/40 font-mono">Tham vọng · Hành trình · Thành tựu</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Tổng mục tiêu", value: summary?.total ?? 0, icon: Target, color: "text-cyan-400" },
            { label: "Đang thực hiện", value: summary?.active ?? 0, icon: Clock, color: "text-yellow-400" },
            { label: "Đã hoàn thành", value: summary?.completed ?? 0, icon: CheckCircle2, color: "text-green-400" },
            { label: "Số NPC", value: worldData?.length ?? 0, icon: TrendingUp, color: "text-purple-400" },
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

        {/* Goal type distribution */}
        {goalTypeNames.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <h2 className="text-xs font-mono text-white/40 mb-3">PHÂN BỐ LOẠI MỤC TIÊU</h2>
            <div className="flex flex-wrap gap-2">
              {goalTypeNames.map(([type, cnt]) => {
                const meta = GOAL_META[type] ?? { label: type, icon: "🎯", color: "text-white" };
                return (
                  <div key={type} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                    <span>{meta.icon}</span>
                    <span className={`text-xs font-mono ${meta.color}`}>{meta.label}</span>
                    <span className="text-xs text-white/30 font-mono">×{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 font-mono text-xs"
          >
            {generateMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
            SINH MỤC TIÊU TỰ ĐỘNG
          </Button>
          <Button
            onClick={() => tickMut.mutate()}
            disabled={tickMut.isPending}
            className="bg-purple-500/20 border border-purple-500/40 text-purple-400 hover:bg-purple-500/30 font-mono text-xs"
          >
            {tickMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            TICK TIẾN ĐỘ
          </Button>
        </div>

        {/* World slug indicator */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-white/30 font-mono">THẾ GIỚI:</span>
          <span className="text-xs font-mono text-cyan-400 uppercase">{worldSlug}</span>
        </div>

        {/* NPC goal cards */}
        {loadingWorld ? (
          <div className="flex items-center justify-center py-20 gap-2 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-mono text-sm">Đang tải...</span>
          </div>
        ) : !worldData || worldData.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 font-mono text-sm">Chưa có dữ liệu NPC</p>
            <p className="text-white/20 font-mono text-xs mt-1">Seed NPC tại trang NPC Simulation trước</p>
          </div>
        ) : (
          <div className="space-y-3">
            {worldData.map((item) => (
              <NpcGoalCard key={item.npc.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
