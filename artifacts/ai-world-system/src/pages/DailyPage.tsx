import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Gift, Flame, CheckCircle2 } from "lucide-react";

interface DayReward {
  day: number; type: string; amount: number; label: string; icon: string; rarity?: string; current: boolean;
}
interface DailyStatus {
  claimed: boolean; streak: number;
  todayReward: DayReward & { day: number };
  calendar: DayReward[];
}

export default function DailyPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<DailyStatus>({
    queryKey: ["/api/daily/status"],
    queryFn: async () => {
      const r = await fetch("/api/daily/status", { credentials: "include" });
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/daily/claim", { method: "POST", credentials: "include" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily/status"] });
      toast.success(`${result.reward.icon} ${result.message} — ${result.reward.label}`);
      if (result.streak % 7 === 0) toast.success("🎉 Hoàn thành 7 ngày liên tiếp!");
    },
    onError: (err: any) => toast.error(err.message ?? "Lỗi nhận thưởng"),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-950 via-slate-950 to-black text-slate-100">
      <div className="sticky top-0 z-10 border-b border-slate-800/60 bg-black/60 backdrop-blur-md">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="font-bold text-lg text-amber-400 flex items-center gap-2">
            <Gift className="w-5 h-5" /> ĐIỂM DANH HẰNG NGÀY
          </h1>
          <div className="w-20" />
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-6 space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          </div>
        )}

        {data && (
          <>
            {/* Streak info */}
            <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-5 text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Flame className="w-6 h-6 text-orange-400" />
                <span className="font-mono font-bold text-3xl text-orange-400">{data.streak}</span>
                <Flame className="w-6 h-6 text-orange-400" />
              </div>
              <p className="text-sm text-slate-400">
                {data.streak === 1 ? "Ngày đầu tiên — chào mừng trở lại!" : `Chuỗi ${data.streak} ngày liên tiếp!`}
              </p>
              {data.streak >= 7 && (
                <p className="text-xs text-amber-400">🎉 Đã hoàn thành {Math.floor(data.streak / 7)} tuần liên tiếp!</p>
              )}
            </div>

            {/* 7-day calendar */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Lịch 7 Ngày</h2>
              <div className="grid grid-cols-7 gap-1.5">
                {data.calendar.map((day) => {
                  const isPast = data.streak % 7 > day.day || (data.streak % 7 === 0 && data.claimed);
                  const isCurrent = day.current;
                  const isClaimed = isCurrent && data.claimed;
                  return (
                    <motion.div key={day.day}
                      animate={isCurrent && !isClaimed ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className={`rounded-xl border p-2 text-center flex flex-col items-center gap-1 transition-all ${
                        isClaimed ? "border-green-700/50 bg-green-950/20" :
                        isCurrent ? "border-amber-500/60 bg-amber-950/30" :
                        isPast ? "border-slate-700/30 bg-slate-900/20 opacity-70" :
                        "border-slate-800/30 bg-slate-900/10 opacity-40"
                      }`}>
                      <span className="text-xs text-slate-500 font-mono">N{day.day}</span>
                      <span className="text-lg">{isClaimed ? "✅" : day.icon}</span>
                      <span className="text-xs text-slate-600 leading-tight text-center">{day.label}</span>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            {/* Today's reward & claim */}
            <div className="rounded-xl border border-amber-600/40 bg-amber-950/20 p-5 space-y-4">
              <div className="text-center space-y-1">
                <p className="text-xs text-slate-500 uppercase tracking-widest">Phần Thưởng Hôm Nay</p>
                <p className="text-4xl">{data.todayReward.icon}</p>
                <p className="font-bold text-amber-300 text-lg">{data.todayReward.label}</p>
                {data.todayReward.rarity && (
                  <p className="text-xs text-slate-500">
                    {data.todayReward.rarity === "rare" ? "🔵 Vật phẩm hiếm ngẫu nhiên" : "⚪ Vật phẩm thường ngẫu nhiên"}
                  </p>
                )}
              </div>

              {data.claimed ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-green-700/40 bg-green-950/20 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="font-bold text-green-400">Đã nhận hôm nay</span>
                </div>
              ) : (
                <button
                  onClick={() => claimMutation.mutate()}
                  disabled={claimMutation.isPending}
                  className="w-full rounded-xl border border-amber-600/60 bg-amber-900/40 py-3.5 font-bold text-amber-300 text-base hover:bg-amber-800/50 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {claimMutation.isPending
                    ? <><div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" /> Đang nhận...</>
                    : <><Gift className="w-5 h-5" /> NHẬN THƯỞNG HÔM NAY</>
                  }
                </button>
              )}
            </div>

            {/* Tip */}
            <div className="rounded-xl border border-slate-700/30 bg-slate-900/20 p-4 text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-400">💡 Mẹo</p>
              <p>• Đăng nhập mỗi ngày để duy trì chuỗi streak</p>
              <p>• Ngày 5 và 7 nhận được vật phẩm — đừng bỏ lỡ!</p>
              <p>• Mất streak nếu quên 1 ngày — nhưng có thể bắt đầu lại</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
