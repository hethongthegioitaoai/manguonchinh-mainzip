import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, ShoppingCart, Coins, TrendingUp, TrendingDown, Minus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getWorld, SYSTEM_ICONS, type SystemName } from "@/lib/worlds";
import {
  RARITY_COLORS, RARITY_LABELS, SUPPLY_LABELS, SUPPLY_COLORS,
  DEMAND_LABELS, type MarketItem,
} from "@/lib/market";

interface Character {
  id: string;
  name: string;
  level: number;
  stats: { system: SystemName; world_slug: string };
}

interface InventoryItem {
  id: string;
  itemId: string;
  quantity: number;
  item: { id: string; name: string; icon: string; type: string; rarity: string };
}

type Tab = "buy" | "sell";

function PriceTrendIcon({ supplyLevel, demandLevel }: { supplyLevel: string; demandLevel: string }) {
  const isBullish = demandLevel === "high" || demandLevel === "frenzy" || supplyLevel === "scarce" || supplyLevel === "depleted";
  const isBearish = demandLevel === "low" || supplyLevel === "abundant";
  if (isBullish) return <TrendingUp className="w-3 h-3 text-red-400" />;
  if (isBearish) return <TrendingDown className="w-3 h-3 text-green-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

export default function MarketPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("buy");
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [gold, setGold] = useState<number>(500);
  const [resourceLevel, setResourceLevel] = useState<number>(50);
  const [fetching, setFetching] = useState(true);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/characters", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setCharacters(d ?? []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  const char = characters[activeIdx] ?? null;
  const worldSlug = char?.stats?.world_slug ?? "";
  const world = getWorld(worldSlug);
  const worldColor = world?.color ?? "hsl(var(--primary))";

  const loadMarket = useCallback(async () => {
    if (!char) return;
    setLoadingMarket(true);
    try {
      const [mRes, gRes, invRes] = await Promise.all([
        fetch(`/api/market/${worldSlug}`, { credentials: "include" }),
        fetch(`/api/market/${worldSlug}/gold/${char.id}`, { credentials: "include" }),
        fetch(`/api/inventory/${char.id}`, { credentials: "include" }),
      ]);
      const [mData, gData, invData] = await Promise.all([mRes.json(), gRes.json(), invRes.json()]);
      setMarketItems(mData.items ?? []);
      setResourceLevel(mData.resourceLevel ?? 50);
      setGold(gData.gold ?? 500);
      setInventoryItems(invData ?? []);
    } catch {
      setMarketItems([]);
    } finally {
      setLoadingMarket(false);
    }
  }, [char, worldSlug]);

  useEffect(() => {
    loadMarket();
  }, [loadMarket]);

  function showToast(msg: string, type: "ok" | "err") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleBuy(mp: MarketItem) {
    if (!char || actionId) return;
    setActionId(mp.id);
    try {
      const res = await fetch(`/api/market/${worldSlug}/buy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: mp.itemId, quantity: 1, characterId: char.id }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message, "err"); return; }
      setGold(data.gold);
      setMarketItems((prev) => prev.map((m) =>
        m.id === mp.id ? { ...m, demandLevel: data.newDemand, currentPrice: data.newPrice } : m
      ));
      showToast(`Mua ${mp.item.icon} ${mp.item.name} — -${data.spent} vàng`, "ok");
    } finally {
      setActionId(null);
    }
  }

  async function handleSell(inv: InventoryItem) {
    if (!char || actionId) return;
    setActionId(inv.id);
    try {
      const res = await fetch(`/api/market/${worldSlug}/sell`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId: inv.id, quantity: 1, characterId: char.id }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message, "err"); return; }
      setGold(data.gold);
      setInventoryItems((prev) =>
        inv.quantity <= 1
          ? prev.filter((i) => i.id !== inv.id)
          : prev.map((i) => i.id === inv.id ? { ...i, quantity: i.quantity - 1 } : i)
      );
      showToast(`Bán ${inv.item.icon} ${inv.item.name} — +${data.earned} vàng`, "ok");
    } finally {
      setActionId(null);
    }
  }

  const rarities = ["all", ...Array.from(new Set(marketItems.map((m) => m.item.rarity)))];
  const types = ["all", ...Array.from(new Set(marketItems.map((m) => m.item.type)))];

  const filteredItems = marketItems.filter((m) => {
    if (filterRarity !== "all" && m.item.rarity !== filterRarity) return false;
    if (filterType !== "all" && m.item.type !== filterType) return false;
    return true;
  });

  const sellableItems = inventoryItems.filter((inv) => !inv.item || true);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-orbitron text-primary animate-pulse tracking-widest">INITIALIZING...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-96 pointer-events-none z-0"
        style={{ background: `radial-gradient(ellipse at 30% -10%, ${worldColor}18, transparent 65%)` }}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 font-mono text-xs px-4 py-2 border backdrop-blur-sm"
            style={
              toast.type === "ok"
                ? { borderColor: worldColor, color: worldColor, backgroundColor: `${worldColor}15` }
                : { borderColor: "hsl(var(--destructive))", color: "hsl(var(--destructive))", backgroundColor: "hsl(var(--destructive)/0.1)" }
            }
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-border/40">
        <Button
          variant="ghost" size="sm"
          onClick={() => setLocation("/dashboard")}
          className="rounded-none font-mono text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 transition-all"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> DASHBOARD
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: worldColor }} />
          <span className="font-orbitron text-sm tracking-widest" style={{ color: worldColor }}>CHỢ ĐEN</span>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {fetching && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!fetching && characters.length === 0 && (
          <div className="text-center py-32 font-orbitron text-muted-foreground">Chưa có nhân vật.</div>
        )}

        {!fetching && char && (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs tracking-widest mb-1" style={{ color: worldColor }}>
                  {world?.name} — {world?.title}
                </p>
                <h1 className="font-orbitron text-2xl md:text-4xl font-bold tracking-wider">
                  {SYSTEM_ICONS[char.stats.system] ?? "⚡"} {char.name}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                {characters.length > 1 && (
                  <div className="flex gap-2">
                    {characters.map((c, i) => (
                      <button key={c.id} onClick={() => setActiveIdx(i)}
                        className={`w-8 h-8 border font-mono text-xs transition-all ${i === activeIdx ? "border-current" : "border-border text-muted-foreground"}`}
                        style={i === activeIdx ? { borderColor: worldColor, color: worldColor } : {}}
                      >{i + 1}</button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 border px-4 py-2" style={{ borderColor: "#f59e0b40" }}>
                  <Coins className="w-4 h-4 text-yellow-400" />
                  <div>
                    <div className="font-orbitron text-lg font-black text-yellow-400">{gold.toLocaleString()}</div>
                    <div className="font-mono text-xs text-muted-foreground">vàng</div>
                  </div>
                </div>

                <div className="border px-3 py-2" style={{ borderColor: `${worldColor}40` }}>
                  <div className="font-mono text-xs text-muted-foreground/50 mb-0.5">TÀI NGUYÊN THẾ GIỚI</div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-border/40 overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${resourceLevel}%`, backgroundColor: resourceLevel > 60 ? "#4ade80" : resourceLevel > 30 ? "#f97316" : "#ef4444" }}
                      />
                    </div>
                    <span className="font-mono text-xs" style={{ color: resourceLevel > 60 ? "#4ade80" : resourceLevel > 30 ? "#f97316" : "#ef4444" }}>
                      {resourceLevel}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 border-b border-border/40 pb-0">
              {(["buy", "sell"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`font-orbitron text-xs tracking-widest px-5 py-2.5 border-b-2 transition-all ${
                    tab === t ? "border-current text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  style={tab === t ? { borderColor: worldColor, color: worldColor } : {}}
                >
                  {t === "buy" ? "🛒 MUA" : "💰 BÁN"}
                </button>
              ))}
            </div>

            {loadingMarket ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : tab === "buy" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs text-muted-foreground/50">Độ hiếm:</span>
                    {rarities.map((r) => (
                      <button key={r} onClick={() => setFilterRarity(r)}
                        className={`font-mono text-xs px-2 py-1 border transition-all ${filterRarity === r ? "text-foreground" : "text-muted-foreground/50 border-border/30"}`}
                        style={filterRarity === r ? { borderColor: r === "all" ? worldColor : RARITY_COLORS[r], color: r === "all" ? worldColor : RARITY_COLORS[r] } : {}}
                      >
                        {r === "all" ? "Tất cả" : RARITY_LABELS[r] ?? r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredItems.map((mp) => {
                    const rarityColor = RARITY_COLORS[mp.item.rarity] ?? "#9ca3af";
                    const canAfford = gold >= mp.currentPrice;
                    return (
                      <motion.div
                        key={mp.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative border bg-card/50 p-4 transition-all"
                        style={{ borderColor: `${rarityColor}40` }}
                      >
                        <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: rarityColor }} />

                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{mp.item.icon}</span>
                            <div>
                              <div className="font-orbitron text-xs font-bold leading-tight">{mp.item.name}</div>
                              <div className="font-mono text-xs" style={{ color: rarityColor }}>
                                {RARITY_LABELS[mp.item.rarity] ?? mp.item.rarity}
                              </div>
                            </div>
                          </div>
                          <PriceTrendIcon supplyLevel={mp.supplyLevel} demandLevel={mp.demandLevel} />
                        </div>

                        <div className="font-mono text-xs text-muted-foreground/60 mb-3 line-clamp-2 leading-relaxed">
                          {mp.item.description}
                        </div>

                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs text-yellow-400 font-bold">{mp.currentPrice.toLocaleString()}</span>
                              <Coins className="w-3 h-3 text-yellow-400" />
                              {mp.currentPrice !== mp.basePrice && (
                                <span className="font-mono text-xs text-muted-foreground/40 line-through">{mp.basePrice}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <span className="font-mono text-xs px-1.5 py-0.5 border border-border/30"
                              style={{ color: SUPPLY_COLORS[mp.supplyLevel] }}>
                              {SUPPLY_LABELS[mp.supplyLevel]}
                            </span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          disabled={!canAfford || !!actionId}
                          onClick={() => handleBuy(mp)}
                          className="w-full rounded-none font-orbitron text-xs tracking-wide border"
                          style={canAfford ? { borderColor: worldColor, color: worldColor, backgroundColor: `${worldColor}10` } : {}}
                        >
                          {actionId === mp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : canAfford ? "MUA" : "Không đủ vàng"}
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>

                {filteredItems.length === 0 && (
                  <div className="text-center py-16 font-mono text-xs text-muted-foreground/40">
                    Không có vật phẩm nào phù hợp.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className="border border-border/40 bg-card/30 px-4 py-3 font-mono text-xs text-muted-foreground/70"
                >
                  <span style={{ color: worldColor }}>●</span> Bán với giá <span className="text-foreground">60%</span> giá thị trường hiện tại. Bán làm tăng nguồn cung — giá có thể giảm.
                </div>

                {sellableItems.length === 0 ? (
                  <div className="text-center py-16 font-mono text-xs text-muted-foreground/40">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    Túi đồ trống. Hãy mua đồ hoặc nhặt từ chiến đấu.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sellableItems.map((inv) => {
                      const mp = marketItems.find((m) => m.itemId === inv.itemId);
                      const sellPrice = mp ? Math.floor(mp.currentPrice * 0.6) : 10;
                      const rarityColor = RARITY_COLORS[inv.item?.rarity ?? "common"] ?? "#9ca3af";
                      return (
                        <motion.div
                          key={inv.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="relative border bg-card/50 p-4"
                          style={{ borderColor: `${rarityColor}40` }}
                        >
                          <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: rarityColor }} />
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">{inv.item?.icon ?? "📦"}</span>
                            <div className="flex-1">
                              <div className="font-orbitron text-xs font-bold">{inv.item?.name ?? "Unknown"}</div>
                              <div className="font-mono text-xs text-muted-foreground/50">x{inv.quantity}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs text-yellow-400 font-bold">+{sellPrice.toLocaleString()}</span>
                              <Coins className="w-3 h-3 text-yellow-400" />
                            </div>
                            <span className="font-mono text-xs text-muted-foreground/40">{mp ? `giá chợ: ${mp.currentPrice}` : ""}</span>
                          </div>
                          <Button
                            size="sm"
                            disabled={!!actionId}
                            onClick={() => handleSell(inv)}
                            className="w-full rounded-none font-orbitron text-xs tracking-wide border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
                          >
                            {actionId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "BÁN"}
                          </Button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
