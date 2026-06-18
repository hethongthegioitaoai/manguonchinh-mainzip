import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Globe, Loader2, ChevronRight, Zap, AlertTriangle,
  TrendingUp, Users, Briefcase, Star, Shield, Swords,
  RefreshCw, Play, Eye, ChevronDown, ChevronUp, Cpu,
  Sparkles, Clock, CheckCircle2, XCircle, X, Activity,
  Target, MessageSquare, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

/* ════════════════════════════════════════
   TYPES
════════════════════════════════════════ */
interface DashboardLog {
  id: string;
  npcId: string;
  npcName: string;
  npcOccupation: string;
  trigger: string;
  decisionType: string;
  reasoningSummary: string;
  decision: {
    type: string;
    params: Record<string, unknown>;
    reasoning: string;
    explanation: string;
    confidence: number;
  };
  confidence: number;
  actionTaken: boolean;
  generatedBy: "gemini" | "rule-based";
  createdAt: string;
}

interface NpcListItem { id: string; name: string; occupation: string; age: number }

interface AgentDecideResult {
  triggered: boolean;
  reason?: string;
  decision?: {
    type: string;
    params: Record<string, unknown>;
    reasoning: string;
    explanation: string;
    confidence: number;
  };
  actionTaken?: boolean;
  generatedBy?: string;
  crisisLevel?: string;
  logId?: string;
}

interface ScanResult {
  scanned: number;
  triggered: number;
  results: Array<{ npcId: string; npcName: string; triggered: boolean; decisionType: string; crisisLevel: string }>;
}

/* ════════════════════════════════════════
   META
════════════════════════════════════════ */
const DECISION_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  change_job:       { label: "Đổi Nghề",        icon: "💼", color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/30" },
  join_faction:     { label: "Gia Nhập Phe",     icon: "🛡️", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  leave_faction:    { label: "Rời Phe Phái",     icon: "🚪", color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/30" },
  run_for_office:   { label: "Tranh Cử",         icon: "👑", color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/30" },
  invest:           { label: "Đầu Tư",           icon: "💰", color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-400/30" },
  expand_business:  { label: "Mở Rộng KD",       icon: "📈", color: "text-teal-400",    bg: "bg-teal-400/10 border-teal-400/30" },
  declare_goal:     { label: "Mục Tiêu Mới",     icon: "🎯", color: "text-violet-400",  bg: "bg-violet-400/10 border-violet-400/30" },
  make_friend:      { label: "Kết Bạn",          icon: "🤝", color: "text-pink-400",    bg: "bg-pink-400/10 border-pink-400/30" },
  none:             { label: "Quan Sát",          icon: "👁️", color: "text-slate-400",   bg: "bg-slate-400/10 border-slate-400/30" },
};

const TRIGGER_META: Record<string, { label: string; color: string; icon: string }> = {
  crisis:        { label: "Khủng Hoảng",   color: "text-red-400",    icon: "🚨" },
  major_change:  { label: "Thay Đổi Lớn",  color: "text-orange-400", icon: "⚡" },
  strategic:     { label: "Chiến Lược",    color: "text-blue-400",   icon: "🧠" },
  manual:        { label: "Thủ Công",      color: "text-slate-400",  icon: "🖱️" },
  auto:          { label: "Tự Động",       color: "text-violet-400", icon: "🤖" },
};

const CRISIS_META: Record<string, { label: string; color: string; dot: string }> = {
  high:   { label: "Khủng hoảng",  color: "text-red-400",    dot: "bg-red-400 animate-pulse" },
  medium: { label: "Cảnh báo",     color: "text-orange-400", dot: "bg-orange-400" },
  low:    { label: "Cơ hội",       color: "text-blue-400",   dot: "bg-blue-400" },
  none:   { label: "Ổn định",      color: "text-slate-500",  dot: "bg-slate-600" },
};

function confidenceBar(val: number) {
  if (val >= 0.8) return "bg-emerald-400";
  if (val >= 0.6) return "bg-yellow-400";
  if (val >= 0.4) return "bg-orange-400";
  return "bg-red-400";
}

/* ════════════════════════════════════════
   DECISION LOG CARD
════════════════════════════════════════ */
function DecisionCard({ log }: { log: DashboardLog }) {
  const [expanded, setExpanded] = useState(false);
  const meta = DECISION_META[log.decisionType] ?? DECISION_META.none;
  const trig = TRIGGER_META[log.trigger] ?? TRIGGER_META.manual;
  const pct = Math.round(log.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${meta.bg} transition-all`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-3.5">
        <div className="text-xl shrink-0 mt-0.5">{meta.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
            <span className="text-[10px] text-slate-500">{trig.icon} {trig.label}</span>
            {log.generatedBy === "gemini" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-0.5">
                <Sparkles size={8} /> Gemini
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-semibold text-slate-200">{log.npcName}</span>
            <span className="text-[10px] text-slate-500">· {log.npcOccupation}</span>
          </div>
          {log.decision?.explanation && (
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{log.decision.explanation}</p>
          )}
          {/* Confidence bar */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${confidenceBar(log.confidence)}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">{pct}%</span>
            <div className={`shrink-0 ${log.actionTaken ? "text-emerald-400" : "text-slate-500"}`}>
              {log.actionTaken ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[9px] text-slate-600">
            {new Date(log.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-600 hover:text-slate-300 transition-colors mt-1"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded reasoning */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-slate-700/30 pt-3 space-y-3">
              <div>
                <div className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <Brain size={10} /> PHÂN TÍCH CỦA AGENT
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{log.decision?.reasoning || log.reasoningSummary}</p>
              </div>
              {log.decision?.params && Object.keys(log.decision.params).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Target size={10} /> THAM SỐ QUYẾT ĐỊNH
                  </div>
                  <div className="bg-slate-800/60 rounded p-2 font-mono text-[10px] text-slate-300">
                    {Object.entries(log.decision.params).map(([k, v]) => (
                      <div key={k}><span className="text-violet-400">{k}</span>: {String(v)}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════ */
export default function NpcAgentPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [worldSlug, setWorldSlug] = useState("");
  const [worldInput, setWorldInput] = useState("");
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"dashboard" | "npc">("dashboard");

  /* ── Queries ── */
  const dashboardQuery = useQuery<DashboardLog[]>({
    queryKey: ["npc-agent-dashboard", worldSlug],
    queryFn: () => fetch(`/api/npc-agent/dashboard/${worldSlug}`).then(r => r.json()),
    enabled: !!worldSlug,
    refetchInterval: 10000,
  });

  const npcListQuery = useQuery<NpcListItem[]>({
    queryKey: ["npc-dialogue-list", worldSlug],
    queryFn: () => fetch(`/api/npc-dialogue/list/${worldSlug}`).then(r => r.json()),
    enabled: !!worldSlug,
  });

  const npcLogsQuery = useQuery<DashboardLog[]>({
    queryKey: ["npc-agent-logs", selectedNpcId],
    queryFn: () => fetch(`/api/npc-agent/logs/${selectedNpcId}`).then(r => r.json()),
    enabled: !!selectedNpcId && activeTab === "npc",
  });

  /* ── Mutations ── */
  const decideMutation = useMutation<AgentDecideResult, Error, { npcId: string; force?: boolean }>({
    mutationFn: ({ npcId, force }) =>
      fetch(`/api/npc-agent/decide/${npcId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual", force: force ?? true }),
      }).then(r => { if (!r.ok) throw new Error("Lỗi"); return r.json(); }),
    onSuccess: (data) => {
      if (data.triggered && data.decision) {
        const meta = DECISION_META[data.decision.type] ?? DECISION_META.none;
        toast({
          title: `${meta.icon} ${meta.label}`,
          description: data.decision.explanation,
          duration: 5000,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["npc-agent-dashboard", worldSlug] });
      queryClient.invalidateQueries({ queryKey: ["npc-agent-logs", selectedNpcId] });
    },
    onError: () => toast({ title: "Lỗi", description: "Không thể trigger agent", variant: "destructive" }),
  });

  const scanMutation = useMutation<ScanResult, Error>({
    mutationFn: () =>
      fetch(`/api/npc-agent/scan/${worldSlug}`, { method: "POST" }).then(r => {
        if (!r.ok) throw new Error("Lỗi");
        return r.json();
      }),
    onSuccess: (data) => {
      toast({
        title: `🤖 Quét hoàn tất`,
        description: `Đã quét ${data.scanned} NPC, trigger ${data.triggered} quyết định`,
        duration: 4000,
      });
      queryClient.invalidateQueries({ queryKey: ["npc-agent-dashboard", worldSlug] });
    },
    onError: () => toast({ title: "Lỗi", description: "Quét thất bại", variant: "destructive" }),
  });

  const handleLoadWorld = () => {
    const slug = worldInput.trim();
    if (!slug) return;
    setWorldSlug(slug);
    setSelectedNpcId(null);
  };

  const logs = dashboardQuery.data ?? [];
  const npcLogs = npcLogsQuery.data ?? [];

  const filteredLogs = filterType === "all" ? logs : logs.filter(l => l.decisionType === filterType);

  const stats = {
    total: logs.length,
    gemini: logs.filter(l => l.generatedBy === "gemini").length,
    actions: logs.filter(l => l.actionTaken).length,
    crisis: logs.filter(l => l.trigger === "crisis" || l.trigger === "auto").length,
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-slate-700/50 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <Brain size={16} />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide">LLM AGENT LAYER — NPC</h1>
          <p className="text-[10px] text-slate-400">Hệ thống suy luận chiến lược cho NPC</p>
        </div>
        {worldSlug && (
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] text-violet-400 border border-violet-500/30 hover:bg-violet-500/10"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
            >
              {scanMutation.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : <Search size={12} className="mr-1" />}
              Quét Toàn Bộ
            </Button>
            <button onClick={() => { setWorldSlug(""); setWorldInput(""); }} className="text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* World selector */}
      {!worldSlug && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center space-y-3 mb-6">
              <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center mx-auto">
                <Cpu size={32} className="text-violet-400" />
              </div>
              <h2 className="text-lg font-bold">LLM Agent Layer</h2>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Biến NPC từ rule-based thành hệ thống suy luận thông minh — quyết định dựa trên tính cách, cảm xúc, mục tiêu và tình hình thực tế
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                value={worldInput}
                onChange={e => setWorldInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLoadWorld()}
                placeholder="Nhập world slug..."
                className="bg-slate-800 border-slate-600 text-slate-100"
              />
              <Button onClick={handleLoadWorld} className="bg-violet-600 hover:bg-violet-700 shrink-0">
                <ChevronRight size={16} />
              </Button>
            </div>
            {/* Feature preview */}
            <div className="grid grid-cols-2 gap-2.5 text-[11px]">
              {[
                { icon: "🧠", label: "Suy luận với Gemini AI" },
                { icon: "⚡", label: "Rule engine khi không có AI" },
                { icon: "🎯", label: "8 loại quyết định chiến lược" },
                { icon: "📊", label: "Dashboard theo dõi realtime" },
                { icon: "🔍", label: "Quét khủng hoảng tự động" },
                { icon: "📝", label: "Lưu lịch sử suy luận" },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/50">
                  <span>{f.icon}</span>
                  <span className="text-slate-400">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {worldSlug && (
        <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
          {/* Sidebar — NPC list */}
          <div className="w-48 shrink-0 bg-slate-800/50 border-r border-slate-700/50 flex flex-col">
            <div className="p-2.5 border-b border-slate-700/50">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Nhân Vật</div>
              <p className="text-[9px] text-slate-500 font-mono truncate">{worldSlug}</p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {npcListQuery.isLoading && (
                <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-violet-400" /></div>
              )}
              {npcListQuery.data?.map(npc => {
                const hasLog = logs.some(l => l.npcId === npc.id);
                const lastLog = logs.find(l => l.npcId === npc.id);
                const decMeta = lastLog ? (DECISION_META[lastLog.decisionType] ?? DECISION_META.none) : null;
                return (
                  <button
                    key={npc.id}
                    onClick={() => { setSelectedNpcId(npc.id); setActiveTab("npc"); }}
                    className={`w-full text-left px-3 py-2 transition-colors hover:bg-slate-700/50 ${
                      selectedNpcId === npc.id && activeTab === "npc" ? "bg-violet-600/20 border-l-2 border-violet-500" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-200 truncate flex-1">{npc.name}</span>
                      {decMeta && <span className="text-[11px] shrink-0">{decMeta.icon}</span>}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{npc.occupation}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Tabs */}
            <div className="flex items-center gap-0 border-b border-slate-700/50 bg-slate-800/30">
              {[
                { id: "dashboard", label: "Dashboard", icon: <Activity size={12} /> },
                { id: "npc", label: selectedNpcId ? (npcListQuery.data?.find(n => n.id === selectedNpcId)?.name ?? "NPC") : "Chi Tiết NPC", icon: <Brain size={12} /> },
              ].map(tab => (
                <button key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "text-violet-400 border-violet-500"
                      : "text-slate-500 border-transparent hover:text-slate-300"
                  }`}>
                  {tab.icon}{tab.label}
                </button>
              ))}
              <div className="ml-auto px-3 flex items-center gap-1.5">
                {dashboardQuery.isFetching && <Loader2 size={12} className="animate-spin text-slate-500" />}
                <button onClick={() => queryClient.invalidateQueries({ queryKey: ["npc-agent-dashboard", worldSlug] })}
                  className="text-slate-600 hover:text-slate-300 p-1">
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>

            {/* Dashboard tab */}
            {activeTab === "dashboard" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-2.5">
                  {[
                    { label: "Tổng quyết định", value: stats.total, icon: <Brain size={14} />, color: "text-violet-400" },
                    { label: "Đã thực thi",     value: stats.actions, icon: <CheckCircle2 size={14} />, color: "text-emerald-400" },
                    { label: "Dùng Gemini",     value: stats.gemini, icon: <Sparkles size={14} />, color: "text-blue-400" },
                    { label: "Từ khủng hoảng", value: stats.crisis, icon: <AlertTriangle size={14} />, color: "text-red-400" },
                  ].map(stat => (
                    <div key={stat.label} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
                      <div className={`${stat.color} mb-1`}>{stat.icon}</div>
                      <div className="text-xl font-bold text-slate-100">{stat.value}</div>
                      <div className="text-[10px] text-slate-500">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Filter */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 mr-1">Lọc:</span>
                  {["all", ...Object.keys(DECISION_META)].map(type => {
                    const meta = DECISION_META[type];
                    const count = type === "all" ? logs.length : logs.filter(l => l.decisionType === type).length;
                    if (type !== "all" && count === 0) return null;
                    return (
                      <button key={type}
                        onClick={() => setFilterType(type)}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                          filterType === type
                            ? "bg-violet-600/30 border-violet-500 text-violet-300"
                            : "border-slate-700 text-slate-500 hover:text-slate-300"
                        }`}>
                        {meta?.icon ?? "📋"} {meta?.label ?? "Tất Cả"} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Logs */}
                {dashboardQuery.isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-violet-400" /></div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <div className="w-14 h-14 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto">
                      <Brain size={24} className="text-slate-600" />
                    </div>
                    <p className="text-sm text-slate-500">Chưa có quyết định nào được ghi nhận</p>
                    <p className="text-xs text-slate-600">Chọn một NPC và nhấn "Trigger Agent" hoặc "Quét Toàn Bộ"</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredLogs.map(log => <DecisionCard key={log.id} log={log} />)}
                  </div>
                )}
              </div>
            )}

            {/* NPC Detail tab */}
            {activeTab === "npc" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!selectedNpcId ? (
                  <div className="text-center py-16 space-y-2">
                    <Brain size={28} className="text-slate-600 mx-auto" />
                    <p className="text-sm text-slate-500">Chọn một NPC từ danh sách bên trái</p>
                  </div>
                ) : (
                  <>
                    {/* NPC action bar */}
                    <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-3.5 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">
                          {npcListQuery.data?.find(n => n.id === selectedNpcId)?.name ?? "NPC"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {npcListQuery.data?.find(n => n.id === selectedNpcId)?.occupation}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline"
                          className="h-8 text-[11px] border-slate-600 text-slate-300 hover:bg-slate-700"
                          onClick={() => queryClient.invalidateQueries({ queryKey: ["npc-agent-logs", selectedNpcId] })}>
                          <RefreshCw size={12} className="mr-1" /> Làm mới
                        </Button>
                        <Button size="sm"
                          className="h-8 text-[11px] bg-violet-600 hover:bg-violet-700"
                          onClick={() => decideMutation.mutate({ npcId: selectedNpcId, force: true })}
                          disabled={decideMutation.isPending}>
                          {decideMutation.isPending
                            ? <><Loader2 size={12} className="animate-spin mr-1" /> Đang suy luận...</>
                            : <><Brain size={12} className="mr-1" /> Trigger Agent</>}
                        </Button>
                      </div>
                    </div>

                    {/* NPC logs */}
                    {npcLogsQuery.isLoading ? (
                      <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-violet-400" /></div>
                    ) : npcLogs.length === 0 ? (
                      <div className="text-center py-12 space-y-2">
                        <Clock size={24} className="text-slate-600 mx-auto" />
                        <p className="text-sm text-slate-500">NPC này chưa có lịch sử quyết định</p>
                        <p className="text-[11px] text-slate-600">Nhấn "Trigger Agent" để bắt đầu suy luận lần đầu</p>
                      </div>
                    ) : (
                      <>
                        {/* Timeline */}
                        <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
                          <Clock size={11} /> LỊCH SỬ SUY LUẬN ({npcLogs.length} lần)
                        </div>
                        <div className="space-y-2.5">
                          {npcLogs.map((log, i) => (
                            <div key={log.id} className="flex gap-3">
                              {/* Timeline line */}
                              <div className="flex flex-col items-center shrink-0">
                                <div className={`w-2.5 h-2.5 rounded-full ${i === 0 ? "bg-violet-400" : "bg-slate-600"} mt-1.5 shrink-0`} />
                                {i < npcLogs.length - 1 && <div className="w-0.5 flex-1 bg-slate-700/50 mt-1" />}
                              </div>
                              <div className="flex-1 pb-3">
                                <DecisionCard log={log} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar — quick scan results */}
          {scanMutation.data && (
            <div className="w-56 shrink-0 bg-slate-800/50 border-l border-slate-700/50 flex flex-col">
              <div className="p-2.5 border-b border-slate-700/50 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Kết Quả Quét</span>
                <button onClick={() => scanMutation.reset()} className="text-slate-600 hover:text-slate-300"><X size={12} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                <div className="text-xs text-slate-400 px-1 pb-1">
                  Đã quét <span className="text-white font-bold">{scanMutation.data.scanned}</span> NPC,
                  trigger <span className="text-violet-400 font-bold">{scanMutation.data.triggered}</span> quyết định
                </div>
                {scanMutation.data.results.map(r => {
                  const crisis = CRISIS_META[r.crisisLevel] ?? CRISIS_META.none;
                  const dec = DECISION_META[r.decisionType] ?? DECISION_META.none;
                  return (
                    <div key={r.npcId} className={`flex items-center gap-2 p-2 rounded-lg text-[10px] ${r.triggered ? "bg-violet-600/10 border border-violet-500/20" : "bg-slate-700/20"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${crisis.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-300 font-medium truncate">{r.npcName}</div>
                        <div className={`${r.triggered ? dec.color : "text-slate-600"}`}>
                          {r.triggered ? `${dec.icon} ${dec.label}` : "Ổn định"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
