import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, Loader2, ShoppingBag, ArrowRight, Globe,
  Sparkles, RefreshCw, Plus, Minus, Coins, Clock, History, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface Item { id: string; name: string; type: string; rarity: string; worldSlug: string; icon: string; description: string }
interface Listing {
  listing: { id: string; fromWorldSlug: string; toWorldSlug: string; priceGold: number; quantity: number; status: string; expiresAt: string; createdAt: string };
  item: Item;
  seller: { id: string; name: string; level: number };
}
interface InventoryEntry { invId: string; qty: number; item: Item }
interface CharData { char: { id: string; name: string; level: number; stats: Record<string, unknown> }; gold: number; inventory: InventoryEntry[] }
interface TradeHistory {
  trade: { id: string; renamedItemName: string; soldAt: string; priceGold: number };
  listing: { fromWorldSlug: string; toWorldSlug: string; quantity: number };
  item: Item;
}

const WORLD_LABELS: Record<string, string> = {
  cultivation: "Tu Tiên", cyberpunk: "Cyberpunk", zombie: "Vùng Hoang Phế",
  tu_tien: "Tu Tiên", fantasy: "Fantasy", horror: "Kinh Dị",
  scifi: "Sci-Fi", wasteland: "Hoang Phế", steampunk: "Steampunk", xianxia: "Tiên Hiệp",
};
const RARITY_COLOR: Record<string, string> = {
  common: "#9ca3af", uncommon: "#34d399", rare: "#60a5fa", epic: "#a78bfa", legendary: "#f59e0b",
};
function timeLeft(d: string) {
  const h = Math.max(0, Math.floor((new Date(d).getTime() - Date.now()) / 3600000));
  if (h <= 0) return "hết hạn";
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}p`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

const TRADE_COLOR = "#34d399";

export default function WorldTradePage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [listings, setListings] = useState<Listing[]>([]);
  const [history, setHistory] = useState<TradeHistory[]>([]);
  const [myChars, setMyChars] = useState<CharData[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<"market" | "sell" | "history">("market");
  const [filterFrom, setFilterFrom] = useState("");

  // Sell form
  const [sellChar, setSellChar] = useState<CharData | null>(null);
  const [sellItem, setSellItem] = useState<InventoryEntry | null>(null);
  const [sellQty, setSellQty] = useState(1);
  const [sellPrice, setSellPrice] = useState(100);
  const [sellToWorld, setSellToWorld] = useState("any");
  const [listing, setListing] = useState(false);
  const [listMsg, setListMsg] = useState<string | null>(null);

  // Buy
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyChar, setBuyChar] = useState<string>("");
  const [buyMsg, setBuyMsg] = useState<{ id: string; msg: string; cross: boolean } | null>(null);

  useEffect(() => { if (!loading && !user) setLocation("/login"); }, [user, loading]);

  const loadAll = useCallback(async () => {
    setFetching(true);
    try {
      const [lRes, hRes, cRes] = await Promise.all([
        fetch("/api/world-trade"),
        fetch("/api/world-trade/history"),
        fetch("/api/world-trade/my-chars"),
      ]);
      const [lData, hData, cData] = await Promise.all([lRes.json(), hRes.json(), cRes.json()]);
      setListings(Array.isArray(lData) ? lData : []);
      setHistory(Array.isArray(hData) ? hData : []);
      setMyChars(Array.isArray(cData) ? cData : []);
      if (cData.length && !sellChar) setSellChar(cData[0]);
      if (cData.length && !buyChar) setBuyChar(cData[0]?.char?.id ?? "");
    } finally { setFetching(false); }
  }, []);

  useEffect(() => { if (user) loadAll(); }, [user]);

  const handleList = async () => {
    if (!sellChar || !sellItem) return;
    setListing(true); setListMsg(null);
    try {
      const r = await fetch("/api/world-trade/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: sellChar.char.id,
          itemId: sellItem.item.id,
          quantity: sellQty,
          priceGold: sellPrice,
          toWorldSlug: sellToWorld,
        }),
      });
      const d = await r.json();
      setListMsg(d.message ?? d.error);
      if (r.ok) { setSellItem(null); await loadAll(); }
    } finally { setListing(false); }
  };

  const handleBuy = async (listingId: string) => {
    if (!buyChar) return;
    setBuyingId(listingId);
    try {
      const r = await fetch(`/api/world-trade/${listingId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: buyChar }),
      });
      const d = await r.json();
      setBuyMsg({ id: listingId, msg: d.message ?? d.error, cross: !!d.isCrossWorld });
      setTimeout(() => setBuyMsg(null), 6000);
      if (r.ok) await loadAll();
    } finally { setBuyingId(null); }
  };

  const handleCancel = async (listingId: string) => {
    await fetch(`/api/world-trade/${listingId}/cancel`, { method: "DELETE" });
    await loadAll();
  };

  const allWorlds = [...new Set(listings.map(l => l.listing.fromWorldSlug))];
  const filteredListings = filterFrom ? listings.filter(l => l.listing.fromWorldSlug === filterFrom) : listings;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/30 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/dashboard")} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Globe className="w-5 h-5 flex-shrink-0" style={{ color: TRADE_COLOR }} strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <div className="font-orbitron text-sm font-bold tracking-widest" style={{ color: TRADE_COLOR }}>
              GIAO THƯƠNG LIÊN THẾ GIỚI
            </div>
            <div className="font-mono text-xs text-muted-foreground/60">{listings.length} listing · phí cổng 5%</div>
          </div>
          <button onClick={loadAll} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Banner */}
        <div className="border border-emerald-500/20 bg-emerald-500/5 p-4"
          style={{ boxShadow: "inset 0 0 40px rgba(52,211,153,0.04)" }}>
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: TRADE_COLOR }} strokeWidth={1.5} />
            <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed">
              <span style={{ color: TRADE_COLOR }} className="font-bold">Rào Cản Thế Giới:</span>{" "}
              Item từ thế giới khác khi vượt cổng sẽ được AI nhận thức lại theo lore của thế giới bạn — tên thay đổi, bản chất giữ nguyên.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border/40">
          {([
            { id: "market" as const, label: "CHỢ", icon: ShoppingBag, count: filteredListings.length },
            { id: "sell" as const, label: "ĐĂng BÁN", icon: Plus, count: 0 },
            { id: "history" as const, label: "LỊCH SỬ", icon: History, count: history.length },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 font-orbitron text-xs font-bold tracking-widest transition-all border-b-2"
              style={{
                borderColor: activeTab === tab.id ? TRADE_COLOR : "transparent",
                color: activeTab === tab.id ? TRADE_COLOR : "rgba(255,255,255,0.35)",
              }}>
              <tab.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {tab.label}
              {tab.count > 0 && (
                <span className="font-mono text-xs px-1.5 rounded-full"
                  style={{ background: `${TRADE_COLOR}20`, color: TRADE_COLOR }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Market */}
        {activeTab === "market" && (
          <div className="space-y-4">
            {/* Filter by world */}
            <div className="flex gap-2 flex-wrap">
              {["", ...allWorlds].map(w => (
                <button key={w || "all"} onClick={() => setFilterFrom(w)}
                  className="px-3 py-1.5 font-mono text-xs border transition-all"
                  style={{
                    borderColor: filterFrom === w ? TRADE_COLOR : "rgba(255,255,255,0.1)",
                    color: filterFrom === w ? TRADE_COLOR : "rgba(255,255,255,0.4)",
                    background: filterFrom === w ? `${TRADE_COLOR}15` : "transparent",
                  }}>
                  {w ? WORLD_LABELS[w] ?? w : "TẤT CẢ"}
                </button>
              ))}
            </div>

            {/* Buyer character select */}
            {myChars.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground/50">Mua bằng nhân vật:</span>
                <select value={buyChar} onChange={e => setBuyChar(e.target.value)}
                  className="bg-card border border-border/40 font-mono text-xs px-2 py-1 text-foreground outline-none">
                  {myChars.map(cd => (
                    <option key={cd.char.id} value={cd.char.id}>
                      {cd.char.name} (Lv.{cd.char.level}) — {cd.gold} vàng
                    </option>
                  ))}
                </select>
              </div>
            )}

            {fetching ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : filteredListings.length === 0 ? (
              <div className="text-center py-16 font-mono text-xs text-muted-foreground/40">
                <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-20" strokeWidth={1} />
                Chợ đang trống. Hãy là người đầu tiên mở gian hàng!
              </div>
            ) : filteredListings.map(row => {
              const { listing: l, item, seller } = row;
              const isMyListing = myChars.some(c => c.char.id === l.id);
              const totalWithFee = Math.ceil(l.priceGold * 1.05);
              const buyerGold = myChars.find(c => c.char.id === buyChar)?.gold ?? 0;
              const isCross = buyChar && myChars.find(c => c.char.id === buyChar)?.char.stats
                ? (myChars.find(c => c.char.id === buyChar)?.char.stats as any)?.worldSlug !== l.fromWorldSlug
                : false;

              return (
                <motion.div key={l.id} layout
                  className="border border-border/40 bg-card/30 p-4 space-y-3"
                  style={{ borderColor: isCross ? `${TRADE_COLOR}30` : undefined }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-orbitron text-sm font-bold"
                            style={{ color: RARITY_COLOR[item.rarity] ?? "#9ca3af" }}>{item.name}</span>
                          {isCross && <span className="font-mono text-xs px-1.5 py-0.5 border"
                            style={{ borderColor: `${TRADE_COLOR}40`, color: TRADE_COLOR, background: `${TRADE_COLOR}10` }}>
                            ⚡ CROSS-WORLD
                          </span>}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground/50 mt-0.5">
                          <span style={{ color: TRADE_COLOR }}>{WORLD_LABELS[l.fromWorldSlug] ?? l.fromWorldSlug}</span>
                          {l.toWorldSlug !== "any" && <><ArrowRight className="w-3 h-3 inline mx-1" />{WORLD_LABELS[l.toWorldSlug] ?? l.toWorldSlug}</>}
                          {l.toWorldSlug === "any" && " → Mọi thế giới"}
                          {" · "}x{l.quantity}
                          {" · "}bởi {seller.name} Lv.{seller.level}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <div className="font-orbitron text-sm font-bold" style={{ color: "#facc15" }}>
                        {l.priceGold.toLocaleString()} <span className="text-xs font-mono">vàng</span>
                      </div>
                      <div className="font-mono text-xs text-muted-foreground/40">
                        +5% = {totalWithFee.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground/40">
                        <Clock className="w-3 h-3" strokeWidth={1.5} />{timeLeft(l.expiresAt)}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {buyMsg?.id === l.id && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="font-mono text-xs p-3 border"
                        style={{
                          borderColor: buyMsg.cross ? `${TRADE_COLOR}40` : "rgba(255,255,255,0.1)",
                          color: buyMsg.cross ? TRADE_COLOR : "rgba(255,255,255,0.7)",
                          background: buyMsg.cross ? `${TRADE_COLOR}08` : "transparent",
                        }}>
                        {buyMsg.cross && "✨ "}{buyMsg.msg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-2">
                    {myChars.some(c => c.char.id === l.sellerCharacterId) ? (
                      <button onClick={() => handleCancel(l.id)}
                        className="font-mono text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-1.5 transition-all flex items-center gap-1.5">
                        <X className="w-3 h-3" strokeWidth={1.5} /> HUỶ LISTING
                      </button>
                    ) : (
                      <Button size="sm" disabled={buyingId === l.id || buyerGold < totalWithFee || !buyChar}
                        onClick={() => handleBuy(l.id)}
                        className="rounded-none font-orbitron text-xs border h-8 px-4"
                        style={{ borderColor: TRADE_COLOR, background: `${TRADE_COLOR}20`, color: TRADE_COLOR }}>
                        {buyingId === l.id ? <Loader2 className="w-3 h-3 animate-spin" />
                          : buyerGold < totalWithFee ? `Thiếu ${(totalWithFee - buyerGold).toLocaleString()} vàng`
                            : <><ShoppingBag className="w-3 h-3 mr-1.5" />MUA — {totalWithFee.toLocaleString()} vàng</>}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Tab: Sell */}
        {activeTab === "sell" && (
          <div className="space-y-4">
            {myChars.length === 0 ? (
              <div className="text-center py-16 font-mono text-xs text-muted-foreground/40">
                Bạn chưa có nhân vật nào.
              </div>
            ) : (
              <div className="border border-border/40 bg-card/30 p-5 space-y-5">
                {/* Chọn nhân vật bán */}
                <div>
                  <p className="font-mono text-xs text-muted-foreground/50 mb-2">NHÂN VẬT BÁN</p>
                  <div className="flex gap-2 flex-wrap">
                    {myChars.map(cd => (
                      <button key={cd.char.id} onClick={() => { setSellChar(cd); setSellItem(null); }}
                        className="px-3 py-2 border font-mono text-xs transition-all"
                        style={{
                          borderColor: sellChar?.char.id === cd.char.id ? TRADE_COLOR : "rgba(255,255,255,0.1)",
                          color: sellChar?.char.id === cd.char.id ? TRADE_COLOR : "rgba(255,255,255,0.5)",
                          background: sellChar?.char.id === cd.char.id ? `${TRADE_COLOR}15` : "transparent",
                        }}>
                        {cd.char.name} · {cd.gold} 💰
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inventory của nhân vật */}
                {sellChar && (
                  <div>
                    <p className="font-mono text-xs text-muted-foreground/50 mb-2">CHỌN ITEM ĐĂng BÁN</p>
                    {sellChar.inventory.length === 0 ? (
                      <p className="font-mono text-xs text-muted-foreground/40">Túi đồ trống.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {sellChar.inventory.map(inv => (
                          <button key={inv.invId} onClick={() => { setSellItem(inv); setSellQty(1); }}
                            className="p-3 border text-left transition-all"
                            style={{
                              borderColor: sellItem?.invId === inv.invId ? TRADE_COLOR : "rgba(255,255,255,0.1)",
                              background: sellItem?.invId === inv.invId ? `${TRADE_COLOR}10` : "transparent",
                            }}>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{inv.item.icon}</span>
                              <div className="min-w-0">
                                <div className="font-mono text-xs font-bold truncate"
                                  style={{ color: RARITY_COLOR[inv.item.rarity] ?? "#9ca3af" }}>{inv.item.name}</div>
                                <div className="font-mono text-xs text-muted-foreground/40">x{inv.qty}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Config listing */}
                {sellItem && (
                  <div className="space-y-4 border-t border-border/30 pt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{sellItem.item.icon}</span>
                      <span className="font-orbitron text-sm font-bold"
                        style={{ color: RARITY_COLOR[sellItem.item.rarity] ?? "#9ca3af" }}>{sellItem.item.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground/50 mb-1.5">SỐ LƯỢNG</p>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSellQty(q => Math.max(1, q - 1))}
                            className="w-7 h-7 border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground">
                            <Minus className="w-3 h-3" strokeWidth={1.5} />
                          </button>
                          <span className="font-mono text-sm w-8 text-center">{sellQty}</span>
                          <button onClick={() => setSellQty(q => Math.min(sellItem.qty, q + 1))}
                            className="w-7 h-7 border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground">
                            <Plus className="w-3 h-3" strokeWidth={1.5} />
                          </button>
                          <span className="font-mono text-xs text-muted-foreground/40">/ {sellItem.qty}</span>
                        </div>
                      </div>
                      <div>
                        <p className="font-mono text-xs text-muted-foreground/50 mb-1.5">GIÁ (VÀNG)</p>
                        <input type="number" value={sellPrice} onChange={e => setSellPrice(Math.max(1, +e.target.value))}
                          className="bg-transparent border-b border-border/40 font-mono text-sm w-full outline-none pb-1 text-foreground" />
                      </div>
                    </div>
                    <div>
                      <p className="font-mono text-xs text-muted-foreground/50 mb-1.5">BÁN CHO THẾ GIỚI</p>
                      <select value={sellToWorld} onChange={e => setSellToWorld(e.target.value)}
                        className="bg-card border border-border/40 font-mono text-xs px-2 py-1.5 text-foreground outline-none w-full">
                        <option value="any">Tất cả thế giới</option>
                        <option value="cultivation">Tu Tiên</option>
                        <option value="cyberpunk">Cyberpunk</option>
                        <option value="zombie">Vùng Hoang Phế</option>
                        <option value="tu_tien">Tu Tiên (custom)</option>
                        <option value="fantasy">Fantasy</option>
                        <option value="horror">Kinh Dị</option>
                        <option value="scifi">Sci-Fi</option>
                        <option value="wasteland">Hoang Phế</option>
                        <option value="steampunk">Steampunk</option>
                        <option value="xianxia">Tiên Hiệp</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground/40">
                        Bạn nhận: {sellPrice.toLocaleString()} vàng · hết hạn 48h
                      </span>
                      <Button size="sm" disabled={listing} onClick={handleList}
                        className="rounded-none font-orbitron text-xs border h-8 px-4"
                        style={{ borderColor: TRADE_COLOR, background: `${TRADE_COLOR}20`, color: TRADE_COLOR }}>
                        {listing ? <Loader2 className="w-3 h-3 animate-spin" /> : "ĐĂng BÁN"}
                      </Button>
                    </div>
                    {listMsg && <p className="font-mono text-xs" style={{ color: listMsg.includes("Đã") ? TRADE_COLOR : "#f87171" }}>{listMsg}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: History */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-16 font-mono text-xs text-muted-foreground/40">
                <History className="w-10 h-10 mx-auto mb-3 opacity-20" strokeWidth={1} />
                Chưa có giao dịch nào.
              </div>
            ) : history.map(row => {
              const { trade, listing: l, item } = row;
              const isCross = trade.renamedItemName && trade.renamedItemName !== item.name;
              return (
                <div key={trade.id} className="border border-border/40 bg-card/20 p-4 flex items-center gap-4">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-orbitron text-xs font-bold">{item.name}</span>
                      {isCross && (
                        <span className="font-mono text-xs" style={{ color: TRADE_COLOR }}>
                          → "{trade.renamedItemName}"
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground/50 mt-0.5">
                      {WORLD_LABELS[l.fromWorldSlug] ?? l.fromWorldSlug}
                      <ArrowRight className="w-3 h-3 inline mx-1" />
                      {WORLD_LABELS[l.toWorldSlug] ?? l.toWorldSlug}
                      {" · "}x{l.quantity} · {timeAgo(trade.soldAt)} trước
                    </div>
                  </div>
                  <div className="font-mono text-xs font-bold flex-shrink-0" style={{ color: "#facc15" }}>
                    {trade.priceGold.toLocaleString()} 💰
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
