import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Home, TrendingUp, Loader2, ArrowLeft, Hammer, ArrowDownToLine, Wallet, Globe, Filter, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const PLOT_ICONS: Record<string, string> = {
  farmland:  "🌾",
  shop:      "🏪",
  mine:      "⛏️",
  residence: "🏠",
};
const PLOT_COLORS: Record<string, string> = {
  farmland:  "#22c55e",
  shop:      "#f97316",
  mine:      "#a855f7",
  residence: "#06b6d4",
};

function PlotCard({ plot, isOwned, onBuy, onSell, onUpgrade, onCollect, myCharId }: any) {
  const [sellPrice, setSellPrice] = useState("");
  const [showSell, setShowSell] = useState(false);
  const color = PLOT_COLORS[plot.plotType] ?? "#64748b";
  const incomePerH = (plot.baseIncome ?? 5) * (plot.upgradeLevel ?? 1);
  const pendingIncome = plot.pendingIncome ?? 0;

  return (
    <div className={`border p-3 space-y-2 ${isOwned ? "border-cyan-500/40 bg-cyan-500/5" : "border-border/40 bg-card/30"}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{PLOT_ICONS[plot.plotType]}</span>
          <div>
            <p className="font-mono text-xs font-bold" style={{ color }}>{plot.plotName}</p>
            <p className="font-mono text-xs text-muted-foreground/60">{plot.plotType} · Cấp {plot.upgradeLevel}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs" style={{ color }}>{incomePerH} gold/h</p>
          {isOwned && pendingIncome > 0 && <p className="font-mono text-xs text-green-400">+{pendingIncome} chờ</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isOwned && plot.isForSale && (
          <Button size="sm" className="font-mono text-xs h-7" style={{ background: color + "20", color, border: `1px solid ${color}40` }}
            onClick={() => onBuy(plot.id)}>
            <Wallet className="w-3 h-3 mr-1" /> Mua {(plot.salePrice ?? plot.purchasePrice).toLocaleString()}g
          </Button>
        )}
        {isOwned && (
          <>
            {pendingIncome > 0 && (
              <Button size="sm" className="font-mono text-xs h-7 bg-green-600/20 text-green-400 border border-green-600/30"
                onClick={() => onCollect(plot.id)}>
                <ArrowDownToLine className="w-3 h-3 mr-1" /> Thu {pendingIncome}g
              </Button>
            )}
            {plot.upgradeLevel < 5 && (
              <Button size="sm" variant="outline" className="font-mono text-xs h-7"
                onClick={() => onUpgrade(plot.id)}>
                <Hammer className="w-3 h-3 mr-1" /> Nâng cấp
              </Button>
            )}
            {!showSell ? (
              <Button size="sm" variant="ghost" className="font-mono text-xs h-7 text-muted-foreground"
                onClick={() => setShowSell(true)}>
                <ArrowUpFromLine className="w-3 h-3 mr-1" /> Bán
              </Button>
            ) : (
              <div className="flex items-center gap-2 w-full">
                <Input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                  placeholder="Giá bán..." className="font-mono text-xs h-7 flex-1" />
                <Button size="sm" className="font-mono text-xs h-7" onClick={() => { onSell(plot.id, parseInt(sellPrice)); setShowSell(false); }}
                  disabled={!sellPrice || parseInt(sellPrice) <= 0}>OK</Button>
                <Button size="sm" variant="ghost" className="font-mono text-xs h-7" onClick={() => setShowSell(false)}>✕</Button>
              </div>
            )}
          </>
        )}
        {!isOwned && !plot.isForSale && (
          <span className="font-mono text-xs text-muted-foreground/40">Không rao bán</span>
        )}
      </div>
    </div>
  );
}

export default function RealEstatePage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"market" | "my">("market");
  const [selectedWorld, setSelectedWorld] = useState("");
  const [filterType, setFilterType] = useState("all");

  const { data: mapData } = useQuery<any>({ queryKey: ["/api/diplomacy/map"], queryFn: () => fetch("/api/diplomacy/map").then(r => r.json()) });
  const allWorlds = mapData?.worlds ?? [];

  const { data: worldPlots = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/realestate", selectedWorld],
    queryFn: () => fetch(`/api/realestate/${selectedWorld}`).then(r => r.json()),
    enabled: !!selectedWorld,
    refetchInterval: 30000,
  });

  const { data: myPlots = [], isLoading: loadingMy } = useQuery<any[]>({
    queryKey: ["/api/realestate/my-plots"],
    queryFn: () => fetch("/api/realestate/my-plots").then(r => r.json()),
    enabled: !!user && activeTab === "my",
    refetchInterval: 30000,
  });

  const { data: myChar } = useQuery<any>({ queryKey: ["/api/characters/my-character"], queryFn: () => fetch("/api/characters/my-character").then(r => r.json()), enabled: !!user });

  const buyMut = useMutation({
    mutationFn: (plotId: string) => fetch(`/api/realestate/buy/${plotId}`, { method: "POST" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); qc.invalidateQueries({ queryKey: ["/api/realestate"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const sellMut = useMutation({
    mutationFn: ({ plotId, salePrice }: any) => fetch(`/api/realestate/sell/${plotId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ salePrice }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); qc.invalidateQueries({ queryKey: ["/api/realestate"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const upgradeMut = useMutation({
    mutationFn: (plotId: string) => fetch(`/api/realestate/upgrade/${plotId}`, { method: "POST" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); qc.invalidateQueries({ queryKey: ["/api/realestate"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const collectMut = useMutation({
    mutationFn: (plotId: string) => fetch(`/api/realestate/collect/${plotId}`, { method: "POST" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); qc.invalidateQueries({ queryKey: ["/api/realestate"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const collectAllMut = useMutation({
    mutationFn: () => fetch("/api/realestate/collect-all", { method: "POST" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => { toast.success(d.message); qc.invalidateQueries({ queryKey: ["/api/realestate"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const myCharId = myChar?.id;
  const filteredPlots = (activeTab === "market" ? worldPlots : myPlots).filter((p: any) =>
    filterType === "all" || p.plotType === filterType
  );

  const totalPendingIncome = myPlots.reduce((s: number, p: any) => s + (p.pendingIncome ?? 0), 0);

  const tabs = [
    { id: "market", label: "CHỢ ĐẤT ĐAI", icon: Globe },
    { id: "my",     label: "TÀI SẢN CỦA TÔI", icon: Home },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold tracking-wider text-cyan-400">BẤT ĐỘNG SẢN THẾ GIỚI</h1>
            <p className="font-mono text-xs text-muted-foreground">Mua đất — thu nhập thụ động — nâng cấp — bán lại</p>
          </div>
        </div>

        {/* My stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-border/40 bg-card/30 p-3 text-center">
            <p className="font-orbitron text-lg font-bold text-cyan-400">{myPlots.length}</p>
            <p className="font-mono text-xs text-muted-foreground">Mảnh Đất Sở Hữu</p>
          </div>
          <div className="border border-border/40 bg-card/30 p-3 text-center">
            <p className="font-orbitron text-lg font-bold text-green-400">{totalPendingIncome.toLocaleString()}</p>
            <p className="font-mono text-xs text-muted-foreground">Gold Đang Chờ Thu</p>
          </div>
          <div className="border border-border/40 bg-card/30 p-3 text-center">
            <p className="font-orbitron text-lg font-bold text-yellow-400">{myPlots.reduce((s: number, p: any) => s + (p.baseIncome ?? 0) * (p.upgradeLevel ?? 1), 0)}</p>
            <p className="font-mono text-xs text-muted-foreground">Gold/Giờ Tổng</p>
          </div>
        </div>

        {/* Collect all */}
        {totalPendingIncome > 0 && (
          <Button className="font-mono text-xs bg-green-600/20 text-green-400 border border-green-600/30"
            onClick={() => collectAllMut.mutate()} disabled={collectAllMut.isPending}>
            {collectAllMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ArrowDownToLine className="w-3.5 h-3.5 mr-1" />}
            Thu Tất Cả ({totalPendingIncome.toLocaleString()} gold)
          </Button>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs transition-all ${
                  activeTab === t.id ? "text-cyan-400 border-b-2 border-cyan-400" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3">
          {activeTab === "market" && (
            <Select value={selectedWorld} onValueChange={setSelectedWorld}>
              <SelectTrigger className="font-mono text-xs w-44 h-8"><SelectValue placeholder="Chọn thế giới..." /></SelectTrigger>
              <SelectContent>
                {allWorlds.map((w: any) => <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="font-mono text-xs w-36 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-mono text-xs">Tất cả loại</SelectItem>
              <SelectItem value="farmland" className="font-mono text-xs">🌾 Nông Điền</SelectItem>
              <SelectItem value="shop" className="font-mono text-xs">🏪 Cửa Hàng</SelectItem>
              <SelectItem value="mine" className="font-mono text-xs">⛏️ Khoáng Mỏ</SelectItem>
              <SelectItem value="residence" className="font-mono text-xs">🏠 Cư Sở</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Plot grid */}
        {(isLoading && activeTab === "market") || (loadingMy && activeTab === "my") ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
        ) : filteredPlots.length === 0 ? (
          <div className="border border-border/30 bg-card/20 p-8 text-center">
            <Home className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="font-mono text-xs text-muted-foreground/50">
              {activeTab === "market" && !selectedWorld ? "Chọn thế giới để xem bất động sản" : "Không có đất nào phù hợp"}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {filteredPlots.map((plot: any) => (
              <PlotCard
                key={plot.id} plot={plot}
                isOwned={plot.ownerCharId === myCharId}
                onBuy={(id: string) => buyMut.mutate(id)}
                onSell={(id: string, price: number) => sellMut.mutate({ plotId: id, salePrice: price })}
                onUpgrade={(id: string) => upgradeMut.mutate(id)}
                onCollect={(id: string) => collectMut.mutate(id)}
                myCharId={myCharId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
