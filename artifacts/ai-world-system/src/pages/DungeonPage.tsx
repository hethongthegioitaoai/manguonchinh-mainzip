import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Sword, Shield, Zap, SkipForward, Skull, Trophy, ChevronRight, Star } from "lucide-react";

interface Dungeon { id: string; name: string; description: string; difficulty: string; floors: number; minLevel: number; rewardMultiplier: number; icon: string; worldSlug: string; }
interface DungeonRun { id: string; dungeonId: string; currentFloor: number; hpRemaining: number; status: string; loot: any[]; totalExpGained: number; completedFloors: number; startedAt: string; }
interface Enemy { name: string; hp: number; maxHp: number; atk: number; isBoss: boolean; level: number; }
interface Character { id: string; level: number; maxHp: number; }

const DIFF_META: Record<string, { label: string; color: string; bg: string }> = {
  easy:   { label: "Dễ",   color: "#22c55e", bg: "#15803d20" },
  normal: { label: "Vừa",  color: "#f97316", bg: "#c2410c20" },
  hard:   { label: "Khó",  color: "#ef4444", bg: "#b91c1c20" },
};

export default function DungeonPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [activeRun, setActiveRun] = useState<DungeonRun | null>(null);
  const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: charData } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
    queryFn: async () => { const r = await fetch("/api/characters", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
  });
  const char = charData?.[0];

  const { data: activeRunData } = useQuery({
    queryKey: ["/api/dungeon/active"],
    queryFn: async () => { const r = await fetch("/api/dungeon/active", { credentials: "include" }); if (!r.ok) throw new Error(); return r.json(); },
    onSuccess: (data: any) => {
      if (data.activeRun) { setActiveRun(data.activeRun); setCurrentEnemy(data.currentEnemy); }
    },
  });

  const { data: dungeonListData } = useQuery({
    queryKey: ["/api/dungeon/list", char ? (char as any)?.stats?.world_slug ?? "cultivation" : "cultivation"],
    queryFn: async () => {
      const worldSlug = (char as any)?.stats?.world_slug ?? "cultivation";
      const r = await fetch(`/api/dungeon/list/${worldSlug}`, { credentials: "include" });
      if (!r.ok) throw new Error(); return r.json();
    },
    enabled: !!char,
  });

  const { data: historyData } = useQuery({
    queryKey: ["/api/dungeon/history", char?.id],
    queryFn: async () => { const r = await fetch(`/api/dungeon/history/${char!.id}`, { credentials: "include" }); if (!r.ok) return { runs: [] }; return r.json(); },
    enabled: !!char?.id && showHistory,
  });

  const startMutation = useMutation({
    mutationFn: async (dungeonId: string) => {
      const r = await fetch(`/api/dungeon/start/${dungeonId}`, { method: "POST", credentials: "include" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (data) => {
      setActiveRun(data.run); setCurrentEnemy(data.currentEnemy);
      setBattleLog([`⚔️ Bước vào ${data.dungeon.name}`, `👾 Kẻ thù tầng 1: ${data.currentEnemy.name} (HP: ${data.currentEnemy.hp})`]);
      toast.success(`Vào ${data.dungeon.name}!`);
      queryClient.invalidateQueries({ queryKey: ["/api/dungeon/active"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const advanceMutation = useMutation({
    mutationFn: async ({ runId, action }: { runId: string; action: string }) => {
      const r = await fetch("/api/dungeon/advance", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId, action }) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (data) => {
      const newLogs = [...battleLog, `⚔️ ${data.message}`];
      if (data.lootItem) newLogs.push(`${data.lootItem.icon} Nhặt được: ${data.lootItem.itemName} (${data.lootItem.rarity})`);
      if (data.expGained) newLogs.push(`✨ +${data.expGained} EXP`);
      setBattleLog(newLogs.slice(-10));

      if (data.result === "dead") {
        toast.error("Nhân vật đã ngã! Run kết thúc."); setActiveRun(null); setCurrentEnemy(null);
      } else if (data.result === "completed") {
        toast.success(data.message); setActiveRun(null); setCurrentEnemy(null);
        queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      } else if (data.result === "fled") {
        toast("Bỏ chạy thành công."); setActiveRun(null); setCurrentEnemy(null);
      } else if (data.result === "advance") {
        setCurrentEnemy(data.nextEnemy);
        setActiveRun(prev => prev ? { ...prev, currentFloor: data.nextFloor, hpRemaining: data.hpRemaining, completedFloors: data.completedFloors } : null);
        newLogs.push(`🚪 Vào tầng ${data.nextFloor}: ${data.nextEnemy.name} (HP: ${data.nextEnemy.hp})`);
        setBattleLog(newLogs.slice(-10));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dungeon/active"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const dungeonList: Dungeon[] = dungeonListData?.dungeons ?? [];
  const maxHp = char ? 100 + (char.level - 1) * 10 : 100;
  const hpPct = activeRun ? Math.max(0, (activeRun.hpRemaining / maxHp) * 100) : 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950 to-black text-slate-100">
      <div className="sticky top-0 z-10 border-b border-slate-800/60 bg-black/60 backdrop-blur-md">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="font-bold text-lg text-red-400 flex items-center gap-2">
            <Skull className="w-5 h-5" /> NGỤC TỐI
          </h1>
          <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            {showHistory ? "Dungeon" : "Lịch sử"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-5">

        {/* Active run UI */}
        {activeRun && currentEnemy && (
          <div className="rounded-xl border border-red-700/50 bg-red-950/10 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-red-300 text-sm">⚔️ ĐANG CHIẾN — Tầng {activeRun.currentFloor}</p>
              <p className="font-mono text-xs text-slate-500">Đã qua: {activeRun.completedFloors} tầng</p>
            </div>

            {/* HP bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">HP Nhân Vật</span>
                <span className={hpPct < 30 ? "text-red-400 font-bold" : "text-green-400"}>{activeRun.hpRemaining}/{maxHp}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <motion.div className={`h-full rounded-full transition-all ${hpPct < 30 ? "bg-red-500" : hpPct < 60 ? "bg-yellow-500" : "bg-green-500"}`}
                  animate={{ width: `${hpPct}%` }} />
              </div>
            </div>

            {/* Enemy */}
            <div className={`rounded-xl border p-3 ${currentEnemy.isBoss ? "border-orange-600/50 bg-orange-950/20" : "border-slate-700/40 bg-slate-900/20"}`}>
              <p className={`font-bold text-sm mb-1 ${currentEnemy.isBoss ? "text-orange-300" : "text-slate-200"}`}>{currentEnemy.name}</p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Cấp {currentEnemy.level}</span>
                <span>HP: {currentEnemy.hp}</span>
                <span>ATK: {currentEnemy.atk}</span>
                {currentEnemy.isBoss && <span className="text-orange-400 font-bold">👹 BOSS</span>}
              </div>
            </div>

            {/* Battle actions */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => advanceMutation.mutate({ runId: activeRun.id, action: "fight" })}
                disabled={advanceMutation.isPending}
                className="rounded-xl border border-red-600/50 bg-red-900/30 py-2.5 font-bold text-red-300 text-sm hover:bg-red-800/40 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {advanceMutation.isPending ? <div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" /> : <Sword className="w-4 h-4" />}
                Chiến Đấu
              </button>
              <button onClick={() => advanceMutation.mutate({ runId: activeRun.id, action: "flee" })}
                disabled={advanceMutation.isPending}
                className="rounded-xl border border-slate-700/40 bg-slate-900/20 py-2.5 text-slate-400 text-sm hover:text-slate-200 hover:bg-slate-800/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                <SkipForward className="w-4 h-4" /> Bỏ Chạy
              </button>
            </div>

            {/* Battle log */}
            <div className="rounded-xl border border-slate-800/40 bg-black/30 p-3 max-h-32 overflow-y-auto space-y-0.5">
              {battleLog.length === 0 ? <p className="text-xs text-slate-600">...</p> :
                battleLog.map((log, i) => <p key={i} className="text-xs text-slate-400 font-mono">{log}</p>)
              }
            </div>

            {/* Loot collected */}
            {(activeRun.loot as any[])?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Đã thu thập</p>
                <div className="flex flex-wrap gap-1.5">
                  {(activeRun.loot as any[]).map((l: any, i: number) => (
                    <span key={i} className="rounded-lg border border-slate-700/40 bg-slate-900/30 px-2 py-0.5 text-xs text-slate-400">
                      {l.icon} {l.itemName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History view */}
        {showHistory && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Lịch Sử Run</h2>
            {!historyData?.runs?.length ? (
              <div className="rounded-xl border border-slate-700/30 bg-slate-900/20 p-6 text-center text-slate-500 text-sm">Chưa có lịch sử</div>
            ) : (
              <div className="space-y-2">
                {historyData.runs.map((run: any) => (
                  <div key={run.id} className={`rounded-xl border p-3 flex items-center justify-between ${
                    run.status === "completed" ? "border-green-700/30 bg-green-950/10" :
                    run.status === "dead" ? "border-red-700/30 bg-red-950/10" :
                    "border-slate-700/30 bg-slate-900/20"
                  }`}>
                    <div>
                      <p className="font-bold text-sm text-slate-200">{run.dungeonIcon} {run.dungeonName}</p>
                      <p className="text-xs text-slate-500">{new Date(run.startedAt).toLocaleDateString("vi-VN")}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${run.status === "completed" ? "text-green-400" : run.status === "dead" ? "text-red-400" : "text-slate-500"}`}>
                        {run.status === "completed" ? "✅ Hoàn thành" : run.status === "dead" ? "💀 Ngã xuống" : run.status === "fled" ? "🏃 Bỏ chạy" : "⏳ Đang dở"}
                      </p>
                      <p className="text-xs text-slate-500">Tầng {run.completedFloors} | +{run.totalExpGained} EXP</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Dungeon list */}
        {!showHistory && !activeRun && (
          <>
            {!char && (
              <div className="rounded-xl border border-slate-700/30 bg-slate-900/20 p-6 text-center text-slate-500">
                <Skull className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Cần tạo nhân vật trước</p>
              </div>
            )}

            {char && dungeonList.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
              </div>
            )}

            {dungeonList.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Chọn Ngục Tối</h2>
                {dungeonList.map((d, i) => {
                  const diff = DIFF_META[d.difficulty] ?? DIFF_META.normal;
                  const locked = char ? char.level < d.minLevel : true;
                  return (
                    <motion.div key={d.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      onClick={() => !locked && startMutation.mutate(d.id)}
                      className={`rounded-xl border p-4 transition-all ${locked ? "opacity-40 cursor-not-allowed border-slate-800/30 bg-slate-900/10" : "cursor-pointer hover:scale-[1.01]"}`}
                      style={!locked ? { borderColor: `${diff.color}40`, backgroundColor: diff.bg } : {}}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{d.icon}</span>
                          <div>
                            <p className="font-bold text-slate-100">{d.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{d.description}</p>
                          </div>
                        </div>
                        {!locked && <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />}
                      </div>
                      <div className="flex items-center gap-3 mt-3 text-xs">
                        <span className="rounded-full px-2 py-0.5 border font-bold" style={{ color: diff.color, borderColor: `${diff.color}50`, backgroundColor: `${diff.color}15` }}>{diff.label}</span>
                        <span className="text-slate-500">{d.floors} tầng</span>
                        <span className="text-slate-500">Cấp {d.minLevel}+</span>
                        <span className="text-yellow-600">×{d.rewardMultiplier} EXP</span>
                        {locked && <span className="text-red-500 ml-auto">🔒 Cần cấp {d.minLevel}</span>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
