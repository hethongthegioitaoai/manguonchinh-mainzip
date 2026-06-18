import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Gavel, Search, Clock, Coins, ShoppingBag, Plus, RefreshCw, Tag } from "lucide-react";

const RARITY_COLOR: Record<string, string> = {
  common: "#94a3b8", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b",
};
const RARITY_LABEL: Record<string, string> = {
  common: "Thường", uncommon: "Hiếm", rare: "Quý", epic: "Sử Thi", legendary: "Huyền Thoại",
};

function timeLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Đã kết thúc";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}g ${m}p` : `${m} phút`;
}

interface AuctionListing {
  id: string; sellerCharId: string; itemId: string; itemName: string; itemIcon: string;
  itemRarity: string; worldSlug: string; startBid: number; currentBid: number;
  currentBidderId: string | null; buyoutPrice: number | null; quantity: number;
  status: string; expiresAt: string; createdAt: string;
}
interface AuctionRow { listing: AuctionListing; seller: { id: string; name: string; level: number }; }
interface InventoryItem { inv: { id: string; itemId: string; quantity: number; equippedSlot: string | null }; item: { id: string; name: string; icon: string; rarity: string; }; }
interface CharWithInv { character: { id: string; name: string; level: number; stats: any }; inventory: InventoryItem[]; }
interface MyData { listings: AuctionListing[]; bids: { bid: { id: string; auctionId: string; bidAmount: number; bidAt: string }; listing: AuctionListing }[]; }

export default function AuctionPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"market" | "sell" | "mine">("market");
  const [search, setSearch] = useState("");
  const [bidAuctionId, setBidAuctionId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [selectedCharId, setSelectedCharId] = useState("");
  const [selectedInvId, setSelectedInvId] = useState("");
  const [startBid, setStartBid] = useState("");
  const [buyout, setBuyout] = useState("");
  const [duration, setDuration] = useState("24");

  const { data: market = [], isLoading: marketLoading, refetch } = useQuery<AuctionRow[]>({
    queryKey: ["/api/auction/list"],
    queryFn: async () => { const r = await fetch("/api/auction/list", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
  });

  const { data: chars = [] } = useQuery<CharWithInv[]>({
    queryKey: ["/api/auction/my-chars"],
    queryFn: async () => { const r = await fetch("/api/auction/my-chars", { credentials: "include" }); if (!r.ok) return []; return r.json(); },
  });

  const { data: myData } = useQuery<MyData>({
    queryKey: ["/api/auction/my"],
    queryFn: async () => { const r = await fetch("/api/auction/my", { credentials: "include" }); if (!r.ok) return { listings: [], bids: [] }; return r.json(); },
  });

  const activeChar = chars.find(c => c.character.id === selectedCharId) ?? chars[0];
  const myGold = activeChar ? (activeChar.character.stats?.gold ?? 0) : 0;

  const bidMutation = useMutation({
    mutationFn: async ({ auctionId, charId, amount }: { auctionId: string; charId: string; amount: number }) => {
      const r = await fetch(`/api/auction/${auctionId}/bid`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charId, amount }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Đặt giá thành công!");
      setBidAuctionId(null); setBidAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/auction/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auction/my-chars"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const buyoutMutation = useMutation({
    mutationFn: async ({ auctionId, charId }: { auctionId: string; charId: string }) => {
      const r = await fetch(`/api/auction/${auctionId}/buyout`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charId }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`Đã mua ngay: ${d.itemName}`);
      queryClient.invalidateQueries({ queryKey: ["/api/auction/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auction/my-chars"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const listMutation = useMutation({
    mutationFn: async (data: { charId: string; inventoryId: string; startBid: number; buyoutPrice?: number; durationHours: number }) => {
      const r = await fetch("/api/auction/list-item", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Đã đăng đấu giá!");
      setSelectedInvId(""); setStartBid(""); setBuyout(""); setDuration("24");
      queryClient.invalidateQueries({ queryKey: ["/api/auction/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auction/my-chars"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auction/my"] });
      setTab("market");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ auctionId, charId }: { auctionId: string; charId: string }) => {
      const r = await fetch(`/api/auction/${auctionId}/cancel`, {
        method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charId }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Đã huỷ đấu giá, vật phẩm trả về túi đồ");
      queryClient.invalidateQueries({ queryKey: ["/api/auction/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auction/my-chars"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = market.filter(r =>
    r.listing.itemName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Courier New', monospace" }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-cyan-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-cyan-400" />
              <h1 className="text-xl font-bold tracking-widest text-cyan-400">NHÀ ĐẤU GIÁ</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wider">ĐẶT GIÁ — TRANH GIÀNH — CHIẾN THẮNG</p>
          </div>
          {activeChar && (
            <div className="ml-auto flex items-center gap-2 text-yellow-400 text-sm font-mono">
              <Coins className="w-4 h-4" />
              <span>{myGold.toLocaleString()} vàng</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border pb-0">
          {([["market", "CHỢ ĐẤU GIÁ"], ["sell", "ĐĂNG BÁN"], ["mine", "CỦA TÔI"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2 text-xs tracking-widest font-mono transition-all border-b-2 -mb-px ${
                tab === key ? "text-cyan-400 border-cyan-400" : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* MARKET TAB */}
        {tab === "market" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex gap-3 mb-5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm vật phẩm..."
                  className="w-full pl-9 pr-4 py-2 bg-card border border-border text-sm font-mono focus:outline-none focus:border-cyan-400/60 text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <button onClick={() => refetch()} className="px-3 py-2 border border-border text-muted-foreground hover:text-cyan-400 hover:border-cyan-400/40 transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Char selector for bidding */}
            {chars.length > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs text-muted-foreground tracking-wider">NHÂN VẬT:</span>
                <select
                  value={selectedCharId || (chars[0]?.character.id ?? "")}
                  onChange={e => setSelectedCharId(e.target.value)}
                  className="bg-card border border-border text-xs font-mono px-3 py-1.5 text-foreground focus:outline-none focus:border-cyan-400/60"
                >
                  {chars.map(c => (
                    <option key={c.character.id} value={c.character.id}>
                      {c.character.name} (Lv.{c.character.level}) — {(c.character.stats?.gold ?? 0)} vàng
                    </option>
                  ))}
                </select>
              </div>
            )}

            {marketLoading ? (
              <div className="text-center text-muted-foreground py-16 text-sm tracking-widest">ĐANG TẢI...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Gavel className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm tracking-wider">Chưa có vật phẩm nào được đấu giá</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(row => {
                  const { listing, seller } = row;
                  const rc = RARITY_COLOR[listing.itemRarity] ?? "#94a3b8";
                  const isExpired = new Date(listing.expiresAt) < new Date();
                  const bidOpen = bidAuctionId === listing.id;
                  const activeBidChar = selectedCharId || chars[0]?.character.id;

                  return (
                    <motion.div
                      key={listing.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-border bg-card/50 p-4"
                      style={{ borderLeftColor: rc, borderLeftWidth: 2 }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 flex items-center justify-center text-xl border flex-shrink-0" style={{ borderColor: `${rc}40`, backgroundColor: `${rc}10` }}>
                          {listing.itemIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-foreground">{listing.itemName}</span>
                            <span className="text-xs px-1.5 py-0.5 border" style={{ color: rc, borderColor: `${rc}40`, backgroundColor: `${rc}10` }}>
                              {RARITY_LABEL[listing.itemRarity] ?? listing.itemRarity}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>Người bán: <span className="text-foreground/70">{seller.name}</span> (Lv.{seller.level})</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{isExpired ? "Hết hạn" : timeLeft(listing.expiresAt)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-yellow-400 font-mono text-sm font-bold">{listing.currentBid.toLocaleString()} 🪙</div>
                          {listing.buyoutPrice && (
                            <div className="text-xs text-green-400/70 mt-0.5">Mua ngay: {listing.buyoutPrice.toLocaleString()}</div>
                          )}
                          {listing.currentBidderId && (
                            <div className="text-xs text-cyan-400/60 mt-0.5">Đang có người đặt</div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0 ml-2">
                          <button
                            onClick={() => { setBidAuctionId(bidOpen ? null : listing.id); setBidAmount(String(listing.currentBid + 10)); }}
                            className="px-3 py-1 text-xs font-mono border border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10 transition-all"
                          >
                            ĐẶT GIÁ
                          </button>
                          {listing.buyoutPrice && (
                            <button
                              onClick={() => activeBidChar && buyoutMutation.mutate({ auctionId: listing.id, charId: activeBidChar })}
                              disabled={buyoutMutation.isPending}
                              className="px-3 py-1 text-xs font-mono border border-green-400/40 text-green-400 hover:bg-green-400/10 transition-all disabled:opacity-50"
                            >
                              MUA NGAY
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Bid panel */}
                      <AnimatePresence>
                        {bidOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
                              <input
                                type="number"
                                value={bidAmount}
                                onChange={e => setBidAmount(e.target.value)}
                                min={listing.currentBid + 1}
                                className="flex-1 bg-background border border-border px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-cyan-400/60"
                                placeholder={`Tối thiểu ${listing.currentBid + 1}`}
                              />
                              <span className="text-xs text-muted-foreground">vàng</span>
                              <button
                                onClick={() => activeBidChar && bidMutation.mutate({
                                  auctionId: listing.id,
                                  charId: activeBidChar,
                                  amount: Number(bidAmount),
                                })}
                                disabled={bidMutation.isPending || !bidAmount}
                                className="px-4 py-1.5 text-xs font-mono bg-cyan-400/10 border border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/20 transition-all disabled:opacity-50"
                              >
                                {bidMutation.isPending ? "..." : "XÁC NHẬN"}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* SELL TAB */}
        {tab === "sell" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg">
            <div className="border border-border bg-card/50 p-6 space-y-5">
              <h2 className="text-sm font-mono text-cyan-400 tracking-widest flex items-center gap-2">
                <Tag className="w-4 h-4" /> ĐĂNG VẬT PHẨM ĐẤU GIÁ
              </h2>

              {/* Char select */}
              <div>
                <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">NHÂN VẬT BÁN</label>
                <select
                  value={selectedCharId}
                  onChange={e => { setSelectedCharId(e.target.value); setSelectedInvId(""); }}
                  className="w-full bg-background border border-border text-sm font-mono px-3 py-2 text-foreground focus:outline-none focus:border-cyan-400/60"
                >
                  <option value="">-- Chọn nhân vật --</option>
                  {chars.map(c => (
                    <option key={c.character.id} value={c.character.id}>
                      {c.character.name} (Lv.{c.character.level})
                    </option>
                  ))}
                </select>
              </div>

              {/* Item select */}
              {selectedCharId && (
                <div>
                  <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">VẬT PHẨM</label>
                  <select
                    value={selectedInvId}
                    onChange={e => setSelectedInvId(e.target.value)}
                    className="w-full bg-background border border-border text-sm font-mono px-3 py-2 text-foreground focus:outline-none focus:border-cyan-400/60"
                  >
                    <option value="">-- Chọn vật phẩm --</option>
                    {(chars.find(c => c.character.id === selectedCharId)?.inventory ?? [])
                      .filter(i => !i.inv.equippedSlot && i.inv.quantity > 0)
                      .map(i => (
                        <option key={i.inv.id} value={i.inv.id}>
                          {i.item.icon} {i.item.name} ({RARITY_LABEL[i.item.rarity] ?? i.item.rarity}) × {i.inv.quantity}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Bid price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">GIÁ KHỞI ĐIỂM (vàng)</label>
                  <input type="number" min={1} value={startBid} onChange={e => setStartBid(e.target.value)}
                    className="w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-400/60" placeholder="e.g. 100" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">MUA NGAY (tuỳ chọn)</label>
                  <input type="number" min={1} value={buyout} onChange={e => setBuyout(e.target.value)}
                    className="w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-400/60" placeholder="Để trống = không có" />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs text-muted-foreground tracking-wider block mb-1.5">THỜI GIAN (giờ)</label>
                <select value={duration} onChange={e => setDuration(e.target.value)}
                  className="w-full bg-background border border-border text-sm font-mono px-3 py-2 text-foreground focus:outline-none focus:border-cyan-400/60">
                  {[6, 12, 24, 48].map(h => <option key={h} value={h}>{h} giờ</option>)}
                </select>
              </div>

              <button
                disabled={!selectedCharId || !selectedInvId || !startBid || listMutation.isPending}
                onClick={() => listMutation.mutate({
                  charId: selectedCharId,
                  inventoryId: selectedInvId,
                  startBid: Number(startBid),
                  buyoutPrice: buyout ? Number(buyout) : undefined,
                  durationHours: Number(duration),
                })}
                className="w-full py-2.5 text-sm font-mono tracking-widest border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {listMutation.isPending ? "ĐANG ĐĂNG..." : "ĐĂNG ĐẤU GIÁ"}
              </button>
            </div>
          </motion.div>
        )}

        {/* MINE TAB */}
        {tab === "mine" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* My listings */}
            <div>
              <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-3 flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5" /> VẬT PHẨM ĐANG ĐẤU GIÁ
              </h2>
              {!myData?.listings.length ? (
                <p className="text-muted-foreground text-xs tracking-wider py-4">Bạn chưa đăng vật phẩm nào.</p>
              ) : (
                <div className="space-y-2">
                  {myData.listings.map(listing => {
                    const rc = RARITY_COLOR[listing.itemRarity] ?? "#94a3b8";
                    return (
                      <div key={listing.id} className="border border-border bg-card/40 p-3 flex items-center gap-3" style={{ borderLeftColor: rc, borderLeftWidth: 2 }}>
                        <span className="text-lg">{listing.itemIcon}</span>
                        <div className="flex-1">
                          <div className="text-sm font-mono text-foreground">{listing.itemName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Giá hiện tại: <span className="text-yellow-400">{listing.currentBid}</span> 🪙 · {timeLeft(listing.expiresAt)} · {listing.status === "active" ? "🟢 Active" : listing.status === "sold" ? "✅ Đã bán" : listing.status === "expired" ? "⏰ Hết hạn" : "❌ Huỷ"}
                          </div>
                        </div>
                        {listing.status === "active" && !listing.currentBidderId && (
                          <button
                            onClick={() => {
                              const myFirstChar = chars[0]?.character.id;
                              if (myFirstChar) cancelMutation.mutate({ auctionId: listing.id, charId: myFirstChar });
                            }}
                            className="text-xs font-mono text-red-400/70 border border-red-400/30 px-3 py-1 hover:bg-red-400/10 transition-all"
                          >
                            HUỶ
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* My bids */}
            <div>
              <h2 className="text-xs font-mono text-muted-foreground tracking-widest mb-3 flex items-center gap-2">
                <Gavel className="w-3.5 h-3.5" /> GIÁ ĐÃ ĐẶT
              </h2>
              {!myData?.bids.length ? (
                <p className="text-muted-foreground text-xs tracking-wider py-4">Bạn chưa đặt giá vật phẩm nào.</p>
              ) : (
                <div className="space-y-2">
                  {myData.bids.map(row => {
                    const rc = RARITY_COLOR[row.listing.itemRarity] ?? "#94a3b8";
                    const isWinning = row.listing.currentBidderId === row.bid.bidderCharId;
                    return (
                      <div key={row.bid.id} className="border border-border bg-card/40 p-3 flex items-center gap-3" style={{ borderLeftColor: rc, borderLeftWidth: 2 }}>
                        <span className="text-lg">{row.listing.itemIcon}</span>
                        <div className="flex-1">
                          <div className="text-sm font-mono text-foreground">{row.listing.itemName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Giá của tôi: <span className="text-yellow-400">{row.bid.bidAmount}</span> 🪙 · {timeLeft(row.listing.expiresAt)}
                          </div>
                        </div>
                        <span className={`text-xs font-mono px-2 py-0.5 border ${isWinning ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-red-400 border-red-400/30 bg-red-400/10"}`}>
                          {isWinning ? "ĐANG THẮNG" : "BỊ VƯỢT"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
