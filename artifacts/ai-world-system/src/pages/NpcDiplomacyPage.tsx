import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft, RefreshCw, Loader2, Handshake, Shield, Sword,
  Zap, ScrollText, BarChart3, ChevronDown, ChevronUp,
  Users, AlertTriangle, CheckCircle2, Globe,
} from "lucide-react";

interface Government { id: string; govType: string; treasury: number; approvalRate: number; }
interface Relation {
  id: string; governmentAId: string; governmentBId: string;
  relationScore: number; relationType: string; updatedAt: string;
}
interface Treaty {
  id: string; governmentAId: string; governmentBId: string;
  treatyType: string; status: string; startDate: string; endDate: string | null;
}
interface Memory {
  id: string; governmentId: string; targetGovId: string | null;
  event: string; scoreChange: number; createdAt: string;
}
interface ActionMeta { id: string; label: string; icon: string; scoreChange: number; color: string; }
interface RelTypeMeta { id: string; label: string; color: string; icon: string; }
interface TreatyTypeMeta { id: string; label: string; icon: string; }

const REL_TYPE_META: Record<string, RelTypeMeta> = {
  "đồng_minh":   { id:"đồng_minh",  label:"Đồng Minh",  color:"#22c55e", icon:"🟢" },
  "thân_thiện":  { id:"thân_thiện", label:"Thân Thiện",  color:"#06b6d4", icon:"🔵" },
  "trung_lập":   { id:"trung_lập",  label:"Trung Lập",   color:"#9ca3af", icon:"⚪" },
  "căng_thẳng":  { id:"căng_thẳng", label:"Căng Thẳng",  color:"#f59e0b", icon:"🟡" },
  "thù_địch":    { id:"thù_địch",   label:"Thù Địch",    color:"#ef4444", icon:"🔴" },
  "chiến_tranh": { id:"chiến_tranh",label:"Chiến Tranh", color:"#7f1d1d", icon:"☠️" },
};

const TREATY_META: Record<string, { icon: string; label: string }> = {
  "liên_minh":       { icon:"🤝", label:"Liên Minh"       },
  "thương_mại":      { icon:"📦", label:"Thương Mại"      },
  "viện_trợ":        { icon:"🎁", label:"Viện Trợ"        },
  "phòng_thủ_chung": { icon:"🛡️", label:"Phòng Thủ Chung"},
  "đình_chiến":      { icon:"🏳️", label:"Đình Chiến"      },
};

const GOV_TYPE_LABEL: Record<string, string> = {
  village_council:    "Hội Đồng Làng",
  city_state:         "Thành Quốc",
  kingdom:            "Vương Quốc",
  empire:             "Đế Quốc",
  republic:           "Cộng Hòa",
  theocracy:          "Thần Quyền",
  tribal_confederation:"Liên Minh Bộ Lạc",
  merchant_guild:     "Thương Hội",
  military_junta:     "Quân Phiệt",
};

function govLabel(g: Government) { return GOV_TYPE_LABEL[g.govType] ?? g.govType; }

function ScoreBar({ score }: { score: number }) {
  const pct = ((score + 100) / 200) * 100;
  const color = score >= 70 ? "#22c55e" : score >= 30 ? "#06b6d4"
    : score >= -10 ? "#9ca3af" : score >= -40 ? "#f59e0b"
    : score >= -70 ? "#ef4444" : "#7f1d1d";
  return (
    <div className="relative h-1.5 rounded-full bg-gray-800 overflow-hidden">
      <div className="absolute left-0 top-0 h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function NpcDiplomacyPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<{
    governments: Government[]; relations: Relation[]; treaties: Treaty[];
    memories: Memory[]; stats: any;
    actions: ActionMeta[]; relationTypes: RelTypeMeta[]; treatyTypes: TreatyTypeMeta[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"relations"|"treaties"|"memories"|"action">("relations");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgOk, setMsgOk] = useState(true);
  const [initLoading, setInitLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [actLoading, setActLoading] = useState(false);

  /* Action form */
  const [selGovA, setSelGovA] = useState("");
  const [selGovB, setSelGovB] = useState("");
  const [selAction, setSelAction] = useState("");
  const [expandedRel, setExpandedRel] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/npc-diplomacy", { credentials: "include" });
      if (r.ok) setData(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const flash = (m: string, ok = true) => { setMsg(m); setMsgOk(ok); setTimeout(() => setMsg(null), 5000); };

  const post = async (url: string, setL: (v:boolean)=>void, body?: unknown) => {
    setL(true);
    try {
      const r = await fetch(url, {
        method: "POST", credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!r.ok) flash(j.error ?? "Có lỗi xảy ra", false);
      else { flash(j.message ?? "Thành công"); loadData(); }
    } catch { flash("Không kết nối được máy chủ", false); }
    setL(false);
  };

  const govs     = data?.governments ?? [];
  const rels     = data?.relations   ?? [];
  const treats   = data?.treaties    ?? [];
  const mems     = data?.memories    ?? [];
  const actions  = data?.actions     ?? [];
  const stats    = data?.stats ?? { totalRels:0, alliances:0, wars:0, activeTreats:0, totalGovs:0 };

  /* Build gov map */
  const govMap = Object.fromEntries(govs.map(g => [g.id, g]));

  /* Filter rels */
  const alliances = rels.filter(r => r.relationType === "đồng_minh");
  const friendly  = rels.filter(r => r.relationType === "thân_thiện");
  const tensions  = rels.filter(r => r.relationType === "căng_thẳng");
  const hostile   = rels.filter(r => ["thù_địch","chiến_tranh"].includes(r.relationType));

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Handshake className="w-5 h-5 text-cyan-500" />
              <span className="font-bold tracking-wider text-cyan-400">NGOẠI GIAO NPC</span>
            </div>
          </div>
          <button onClick={loadData} disabled={loading} className="text-gray-400 hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label:"Chính Phủ", value: stats.totalGovs,   color:"#06b6d4", icon:<Globe className="w-3.5 h-3.5"/> },
            { label:"Đồng Minh", value: stats.alliances,   color:"#22c55e", icon:<Shield className="w-3.5 h-3.5"/> },
            { label:"Chiến Tranh",value: stats.wars,        color:"#ef4444", icon:<Sword className="w-3.5 h-3.5"/> },
            { label:"Hiệp Ước",  value: stats.activeTreats,color:"#a855f7", icon:<ScrollText className="w-3.5 h-3.5"/> },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-3 text-center">
              <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
              <div className="text-xs text-gray-500 mb-0.5 leading-tight">{s.label}</div>
              <div className="font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          <button onClick={() => post("/api/npc-diplomacy/init", setInitLoading)}
            disabled={initLoading || govs.length < 2}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold border border-cyan-700/50 text-cyan-400 hover:bg-cyan-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {initLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Zap className="w-3.5 h-3.5"/>}
            KHỞI TẠO QUAN HỆ
          </button>
          <button onClick={() => post("/api/npc-diplomacy/ai-tick", setAiLoading)}
            disabled={aiLoading || rels.length === 0}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold border border-purple-700/50 text-purple-400 hover:bg-purple-900/20 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <BarChart3 className="w-3.5 h-3.5"/>}
            AI TỰ ĐỘNG
          </button>
        </div>

        {/* Flash */}
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className={`rounded-lg px-4 py-2 text-sm text-center border ${msgOk
                ? "bg-green-900/30 border-green-700/50 text-green-300"
                : "bg-red-900/30 border-red-700/50 text-red-300"}`}>
              {msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {(["relations","treaties","memories","action"] as const).map(t => {
            const labels: Record<string, string> = {
              relations:`⚖️ QUAN HỆ (${rels.length})`,
              treaties:`📜 HIỆP ƯỚC (${treats.length})`,
              memories:`🧠 KÝ ỨC (${mems.length})`,
              action:"🎭 HÀNH ĐỘNG",
            };
            return (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 min-w-[6rem] py-2 rounded-lg text-xs font-bold border transition-all"
                style={tab === t
                  ? { background:"#06b6d422", borderColor:"#06b6d4", color:"#06b6d4" }
                  : { borderColor:"#374151", color:"#6b7280" }}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin"/>
          </div>
        ) : tab === "relations" ? (
          /* RELATIONS */
          rels.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Handshake className="w-12 h-12 mx-auto mb-3 opacity-30"/>
              <p className="text-sm">Chưa có quan hệ ngoại giao nào.</p>
              <p className="text-xs mt-1 text-cyan-600">Nhấn <span className="text-cyan-400">"KHỞI TẠO QUAN HỆ"</span> để bắt đầu!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Summary row */}
              <div className="flex gap-2 flex-wrap mb-3">
                {[
                  { label:`Đồng Minh (${alliances.length})`, color:"#22c55e" },
                  { label:`Thân Thiện (${friendly.length})`, color:"#06b6d4" },
                  { label:`Căng Thẳng (${tensions.length})`, color:"#f59e0b" },
                  { label:`Thù Địch/Chiến (${hostile.length})`, color:"#ef4444" },
                ].map(s => (
                  <div key={s.label} className="text-xs px-2 py-1 rounded-full border"
                    style={{ borderColor: s.color + "40", color: s.color, background: s.color + "0A" }}>
                    {s.label}
                  </div>
                ))}
              </div>
              {rels.map(r => {
                const rt = REL_TYPE_META[r.relationType] ?? REL_TYPE_META["trung_lập"];
                const gA = govMap[r.governmentAId];
                const gB = govMap[r.governmentBId];
                const isExpanded = expandedRel === r.id;
                return (
                  <motion.div key={r.id} layout className="bg-gray-900/50 border border-gray-800/50 rounded-xl overflow-hidden">
                    <button className="w-full text-left px-4 py-3" onClick={() => setExpandedRel(isExpanded ? null : r.id)}>
                      <div className="flex items-center gap-3">
                        <span className="text-base">{rt.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm truncate">
                              {gA ? govLabel(gA) : r.governmentAId.slice(0,8)} ↔ {gB ? govLabel(gB) : r.governmentBId.slice(0,8)}
                            </span>
                          </div>
                          <ScoreBar score={r.relationScore} />
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="text-sm font-bold" style={{ color: rt.color }}>
                            {r.relationScore > 0 ? "+" : ""}{r.relationScore}
                          </div>
                          <div className="text-xs" style={{ color: rt.color }}>{rt.label}</div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-600 shrink-0"/> : <ChevronDown className="w-3.5 h-3.5 text-gray-600 shrink-0"/>}
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
                          exit={{ height:0, opacity:0 }} className="overflow-hidden">
                          <div className="px-4 pb-3 border-t border-gray-800/40 pt-2 space-y-1.5">
                            {gA && <div className="text-xs text-gray-400">Chính phủ A: <span className="text-white">{govLabel(gA)}</span> · Ngân khố: {gA.treasury.toLocaleString()}g · Tín nhiệm: {gA.approvalRate.toFixed(0)}%</div>}
                            {gB && <div className="text-xs text-gray-400">Chính phủ B: <span className="text-white">{govLabel(gB)}</span> · Ngân khố: {gB.treasury.toLocaleString()}g · Tín nhiệm: {gB.approvalRate.toFixed(0)}%</div>}
                            <div className="text-xs text-gray-600">Cập nhật: {new Date(r.updatedAt).toLocaleString("vi-VN")}</div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )
        ) : tab === "treaties" ? (
          /* TREATIES */
          treats.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30"/>
              <p className="text-sm">Chưa có hiệp ước nào đang hoạt động.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {treats.map(t => {
                const tm = TREATY_META[t.treatyType] ?? { icon:"📜", label: t.treatyType };
                const gA = govMap[t.governmentAId];
                const gB = govMap[t.governmentBId];
                const daysLeft = t.endDate
                  ? Math.ceil((new Date(t.endDate).getTime() - Date.now()) / 86400000)
                  : null;
                return (
                  <div key={t.id} className="bg-gray-900/50 border border-gray-800/50 rounded-xl px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{tm.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm">{tm.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {gA ? govLabel(gA) : t.governmentAId.slice(0,8)} ↔ {gB ? govLabel(gB) : t.governmentBId.slice(0,8)}
                        </div>
                        <div className="flex gap-2 mt-1.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 border border-green-700/40 text-green-400">
                            ✅ Đang hiệu lực
                          </span>
                          {daysLeft !== null && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${daysLeft <= 7 ? "bg-red-900/30 border-red-700/40 text-red-400" : "bg-gray-800/50 border-gray-700/40 text-gray-400"}`}>
                              ⏳ Còn {daysLeft} ngày
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : tab === "memories" ? (
          /* MEMORIES */
          mems.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30"/>
              <p className="text-sm">Chưa có ký ức ngoại giao nào.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {mems.map(m => {
                const gov = govMap[m.governmentId];
                const isPos = m.scoreChange > 0;
                const isNeg = m.scoreChange < 0;
                return (
                  <div key={m.id} className="flex items-start gap-3 bg-gray-900/40 border border-gray-800/40 rounded-xl px-4 py-3">
                    <div className="shrink-0 mt-0.5">
                      {isPos ? <CheckCircle2 className="w-4 h-4 text-green-500"/>
                        : isNeg ? <AlertTriangle className="w-4 h-4 text-red-500"/>
                        : <ScrollText className="w-4 h-4 text-gray-500"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      {gov && <div className="text-xs text-gray-500 mb-0.5">{govLabel(gov)}</div>}
                      <div className="text-sm text-gray-300 leading-relaxed">{m.event}</div>
                      <div className="flex justify-between items-center mt-1">
                        {m.scoreChange !== 0 && (
                          <span className={`text-xs font-bold ${isPos ? "text-green-400" : "text-red-400"}`}>
                            {isPos ? "+" : ""}{m.scoreChange} điểm
                          </span>
                        )}
                        <span className="text-xs text-gray-600 ml-auto">
                          {new Date(m.createdAt).toLocaleString("vi-VN")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ACTION */
          <div className="space-y-4">
            {govs.length < 2 ? (
              <div className="text-center py-12 text-gray-600">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30"/>
                <p className="text-sm">Cần ít nhất 2 chính phủ NPC để thực hiện hành động ngoại giao.</p>
                <p className="text-xs mt-1 text-gray-600">Tạo chính phủ NPC tại trang <span className="text-cyan-600">Chính Phủ NPC</span>.</p>
              </div>
            ) : (
              <>
                <div className="bg-gray-900/60 border border-cyan-800/30 rounded-xl p-4 space-y-3">
                  <div className="text-xs text-cyan-400 font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <Handshake className="w-3.5 h-3.5"/> Thực Hiện Hành Động Ngoại Giao
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Chính Phủ Hành Động</div>
                      <select value={selGovA} onChange={e => setSelGovA(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
                        <option value="">-- Chọn --</option>
                        {govs.map(g => <option key={g.id} value={g.id}>{govLabel(g)}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Mục Tiêu</div>
                      <select value={selGovB} onChange={e => setSelGovB(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white">
                        <option value="">-- Chọn --</option>
                        {govs.filter(g => g.id !== selGovA).map(g => <option key={g.id} value={g.id}>{govLabel(g)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Hành Động</div>
                    <div className="grid grid-cols-2 gap-2">
                      {actions.map(a => (
                        <button key={a.id} onClick={() => setSelAction(a.id)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs border transition-all text-left"
                          style={selAction === a.id
                            ? { background: a.color + "22", borderColor: a.color, color: a.color }
                            : { borderColor: "#374151", color: "#9ca3af" }}>
                          <span className="text-base">{a.icon}</span>
                          <div>
                            <div className="font-semibold leading-tight">{a.label}</div>
                            <div className="text-xs opacity-70">{a.scoreChange > 0 ? "+" : ""}{a.scoreChange} điểm</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!selGovA || !selGovB || !selAction) { flash("Vui lòng chọn đủ thông tin", false); return; }
                      if (selGovA === selGovB) { flash("Không thể hành động với chính mình", false); return; }
                      post("/api/npc-diplomacy/action", setActLoading, {
                        governmentAId: selGovA, governmentBId: selGovB, action: selAction,
                      });
                    }}
                    disabled={actLoading}
                    className="w-full py-3 rounded-lg text-xs font-bold bg-cyan-800 hover:bg-cyan-700 text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                    {actLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Handshake className="w-4 h-4"/>}
                    THỰC HIỆN HÀNH ĐỘNG
                  </button>
                </div>

                {/* Available actions legend */}
                <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-3">
                  <div className="text-xs text-gray-500 mb-2 font-semibold">Tác Động Quan Hệ</div>
                  <div className="space-y-1.5">
                    {actions.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-xs">
                        <span>{a.icon}</span>
                        <span className="text-gray-300 flex-1">{a.label}</span>
                        <span className="font-bold" style={{ color: a.scoreChange > 0 ? "#22c55e" : "#ef4444" }}>
                          {a.scoreChange > 0 ? "+" : ""}{a.scoreChange}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
