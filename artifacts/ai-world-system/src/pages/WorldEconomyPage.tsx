import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, TrendingUp, TrendingDown, Coins, Globe, Zap, RefreshCw, Building2, ArrowRightLeft, Settings } from "lucide-react";

interface WorldCurrency {
  id: string; worldSlug: string; worldName: string; currencyName: string;
  currencySymbol: string; currencyLore: string; exchangeRateToGold: string;
  totalSupply: number; reserveGold: number; volume24h: number; createdAt: string;
  treasury?: { balance: number; taxRate: number; totalRevenue: number; totalExpenditure: number } | null;
}
interface ExchangeRecord {
  id: string; fromWorldSlug: string; toWorldSlug: string; fromAmount: number;
  toAmount: number; rate: string; feeGold: number; executorName: string; executedAt: string;
}
interface CharInfo { id: string; name: string; level: number; stats: any; worldSlug?: string; }
interface MyWorld { id: string; slug: string; name: string; }

const RATE_COLOR = (rate: string) => {
  const r = parseFloat(rate);
  if (r >= 2) return "#f59e0b";
  if (r >= 1) return "#22c55e";
  return "#94a3b8";
};

export default function WorldEconomyPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"rates" | "exchange" | "setup" | "treasury">("rates");
  const [selectedFrom, setSelectedFrom] = useState("");
  const [selectedTo, setSelectedTo] = useState("");
  const [exchangeAmt, setExchangeAmt] = useState("");
  const [selectedCharId, setSelectedCharId] = useState("");
  const [selectedWorldSlug, setSelectedWorldSlug] = useState("");
  const [setupSlug, setSetupSlug] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupTheme, setSetupTheme] = useState("fantasy");
  const [customCurrName, setCustomCurrName] = useState("");
  const [customCurrSymbol, setCustomCurrSymbol] = useState("");
  const [newTaxRate, setNewTaxRate] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [spendReason, setSpendReason] = useState("");

  const { data: rates = [], isLoading } = useQuery<WorldCurrency[]>({
    queryKey: ["/api/world-economy/rates"],
    queryFn: async () => { const r = await fetch("/api/world-economy/rates", { credentials: "include" }); return r.ok ? r.json() : []; },
    refetchInterval: 30000,
  });

  const { data: history = [] } = useQuery<ExchangeRecord[]>({
    queryKey: ["/api/world-economy/history"],
    queryFn: async () => { const r = await fetch("/api/world-economy/history?limit=20", { credentials: "include" }); return r.ok ? r.json() : []; },
    refetchInterval: 15000,
  });

  const { data: myChars = [] } = useQuery<CharInfo[]>({
    queryKey: ["/api/world-economy/my-characters"],
    queryFn: async () => { const r = await fetch("/api/world-economy/my-characters", { credentials: "include" }); return r.ok ? r.json() : []; },
  });

  const { data: myWorlds = [] } = useQuery<MyWorld[]>({
    queryKey: ["/api/world-economy/my-worlds"],
    queryFn: async () => { const r = await fetch("/api/world-economy/my-worlds", { credentials: "include" }); return r.ok ? r.json() : []; },
  });

  const activeChar = myChars.find(c => c.id === selectedCharId) ?? myChars[0];
  const myGold = activeChar?.stats?.gold ?? 0;

  // Tính toán đổi tiền
  const fromCur = rates.find(r => r.worldSlug === selectedFrom);
  const toCur = rates.find(r => r.worldSlug === selectedTo);
  const fromAmt = parseInt(exchangeAmt) || 0;
  const goldValue = fromAmt * parseFloat(fromCur?.exchangeRateToGold ?? "0");
  const fee = Math.max(1, Math.floor(goldValue * 0.01));
  const toAmt = toCur ? Math.floor((goldValue - fee) / parseFloat(toCur.exchangeRateToGold)) : 0;

  const selectedTreasury = rates.find(r => r.worldSlug === selectedWorldSlug);

  const exchangeMutation = useMutation({
    mutationFn: async () => {
      const charId = selectedCharId || myChars[0]?.id;
      if (!charId) throw new Error("Chọn nhân vật trước");
      const r = await fetch("/api/world-economy/exchange", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: charId, fromWorldSlug: selectedFrom, toWorldSlug: selectedTo, fromAmount: fromAmt }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`✅ Đã đổi ${d.fromAmount} ${fromCur?.currencyName} → ${d.toAmount} ${toCur?.currencyName}`);
      queryClient.invalidateQueries({ queryKey: ["/api/world-economy/rates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/world-economy/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/world-economy/my-characters"] });
      setExchangeAmt("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/world-economy/setup", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldSlug: setupSlug, worldName: setupName, worldTheme: setupTheme,
          customName: customCurrName || undefined, customSymbol: customCurrSymbol || undefined,
        }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`🪙 Đã tạo đồng tiền "${d.currency.currencyName}" ${d.currency.currencySymbol} cho thế giới!`);
      queryClient.invalidateQueries({ queryKey: ["/api/world-economy/rates"] });
      setSetupSlug(""); setSetupName(""); setCustomCurrName(""); setCustomCurrSymbol("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const taxMutation = useMutation({
    mutationFn: async ({ worldSlug, taxRate }: { worldSlug: string; taxRate: number }) => {
      const r = await fetch(`/api/world-economy/tax/${worldSlug}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxRate }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`⚖️ Thuế suất cập nhật: ${d.taxRate}%`);
      queryClient.invalidateQueries({ queryKey: ["/api/world-economy/rates"] });
      setNewTaxRate("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const spendMutation = useMutation({
    mutationFn: async ({ worldSlug, amount, reason, characterId }: any) => {
      const r = await fetch(`/api/world-economy/treasury/spend/${worldSlug}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason, characterId }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`💰 Rút ${d.spent} gold từ kho bạc thành công`);
      queryClient.invalidateQueries({ queryKey: ["/api/world-economy/rates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/world-economy/my-characters"] });
      setSpendAmount(""); setSpendReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const TABS = [
    { k: "rates",    l: "TỶ GIÁ" },
    { k: "exchange", l: "ĐỔI TIỀN" },
    { k: "setup",    l: "PHÁT HÀNH" },
    { k: "treasury", l: "KHO BẠC" },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Courier New', monospace" }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-cyan-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              <h1 className="text-xl font-bold tracking-widest text-cyan-400">KINH TẾ THẾ GIỚI</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wider">SÀN TỶ GIÁ LIÊN THẾ GIỚI — KHO BẠC — THUẾ QUAN</p>
          </div>
          {activeChar && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm font-mono">
              <Coins className="w-4 h-4" /><span>{myGold.toLocaleString()} vàng</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 flex-wrap">
          {TABS.map(({ k, l }) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-1.5 text-xs font-mono tracking-wider border transition-all ${tab === k ? "border-cyan-400/50 text-cyan-400 bg-cyan-400/5" : "border-border text-muted-foreground hover:border-border"}`}>
              {l}
            </button>
          ))}
        </div>

        {/* ═══ TAB: TỶ GIÁ ═══ */}
        {tab === "rates" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {isLoading ? (
              <div className="text-center text-muted-foreground py-16 text-sm tracking-widest">ĐANG TẢI SÀN TỶ GIÁ...</div>
            ) : rates.length === 0 ? (
              <div className="text-center py-16 border border-border border-dashed">
                <Globe className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm tracking-wider mb-4">Chưa có thế giới nào phát hành tiền tệ</p>
                <button onClick={() => setTab("setup")}
                  className="px-6 py-2 text-sm font-mono border border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10 transition-all">
                  PHÁT HÀNH TIỀN TỆ NGAY
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="border border-border p-3 text-center">
                    <div className="text-2xl font-bold text-cyan-400 font-mono">{rates.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Đồng tiền</div>
                  </div>
                  <div className="border border-border p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-400 font-mono">
                      {rates.reduce((s, r) => s + r.volume24h, 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Volume 24h</div>
                  </div>
                  <div className="border border-border p-3 text-center">
                    <div className="text-2xl font-bold text-green-400 font-mono">
                      {rates.reduce((s, r) => s + (r.treasury?.balance ?? 0), 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">GDP Toàn Cầu</div>
                  </div>
                </div>

                {/* Currency table */}
                <div className="border border-border overflow-hidden">
                  <div className="grid grid-cols-6 px-4 py-2 text-xs text-muted-foreground bg-card/50 border-b border-border font-mono tracking-wider">
                    <span className="col-span-2">ĐỒNG TIỀN</span>
                    <span className="text-right">TỶ GIÁ/VÀNG</span>
                    <span className="text-right">VOLUME 24H</span>
                    <span className="text-right">KHO BẠC</span>
                    <span className="text-right">THUẾ</span>
                  </div>
                  {rates.map((r, i) => {
                    const rc = RATE_COLOR(r.exchangeRateToGold);
                    return (
                      <motion.div key={r.id}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="grid grid-cols-6 px-4 py-3 border-b border-border/50 hover:bg-card/50 transition-colors items-center"
                      >
                        <div className="col-span-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{r.currencySymbol}</span>
                            <div>
                              <div className="font-mono font-bold text-sm" style={{ color: rc }}>{r.currencyName}</div>
                              <div className="text-xs text-muted-foreground">{r.worldName || r.worldSlug}</div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold" style={{ color: rc }}>
                            {parseFloat(r.exchangeRateToGold).toFixed(2)}x
                          </div>
                          <div className="text-xs text-muted-foreground">1 {r.currencySymbol} = {r.exchangeRateToGold}🪙</div>
                        </div>
                        <div className="text-right font-mono text-sm text-yellow-400/80">
                          {r.volume24h.toLocaleString()}
                        </div>
                        <div className="text-right font-mono text-sm text-green-400/80">
                          {(r.treasury?.balance ?? 0).toLocaleString()}
                        </div>
                        <div className="text-right font-mono text-sm text-red-400/80">
                          {r.treasury?.taxRate ?? 0}%
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Recent transactions */}
                {history.length > 0 && (
                  <div className="mt-6">
                    <div className="text-xs text-muted-foreground tracking-widest mb-3 font-mono">GIAO DỊCH GẦN ĐÂY</div>
                    <div className="space-y-1.5">
                      {history.slice(0, 8).map(h => {
                        const fc = rates.find(r => r.worldSlug === h.fromWorldSlug);
                        const tc = rates.find(r => r.worldSlug === h.toWorldSlug);
                        return (
                          <div key={h.id} className="flex items-center justify-between text-xs font-mono text-muted-foreground border-b border-border/30 pb-1.5">
                            <span className="text-foreground/70">{h.executorName || "Ẩn danh"}</span>
                            <span className="text-yellow-400">{h.fromAmount.toLocaleString()} {fc?.currencySymbol ?? h.fromWorldSlug}</span>
                            <ArrowRightLeft className="w-3 h-3 text-muted-foreground/40" />
                            <span className="text-cyan-400">{h.toAmount.toLocaleString()} {tc?.currencySymbol ?? h.toWorldSlug}</span>
                            <span className="text-red-400/60">phí {h.feeGold}🪙</span>
                            <span>{new Date(h.executedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ TAB: ĐỔI TIỀN ═══ */}
        {tab === "exchange" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto">
            <div className="border border-border bg-card/50 p-6 space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
                <h2 className="font-mono text-sm tracking-widest text-cyan-400">SÀN ĐỔI TIỀN LIÊN THẾ GIỚI</h2>
              </div>

              {/* Nhân vật */}
              {myChars.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">NHÂN VẬT</label>
                  <select value={selectedCharId} onChange={e => setSelectedCharId(e.target.value)}
                    className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-cyan-400/50">
                    {myChars.map(c => <option key={c.id} value={c.id}>{c.name} — {(c.stats?.gold ?? 0).toLocaleString()} vàng</option>)}
                  </select>
                </div>
              )}

              {/* Từ */}
              <div>
                <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">TỪ THẾ GIỚI</label>
                <select value={selectedFrom} onChange={e => setSelectedFrom(e.target.value)}
                  className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-cyan-400/50">
                  <option value="">-- Chọn thế giới --</option>
                  {rates.map(r => <option key={r.worldSlug} value={r.worldSlug}>{r.currencySymbol} {r.currencyName} ({r.worldName || r.worldSlug})</option>)}
                </select>
              </div>

              {/* Sang */}
              <div>
                <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">SANG THẾ GIỚI</label>
                <select value={selectedTo} onChange={e => setSelectedTo(e.target.value)}
                  className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-cyan-400/50">
                  <option value="">-- Chọn thế giới --</option>
                  {rates.filter(r => r.worldSlug !== selectedFrom).map(r => <option key={r.worldSlug} value={r.worldSlug}>{r.currencySymbol} {r.currencyName} ({r.worldName || r.worldSlug})</option>)}
                </select>
              </div>

              {/* Số lượng */}
              <div>
                <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">SỐ LƯỢNG ĐỔI</label>
                <input type="number" value={exchangeAmt} onChange={e => setExchangeAmt(e.target.value)} placeholder="0"
                  className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-cyan-400/50" />
              </div>

              {/* Preview */}
              {fromAmt > 0 && fromCur && toCur && (
                <div className="border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs font-mono space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bạn trả:</span>
                    <span className="text-yellow-400">{fromAmt.toLocaleString()} {fromCur.currencySymbol} = {Math.ceil(goldValue).toLocaleString()} vàng</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phí (1%):</span>
                    <span className="text-red-400">−{fee} vàng</span>
                  </div>
                  <div className="flex justify-between border-t border-border/50 pt-1.5">
                    <span className="text-muted-foreground">Bạn nhận:</span>
                    <span className="text-cyan-400 font-bold">{toAmt.toLocaleString()} {toCur.currencySymbol}</span>
                  </div>
                  {myGold < Math.ceil(goldValue) && (
                    <div className="text-red-400 text-center pt-1">⚠ Không đủ vàng ({myGold.toLocaleString()} / {Math.ceil(goldValue).toLocaleString()})</div>
                  )}
                </div>
              )}

              <button
                onClick={() => exchangeMutation.mutate()}
                disabled={exchangeMutation.isPending || !selectedFrom || !selectedTo || fromAmt <= 0 || toAmt <= 0 || myGold < Math.ceil(goldValue)}
                className="w-full py-3 text-sm font-mono tracking-widest border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exchangeMutation.isPending ? "ĐANG XỬ LÝ..." : "ĐỔI TIỀN"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ TAB: PHÁT HÀNH ═══ */}
        {tab === "setup" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto">
            <div className="border border-border bg-card/50 p-6 space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-yellow-400" />
                <h2 className="font-mono text-sm tracking-widest text-yellow-400">PHÁT HÀNH TIỀN TỆ THẾ GIỚI</h2>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mỗi thế giới có đồng tiền riêng. AI sẽ đặt tên phù hợp với lore — hoặc bạn tự đặt tên.
              </p>

              {myWorlds.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">CHỌN THẾ GIỚI CỦA BẠN</label>
                  <select value={setupSlug} onChange={e => {
                    setSetupSlug(e.target.value);
                    const w = myWorlds.find(w => w.slug === e.target.value);
                    if (w) setSetupName(w.name);
                  }}
                    className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-yellow-400/50">
                    <option value="">-- Chọn thế giới --</option>
                    {myWorlds.map(w => <option key={w.id} value={w.slug}>{w.name}</option>)}
                  </select>
                </div>
              )}

              {!myWorlds.length && (
                <div>
                  <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">WORLD SLUG</label>
                  <input value={setupSlug} onChange={e => setSetupSlug(e.target.value)} placeholder="vd: my-world-123"
                    className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-yellow-400/50" />
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">TÊN THẾ GIỚI</label>
                <input value={setupName} onChange={e => setSetupName(e.target.value)} placeholder="vd: Thế Giới Tu Tiên Vân Mộng"
                  className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-yellow-400/50" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">CHỦ ĐỀ (để AI đặt tên tiền tệ phù hợp)</label>
                <select value={setupTheme} onChange={e => setSetupTheme(e.target.value)}
                  className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-yellow-400/50">
                  {["cultivation", "cyberpunk", "wasteland", "medieval", "space", "steampunk", "wuxia", "fantasy", "horror", "underwater"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="border-t border-border/50 pt-4">
                <div className="text-xs text-muted-foreground tracking-wider mb-3">TỰ ĐẶT TÊN (để trống → AI tự sinh)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">TÊN TIỀN TỆ</label>
                    <input value={customCurrName} onChange={e => setCustomCurrName(e.target.value)} placeholder="vd: Linh Thạch"
                      className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-yellow-400/50" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">BIỂU TƯỢNG</label>
                    <input value={customCurrSymbol} onChange={e => setCustomCurrSymbol(e.target.value)} placeholder="⬡"
                      className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-yellow-400/50" />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending || !setupSlug || !setupName}
                className="w-full py-3 text-sm font-mono tracking-widest border border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {setupMutation.isPending ? "AI ĐANG SINH TÊN TIỀN TỆ..." : "PHÁT HÀNH TIỀN TỆ"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ TAB: KHO BẠC ═══ */}
        {tab === "treasury" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto space-y-4">
            <div className="border border-border bg-card/50 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-green-400" />
                <h2 className="font-mono text-sm tracking-widest text-green-400">QUẢN LÝ KHO BẠC THẾ GIỚI</h2>
              </div>

              <div className="mb-4">
                <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">CHỌN THẾ GIỚI</label>
                <select value={selectedWorldSlug} onChange={e => setSelectedWorldSlug(e.target.value)}
                  className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-green-400/50">
                  <option value="">-- Chọn thế giới --</option>
                  {rates.map(r => <option key={r.worldSlug} value={r.worldSlug}>{r.currencySymbol} {r.worldName || r.worldSlug}</option>)}
                </select>
              </div>

              {selectedTreasury?.treasury && (
                <div className="grid grid-cols-2 gap-3 mb-5 text-xs font-mono">
                  <div className="border border-border p-3 text-center">
                    <div className="text-xl font-bold text-green-400">{selectedTreasury.treasury.balance.toLocaleString()}</div>
                    <div className="text-muted-foreground mt-1">Kho bạc</div>
                  </div>
                  <div className="border border-border p-3 text-center">
                    <div className="text-xl font-bold text-yellow-400">{selectedTreasury.treasury.taxRate}%</div>
                    <div className="text-muted-foreground mt-1">Thuế suất</div>
                  </div>
                  <div className="border border-border p-3 text-center">
                    <div className="text-lg font-bold text-cyan-400">{selectedTreasury.treasury.totalRevenue.toLocaleString()}</div>
                    <div className="text-muted-foreground mt-1">Tổng thu</div>
                  </div>
                  <div className="border border-border p-3 text-center">
                    <div className="text-lg font-bold text-red-400">{selectedTreasury.treasury.totalExpenditure.toLocaleString()}</div>
                    <div className="text-muted-foreground mt-1">Tổng chi</div>
                  </div>
                </div>
              )}

              {selectedWorldSlug && (
                <div className="space-y-4 border-t border-border/50 pt-4">
                  {/* Đặt thuế */}
                  <div>
                    <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">ĐẶT THUẾ SUẤT (0–30%)</label>
                    <div className="flex gap-2">
                      <input type="number" value={newTaxRate} onChange={e => setNewTaxRate(e.target.value)} placeholder="0-30" min="0" max="30"
                        className="flex-1 bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-green-400/50" />
                      <button
                        onClick={() => taxMutation.mutate({ worldSlug: selectedWorldSlug, taxRate: parseInt(newTaxRate) })}
                        disabled={taxMutation.isPending || !newTaxRate}
                        className="px-4 text-xs font-mono border border-green-400/40 text-green-400 hover:bg-green-400/10 transition-all disabled:opacity-40">
                        SET
                      </button>
                    </div>
                  </div>

                  {/* Rút kho bạc */}
                  <div className="border-t border-border/50 pt-4">
                    <label className="text-xs text-muted-foreground tracking-wider block mb-3">RÚT KHO BẠC VÀO NHÂN VẬT</label>
                    {myChars.length > 0 && (
                      <select value={selectedCharId} onChange={e => setSelectedCharId(e.target.value)}
                        className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-green-400/50 mb-2">
                        {myChars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                    <input type="number" value={spendAmount} onChange={e => setSpendAmount(e.target.value)} placeholder="Số vàng rút"
                      className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-green-400/50 mb-2" />
                    <input value={spendReason} onChange={e => setSpendReason(e.target.value)} placeholder="Lý do..."
                      className="w-full bg-background border border-border text-xs font-mono px-3 py-2 focus:outline-none focus:border-green-400/50 mb-3" />
                    <button
                      onClick={() => spendMutation.mutate({ worldSlug: selectedWorldSlug, amount: parseInt(spendAmount), reason: spendReason, characterId: selectedCharId || myChars[0]?.id })}
                      disabled={spendMutation.isPending || !spendAmount || !spendReason}
                      className="w-full py-2.5 text-xs font-mono border border-green-400/50 text-green-400 hover:bg-green-400/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      {spendMutation.isPending ? "ĐANG XỬ LÝ..." : "RÚT KHO BẠC"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
