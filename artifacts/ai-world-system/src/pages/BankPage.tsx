import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Landmark, TrendingUp, ArrowDownToLine, ArrowUpFromLine, Send, Percent, AlertCircle, Loader2, ArrowLeft, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function BankPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"account" | "loan" | "transfer" | "rates">("account");
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [loanAmt, setLoanAmt] = useState("");
  const [toCharId, setToCharId] = useState("");
  const [transferAmt, setTransferAmt] = useState("");
  const [transferNote, setTransferNote] = useState("");

  const { data: bankData, isLoading } = useQuery<any>({
    queryKey: ["/api/bank/account"],
    queryFn: () => fetch("/api/bank/account").then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: ratesData } = useQuery<any>({
    queryKey: ["/api/bank/rates"],
    queryFn: () => fetch("/api/bank/rates").then(r => r.json()),
    enabled: activeTab === "rates",
  });

  const depositMut = useMutation({
    mutationFn: (amount: number) => fetch("/api/bank/deposit", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); setDepositAmt(""); qc.invalidateQueries({ queryKey: ["/api/bank/account"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const withdrawMut = useMutation({
    mutationFn: (amount: number) => fetch("/api/bank/withdraw", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); setWithdrawAmt(""); qc.invalidateQueries({ queryKey: ["/api/bank/account"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const loanMut = useMutation({
    mutationFn: (amount: number) => fetch("/api/bank/loan", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); setLoanAmt(""); qc.invalidateQueries({ queryKey: ["/api/bank/account"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const repayMut = useMutation({
    mutationFn: (loanId: string) => fetch(`/api/bank/repay/${loanId}`, { method: "POST" })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); qc.invalidateQueries({ queryKey: ["/api/bank/account"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const transferMut = useMutation({
    mutationFn: (body: any) => fetch("/api/bank/transfer", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); setToCharId(""); setTransferAmt(""); setTransferNote(""); qc.invalidateQueries({ queryKey: ["/api/bank/account"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const account = bankData?.account;
  const loans = bankData?.loans ?? [];
  const transfers = bankData?.transfers ?? [];

  const tabs = [
    { id: "account",  label: "TÀI KHOẢN",   icon: Landmark },
    { id: "loan",     label: "VAY VỐN",      icon: Percent },
    { id: "transfer", label: "CHUYỂN KHOẢN", icon: Send },
    { id: "rates",    label: "TỶ GIÁ",       icon: TrendingUp },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold tracking-wider text-yellow-400">NGÂN HÀNG LIÊN THẾ GIỚI</h1>
            <p className="font-mono text-xs text-muted-foreground">Gửi tiết kiệm lãi 2%/ngày — vay vốn — chuyển khoản cross-world</p>
          </div>
        </div>

        {/* Balance card */}
        {account && (
          <div className="border border-yellow-500/30 bg-yellow-500/5 p-5 text-center">
            <p className="font-mono text-xs text-muted-foreground mb-1">SỐ DƯ NGÂN HÀNG</p>
            <p className="font-orbitron text-4xl font-black text-yellow-400">{account.balance.toLocaleString()}</p>
            <p className="font-mono text-xs text-muted-foreground mt-1">GOLD</p>
            <div className="flex justify-center gap-6 mt-3">
              <div><p className="font-mono text-xs text-green-400">+{account.totalDeposited.toLocaleString()}</p><p className="font-mono text-xs text-muted-foreground/60">Đã gửi</p></div>
              <div><p className="font-mono text-xs text-red-400">-{account.totalWithdrawn.toLocaleString()}</p><p className="font-mono text-xs text-muted-foreground/60">Đã rút</p></div>
              <div><p className="font-mono text-xs text-cyan-400">2%/ngày</p><p className="font-mono text-xs text-muted-foreground/60">Lãi suất</p></div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs transition-all ${
                  activeTab === t.id ? "text-yellow-400 border-b-2 border-yellow-400" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-yellow-400" /></div>
        ) : (
          <AnimatePresence mode="wait">
            {/* Tab: Tài khoản */}
            {activeTab === "account" && (
              <motion.div key="account" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Gửi tiết kiệm */}
                  <div className="border border-green-500/30 bg-card/30 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ArrowDownToLine className="w-4 h-4 text-green-400" />
                      <p className="font-orbitron text-xs text-green-400">GỬI TIẾT KIỆM</p>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">Lãi 2%/ngày tự động. Rút bất cứ lúc nào.</p>
                    <Input type="number" value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
                      placeholder="Số lượng gold..." className="font-mono text-xs" />
                    <Button className="w-full font-mono text-xs bg-green-600/20 text-green-400 border border-green-600/30" size="sm"
                      onClick={() => depositMut.mutate(parseInt(depositAmt))}
                      disabled={!depositAmt || parseInt(depositAmt) <= 0 || depositMut.isPending}>
                      {depositMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownToLine className="w-3 h-3 mr-1" />} Gửi
                    </Button>
                  </div>
                  {/* Rút tiền */}
                  <div className="border border-blue-500/30 bg-card/30 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ArrowUpFromLine className="w-4 h-4 text-blue-400" />
                      <p className="font-orbitron text-xs text-blue-400">RÚT TIỀN</p>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">Số dư hiện có: <span className="text-yellow-400">{account?.balance?.toLocaleString() ?? 0} gold</span></p>
                    <Input type="number" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                      placeholder="Số lượng rút..." className="font-mono text-xs" />
                    <Button className="w-full font-mono text-xs" size="sm" variant="outline"
                      onClick={() => withdrawMut.mutate(parseInt(withdrawAmt))}
                      disabled={!withdrawAmt || parseInt(withdrawAmt) <= 0 || withdrawMut.isPending}>
                      {withdrawMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpFromLine className="w-3 h-3 mr-1" />} Rút
                    </Button>
                  </div>
                </div>

                {/* Lịch sử */}
                {transfers.length > 0 && (
                  <div className="border border-border/40 bg-card/30 p-4">
                    <p className="font-mono text-xs text-muted-foreground mb-3">LỊCH SỬ GIAO DỊCH GẦN NHẤT</p>
                    <div className="space-y-2">
                      {transfers.slice(0, 5).map((t: any) => (
                        <div key={t.id} className="flex items-center gap-3 border border-border/20 bg-card/20 px-3 py-2">
                          <Send className="w-3 h-3 text-muted-foreground" />
                          <span className="font-mono text-xs flex-1 truncate">{t.note || "Chuyển khoản"}</span>
                          <span className="font-mono text-xs text-yellow-400">-{t.amount} gold</span>
                          <span className="font-mono text-xs text-muted-foreground/40">{new Date(t.transferredAt).toLocaleDateString("vi-VN")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab: Vay vốn */}
            {activeTab === "loan" && (
              <motion.div key="loan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="border border-orange-500/20 bg-orange-500/5 p-3">
                  <p className="font-mono text-xs text-orange-400/80">⚠️ Lãi suất 5%/ngày. Trả toàn bộ trong 7 ngày. Tối đa 500% số dư tài khoản. Quá hạn → trạng thái defaulted.</p>
                </div>
                <div className="border border-red-500/30 bg-card/30 p-4 space-y-3 max-w-sm">
                  <p className="font-mono text-xs text-muted-foreground">Số dư: <span className="text-yellow-400">{account?.balance?.toLocaleString() ?? 0}</span> → Tối đa vay: <span className="text-red-400">{((account?.balance ?? 0) * 5).toLocaleString()}</span></p>
                  <Input type="number" value={loanAmt} onChange={e => setLoanAmt(e.target.value)}
                    placeholder="Số lượng vay..." className="font-mono text-xs" />
                  {loanAmt && parseInt(loanAmt) > 0 && (
                    <p className="font-mono text-xs text-muted-foreground/70">Phải trả: <span className="text-orange-400">{Math.floor(parseInt(loanAmt) * 1.3).toLocaleString()} gold</span> trong 7 ngày</p>
                  )}
                  <Button className="w-full font-mono text-xs bg-red-600/20 text-red-400 border border-red-600/30" size="sm"
                    onClick={() => loanMut.mutate(parseInt(loanAmt))}
                    disabled={!loanAmt || parseInt(loanAmt) < 100 || loanMut.isPending}>
                    {loanMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Percent className="w-3 h-3 mr-1" />} Vay
                  </Button>
                </div>

                {/* Khoản vay đang active */}
                {loans.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-mono text-xs text-muted-foreground">{loans.length} khoản vay đang active</p>
                    {loans.map((loan: any) => (
                      <div key={loan.id} className="border border-red-500/20 bg-card/30 p-3 flex items-center gap-3">
                        <div className="flex-1">
                          <p className="font-mono text-xs font-bold text-red-400">{loan.totalOwed.toLocaleString()} gold nợ</p>
                          <p className="font-mono text-xs text-muted-foreground">Gốc: {loan.principal.toLocaleString()} | Đến: {new Date(loan.dueAt).toLocaleDateString("vi-VN")}</p>
                        </div>
                        <Button size="sm" className="font-mono text-xs h-7 bg-green-600/20 text-green-400 border border-green-600/30"
                          onClick={() => repayMut.mutate(loan.id)} disabled={repayMut.isPending}>
                          {repayMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />} Trả
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab: Chuyển khoản */}
            {activeTab === "transfer" && (
              <motion.div key="transfer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="border border-cyan-500/30 bg-card/30 p-5 space-y-4 max-w-md">
                  <p className="font-orbitron text-sm text-cyan-400">CHUYỂN KHOẢN</p>
                  <p className="font-mono text-xs text-muted-foreground/70">Cross-world: phí 5% + 10 gold. Cùng thế giới: miễn phí.</p>
                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted-foreground">ID nhân vật đích</label>
                    <Input value={toCharId} onChange={e => setToCharId(e.target.value)}
                      placeholder="UUID nhân vật..." className="font-mono text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted-foreground">Số lượng</label>
                    <Input type="number" value={transferAmt} onChange={e => setTransferAmt(e.target.value)}
                      placeholder="Gold..." className="font-mono text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-xs text-muted-foreground">Ghi chú</label>
                    <Input value={transferNote} onChange={e => setTransferNote(e.target.value)}
                      placeholder="Ghi chú..." className="font-mono text-xs" />
                  </div>
                  <Button className="w-full font-mono text-xs" size="sm"
                    onClick={() => transferMut.mutate({ toCharId, amount: parseInt(transferAmt), note: transferNote })}
                    disabled={!toCharId || !transferAmt || parseInt(transferAmt) <= 0 || transferMut.isPending}>
                    {transferMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} Chuyển
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Tab: Tỷ giá */}
            {activeTab === "rates" && (
              <motion.div key="rates" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <p className="font-mono text-xs text-muted-foreground">Tỷ giá ảnh hưởng bởi quan hệ ngoại giao: đồng minh +10%, kẻ thù -20%</p>
                {ratesData ? (
                  <div className="overflow-x-auto">
                    <table className="w-full font-mono text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left p-2 border border-border/30 text-muted-foreground">Từ \ Đến</th>
                          {ratesData.worlds?.slice(0, 4).map((w: any) => (
                            <th key={w.slug} className="text-center p-2 border border-border/30 text-muted-foreground">{w.currency}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ratesData.worlds?.slice(0, 4).map((fromW: any) => (
                          <tr key={fromW.slug}>
                            <td className="p-2 border border-border/30 text-cyan-400">{fromW.currency}</td>
                            {ratesData.worlds?.slice(0, 4).map((toW: any) => {
                              const rate = ratesData.rates?.[fromW.slug]?.[toW.slug] ?? 1.0;
                              return (
                                <td key={toW.slug} className={`text-center p-2 border border-border/30 ${fromW.slug === toW.slug ? "text-muted-foreground/30" : rate > 1 ? "text-green-400" : rate < 1 ? "text-red-400" : "text-foreground"}`}>
                                  {fromW.slug === toW.slug ? "—" : rate.toFixed(2)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
