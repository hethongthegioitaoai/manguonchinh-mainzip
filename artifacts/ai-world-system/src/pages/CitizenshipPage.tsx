import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Globe, Users, CheckCircle2, XCircle, Clock, Coins, Shield, Vote, Bell, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface CitizenWorld {
  id: string; slug: string; name: string; description: string;
  creatorName: string; citizenCount: number;
  benefits: { tradeTaxDiscount: number; voteEligible: boolean; eventNotify: boolean; maxCitizens: number; annualTaxAmount: number; welcomeMessage: string } | null;
}
interface Citizenship {
  id: string; worldSlug: string; worldName: string; status: string;
  applicationNote: string; approvalNote: string; annualTax: number;
  appliedAt: string; approvedAt: string | null; taxPaidAt: string | null; characterName: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:  { label: "Đang chờ", color: "#f59e0b", icon: Clock },
  approved: { label: "Đã duyệt", color: "#22c55e", icon: CheckCircle2 },
  revoked:  { label: "Đã thu hồi", color: "#ef4444", icon: XCircle },
};

export default function CitizenshipPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"worlds" | "mine" | "manage">("worlds");
  const [worlds, setWorlds] = useState<CitizenWorld[]>([]);
  const [myCitizenships, setMyCitizenships] = useState<Citizenship[]>([]);
  const [myWorldSlug, setMyWorldSlug] = useState<string | null>(null);
  const [applications, setApplications] = useState<Citizenship[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expandedWorld, setExpandedWorld] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [payingSlug, setPayingSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [wRes, mRes] = await Promise.all([
        fetch("/api/citizenship/worlds"),
        fetch("/api/citizenship/my"),
      ]);
      const wData = await wRes.json();
      const mData = await mRes.json();
      setWorlds(Array.isArray(wData) ? wData : []);
      setMyCitizenships(Array.isArray(mData) ? mData : []);

      const myWorldRes = await fetch("/api/god/my-worlds");
      const myWorldData = await myWorldRes.json();
      if (Array.isArray(myWorldData) && myWorldData.length > 0) {
        const slug = myWorldData[0].slug;
        setMyWorldSlug(slug);
        const appRes = await fetch(`/api/citizenship/applications/${slug}`);
        const appData = await appRes.json();
        setApplications(Array.isArray(appData) ? appData : []);
      }
    } catch {
      toast({ title: "Lỗi", description: "Không thể tải dữ liệu", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(worldSlug: string) {
    setApplyingId(worldSlug);
    try {
      const res = await fetch(`/api/citizenship/apply/${worldSlug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationNote: note }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "📋 Đã nộp đơn!", description: data.message });
      setNote(""); setExpandedWorld(null);
      loadData();
    } finally { setApplyingId(null); }
  }

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/citizenship/approve/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "✅ Đã duyệt!", description: data.message });
      loadData();
    } finally { setProcessingId(null); }
  }

  async function handleRevoke(id: string) {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/citizenship/revoke/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "❌ Đã thu hồi", description: data.message });
      loadData();
    } finally { setProcessingId(null); }
  }

  async function handlePayTax(worldSlug: string) {
    setPayingSlug(worldSlug);
    try {
      const res = await fetch(`/api/citizenship/pay-tax/${worldSlug}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Lỗi", description: data.message, variant: "destructive" }); return; }
      toast({ title: "💰 Đã nộp thuế!", description: data.message });
      loadData();
    } finally { setPayingSlug(null); }
  }

  function taxDueDate(taxPaidAt: string | null): boolean {
    if (!taxPaidAt) return true;
    const paid = new Date(taxPaidAt).getTime();
    return Date.now() - paid > 7 * 86400000;
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="font-mono text-cyan-400 animate-pulse">Đang tải hệ thống di dân...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold text-cyan-400 tracking-widest">DI DÂN & QUỐC TỊCH</h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">Định cư thế giới khác · Quyền lợi công dân · Giảm thuế giao dịch</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { key: "worlds", label: "🌐 THẾ GIỚI NHẬN DÂN" },
            { key: "mine", label: "📋 QUỐC TỊCH CỦA TÔI" },
            { key: "manage", label: "⚙️ QUẢN LÝ CÔNG DÂN" },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`font-orbitron text-xs px-4 py-2 border transition-all ${activeTab === tab.key ? "border-cyan-400 text-cyan-400 bg-cyan-400/10" : "border-border text-muted-foreground hover:border-cyan-400/50"}`}
            >{tab.label}</button>
          ))}
        </div>

        {/* TAB 1: Worlds */}
        {activeTab === "worlds" && (
          <div className="space-y-4">
            <div className="font-mono text-xs text-muted-foreground mb-4 border border-cyan-400/20 bg-cyan-400/5 p-3">
              💡 Công dân được: giảm 20% thuế giao dịch · tham gia bầu cử · nhận thông báo sự kiện thế giới · thuế thường niên 200 gold/tuần
            </div>
            {worlds.length === 0 && (
              <div className="text-center py-12 text-muted-foreground font-mono text-sm">Không có thế giới công khai nào đang nhận công dân.</div>
            )}
            {worlds.map((w, i) => {
              const alreadyApplied = myCitizenships.some(c => c.worldSlug === w.slug && c.status !== "revoked");
              const isExpanded = expandedWorld === w.id;
              return (
                <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="border border-border bg-card/50 p-5"
                >
                  <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => setExpandedWorld(isExpanded ? null : w.id)}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 flex items-center justify-center border border-cyan-400/30 bg-cyan-400/10 flex-shrink-0">
                        <Globe className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <div className="font-orbitron text-sm font-bold text-cyan-400">{w.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">Tác giả: {w.creatorName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{w.description?.slice(0, 80)}...</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-center font-mono text-xs">
                        <div className="text-cyan-400 font-bold">{w.citizenCount}/{w.benefits?.maxCitizens ?? 50}</div>
                        <div className="text-muted-foreground">Công dân</div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                        <div className="flex items-center gap-2 text-green-400">
                          <Coins className="w-3 h-3" /> Giảm thuế {w.benefits?.tradeTaxDiscount ?? 20}%
                        </div>
                        <div className={`flex items-center gap-2 ${w.benefits?.voteEligible ? "text-blue-400" : "text-muted-foreground"}`}>
                          <Vote className="w-3 h-3" /> {w.benefits?.voteEligible ? "Được bầu cử" : "Không bầu cử"}
                        </div>
                        <div className={`flex items-center gap-2 ${w.benefits?.eventNotify ? "text-purple-400" : "text-muted-foreground"}`}>
                          <Bell className="w-3 h-3" /> {w.benefits?.eventNotify ? "Nhận thông báo" : "Không thông báo"}
                        </div>
                      </div>
                      <div className="font-mono text-xs text-yellow-400">💰 Thuế thường niên: {w.benefits?.annualTaxAmount ?? 200} gold/tuần</div>
                      {w.benefits?.welcomeMessage && (
                        <div className="font-mono text-xs text-muted-foreground italic border-l-2 border-cyan-400/30 pl-3">{w.benefits.welcomeMessage}</div>
                      )}
                      <div className="pt-2">
                        {alreadyApplied ? (
                          <span className="font-mono text-xs text-green-400">✅ Đã nộp đơn hoặc có quốc tịch</span>
                        ) : (
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <input
                                className="w-full bg-background border border-border text-xs font-mono px-3 py-1.5 text-foreground placeholder-muted-foreground"
                                placeholder="Lý do xin quốc tịch (tùy chọn)..."
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                maxLength={300}
                              />
                            </div>
                            <Button size="sm" onClick={() => handleApply(w.slug)} disabled={applyingId === w.slug}
                              className="font-orbitron text-xs bg-cyan-400/20 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/30 flex-shrink-0">
                              {applyingId === w.slug ? "Đang nộp..." : "📋 Nộp đơn"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* TAB 2: My citizenships */}
        {activeTab === "mine" && (
          <div className="space-y-4">
            {myCitizenships.length === 0 && (
              <div className="text-center py-12 text-muted-foreground font-mono text-sm">Bạn chưa có quốc tịch nào. Hãy khám phá các thế giới!</div>
            )}
            {myCitizenships.map((c, i) => {
              const s = STATUS_MAP[c.status] ?? STATUS_MAP.pending;
              const taxDue = c.status === "approved" && taxDueDate(c.taxPaidAt);
              return (
                <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="border bg-card/50 p-5" style={{ borderColor: `${s.color}40` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 flex items-center justify-center border flex-shrink-0" style={{ borderColor: `${s.color}40`, backgroundColor: `${s.color}10` }}>
                        <s.icon className="w-5 h-5" style={{ color: s.color }} />
                      </div>
                      <div>
                        <div className="font-orbitron text-sm font-bold" style={{ color: s.color }}>{c.worldName}</div>
                        <div className="font-mono text-xs text-muted-foreground">Trạng thái: {s.label}</div>
                        <div className="font-mono text-xs text-muted-foreground">Nộp đơn: {new Date(c.appliedAt).toLocaleDateString("vi-VN")}</div>
                        {c.approvedAt && <div className="font-mono text-xs text-green-400/70">Duyệt: {new Date(c.approvedAt).toLocaleDateString("vi-VN")}</div>}
                        {c.approvalNote && <div className="font-mono text-xs text-muted-foreground italic mt-1">"{c.approvalNote}"</div>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      {c.status === "approved" && (
                        <div className="flex gap-2 flex-wrap justify-end">
                          {taxDue && (
                            <Button size="sm" onClick={() => handlePayTax(c.worldSlug)} disabled={payingSlug === c.worldSlug}
                              className="font-orbitron text-xs bg-yellow-400/20 border border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/30">
                              {payingSlug === c.worldSlug ? "Đang nộp..." : `💰 Nộp thuế (${c.annualTax}g)`}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleRevoke(c.id)} disabled={processingId === c.id}
                            className="font-orbitron text-xs text-red-400/60 hover:text-red-400 hover:bg-red-400/10">
                            Từ bỏ
                          </Button>
                        </div>
                      )}
                      {taxDue && c.status === "approved" && (
                        <div className="font-mono text-xs text-yellow-400">⚠ Thuế quá hạn!</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* TAB 3: Manage */}
        {activeTab === "manage" && (
          <div className="space-y-4">
            {!myWorldSlug && (
              <div className="text-center py-12 text-muted-foreground font-mono text-sm">
                Bạn chưa có thế giới công khai để quản lý công dân.
                <br /><Button variant="link" onClick={() => setLocation("/world-creator")} className="text-cyan-400 text-xs mt-2">Tạo thế giới →</Button>
              </div>
            )}
            {myWorldSlug && (
              <>
                <div className="font-mono text-xs text-muted-foreground mb-2">Quản lý đơn xin nhập quốc tịch thế giới của bạn</div>
                {applications.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground font-mono text-sm">Chưa có đơn xin nào.</div>
                )}
                {applications.map((a, i) => {
                  const s = STATUS_MAP[a.status] ?? STATUS_MAP.pending;
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className="border bg-card/50 p-4 flex items-center gap-4" style={{ borderColor: `${s.color}30` }}
                    >
                      <div className="w-8 h-8 flex items-center justify-center border flex-shrink-0" style={{ borderColor: `${s.color}40`, backgroundColor: `${s.color}10` }}>
                        <Users className="w-4 h-4" style={{ color: s.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-orbitron text-sm font-bold">{a.characterName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{new Date(a.appliedAt).toLocaleDateString("vi-VN")} · {s.label}</div>
                        {a.applicationNote && <div className="font-mono text-xs text-muted-foreground italic">"{a.applicationNote}"</div>}
                      </div>
                      {a.status === "pending" && (
                        <div className="flex gap-2 flex-shrink-0">
                          <Button size="sm" onClick={() => handleApprove(a.id)} disabled={processingId === a.id}
                            className="font-orbitron text-xs bg-green-400/20 border border-green-400/50 text-green-400 hover:bg-green-400/30">
                            ✅ Duyệt
                          </Button>
                          <Button size="sm" onClick={() => handleRevoke(a.id)} disabled={processingId === a.id}
                            className="font-orbitron text-xs bg-red-400/20 border border-red-400/50 text-red-400 hover:bg-red-400/30">
                            ❌ Từ chối
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
