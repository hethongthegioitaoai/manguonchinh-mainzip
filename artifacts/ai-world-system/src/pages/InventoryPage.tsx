import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Package, Swords, Shield, Gem, Beaker, ChevronDown, Star, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { RARITY_META, TYPE_META, getEquippedStats, type InventoryItem, type Rarity, type ItemType } from "@/lib/items";

interface Character {
  id: string;
  name: string;
  level: number;
  stats: { world_slug: string };
}

const SLOT_ICONS: Record<string, React.ReactNode> = {
  weapon:    <Swords className="w-4 h-4" />,
  armor:     <Shield className="w-4 h-4" />,
  accessory: <Gem className="w-4 h-4" />,
};

const STAT_LABELS: Record<string, string> = {
  STR: "SỨC MẠNH", INT: "TRÍ TUỆ", AGI: "NHANH NHẸN", LCK: "MAY MẮN", HP: "SINH LỰC",
};

const STAT_COLORS: Record<string, string> = {
  STR: "text-red-400", INT: "text-blue-400", AGI: "text-green-400", LCK: "text-yellow-400", HP: "text-pink-400",
};

type FilterType = "all" | ItemType;
type FilterRarity = "all" | Rarity;
type FilterSlot = "all" | "equipped" | "unequipped";

export default function InventoryPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [fetching, setFetching] = useState(true);
  const [invItems, setInvItems] = useState<InventoryItem[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [selected, setSelected] = useState<InventoryItem | null>(null);

  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [rarityFilter, setRarityFilter] = useState<FilterRarity>("all");
  const [slotFilter, setSlotFilter] = useState<FilterSlot>("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/characters", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCharacters(data);
          setActiveChar(data[0]);
        }
      })
      .finally(() => setFetching(false));
  }, [user]);

  useEffect(() => {
    if (!activeChar) return;
    loadInventory(activeChar.id);
  }, [activeChar]);

  async function loadInventory(characterId: string) {
    setLoadingInv(true);
    try {
      const res = await fetch(`/api/inventory/${characterId}`, { credentials: "include" });
      setInvItems(await res.json());
    } finally {
      setLoadingInv(false);
    }
  }

  async function toggleEquip(inv: InventoryItem) {
    if (equipping) return;
    if (inv.item.type === "consumable") return;
    setEquipping(inv.id);
    try {
      const res = await fetch("/api/inventory/equip", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId: inv.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setInvItems(prev => prev.map(i => {
          if (i.equippedSlot === data.inventory.equippedSlot && i.id !== inv.id) return { ...i, equippedSlot: null };
          if (i.id === inv.id) return { ...i, equippedSlot: data.inventory.equippedSlot };
          return i;
        }));
        if (selected?.id === inv.id) setSelected(s => s ? { ...s, equippedSlot: data.inventory.equippedSlot } : s);
      }
    } finally {
      setEquipping(null);
    }
  }

  const equipped = invItems.filter(i => i.equippedSlot);
  const equippedStats = getEquippedStats(equipped);

  const filtered = invItems.filter(i => {
    if (typeFilter !== "all" && i.item.type !== typeFilter) return false;
    if (rarityFilter !== "all" && i.item.rarity !== rarityFilter) return false;
    if (slotFilter === "equipped" && !i.equippedSlot) return false;
    if (slotFilter === "unequipped" && i.equippedSlot) return false;
    return true;
  });

  const hasFilters = typeFilter !== "all" || rarityFilter !== "all" || slotFilter !== "all";

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-black/80 border-b border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 backdrop-blur">
        <button onClick={() => setLocation("/dashboard")} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Package className="w-5 h-5 text-cyan-400" />
        <span className="font-bold text-sm tracking-wide">TÚI ĐỒ</span>
        {characters.length > 1 && (
          <div className="ml-auto flex gap-1">
            {characters.map(c => (
              <button key={c.id} onClick={() => setActiveChar(c)}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${activeChar?.id === c.id ? "bg-cyan-700 border-cyan-600 text-white" : "bg-gray-900 border-gray-700 text-gray-400"}`}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Equipped stats summary */}
        {equipped.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-black/40 border border-cyan-700/40 rounded-2xl p-4">
            <div className="text-xs text-cyan-400 font-semibold tracking-wide mb-3">ĐANG TRANG BỊ</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(["weapon", "armor", "accessory"] as const).map(slot => {
                const item = equipped.find(e => e.equippedSlot === slot);
                return (
                  <div key={slot} className={`rounded-xl p-2.5 border text-center ${item ? "bg-cyan-900/20 border-cyan-600/40" : "bg-gray-900/40 border-gray-700/30"}`}>
                    <div className="text-lg mb-1">{item ? item.item.icon : (slot === "weapon" ? "🗡️" : slot === "armor" ? "🛡️" : "💍")}</div>
                    <div className={`text-xs truncate ${item ? RARITY_META[item.item.rarity as Rarity]?.color ?? "text-white" : "text-gray-600"}`}>
                      {item ? item.item.name : TYPE_META[slot].label}
                    </div>
                  </div>
                );
              })}
            </div>
            {Object.keys(equippedStats).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(equippedStats).map(([stat, val]) => (
                  <span key={stat} className={`text-xs px-2 py-1 rounded-lg bg-black/50 border border-gray-700 font-bold ${STAT_COLORS[stat] ?? "text-white"}`}>
                    +{val} {stat}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Filters */}
        <div>
          <button onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors mb-2">
            <span className="flex items-center gap-1">Bộ lọc <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} /></span>
            {hasFilters && <span className="bg-cyan-600 text-white text-xs px-1.5 py-0.5 rounded-full">Đang lọc</span>}
            <span className="ml-auto text-gray-600">{filtered.length}/{invItems.length} vật phẩm</span>
          </button>
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="bg-black/40 border border-gray-700/40 rounded-xl p-4 space-y-3 mb-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Loại</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(["all", "weapon", "armor", "accessory", "consumable"] as FilterType[]).map(t => (
                        <button key={t} onClick={() => setTypeFilter(t)}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${typeFilter === t ? "bg-cyan-700 border-cyan-600 text-white" : "bg-gray-900 border-gray-700 text-gray-400"}`}>
                          {t === "all" ? "Tất cả" : TYPE_META[t as ItemType]?.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Độ hiếm</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(["all", "common", "uncommon", "rare", "epic", "legendary"] as FilterRarity[]).map(r => (
                        <button key={r} onClick={() => setRarityFilter(r)}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${rarityFilter === r ? "bg-cyan-700 border-cyan-600 text-white" : "bg-gray-900 border-gray-700 text-gray-400"}`}>
                          {r === "all" ? "Tất cả" : RARITY_META[r as Rarity]?.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Trạng thái</div>
                    <div className="flex gap-1.5">
                      {(["all", "equipped", "unequipped"] as FilterSlot[]).map(s => (
                        <button key={s} onClick={() => setSlotFilter(s)}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${slotFilter === s ? "bg-cyan-700 border-cyan-600 text-white" : "bg-gray-900 border-gray-700 text-gray-400"}`}>
                          {s === "all" ? "Tất cả" : s === "equipped" ? "Đang đeo" : "Chưa đeo"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Grid vật phẩm */}
        {loadingInv ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{invItems.length === 0 ? "Túi đồ trống — chiến đấu để nhận vật phẩm!" : "Không có vật phẩm khớp bộ lọc"}</p>
            {invItems.length === 0 && (
              <button onClick={() => setLocation("/battle")}
                className="mt-4 text-xs text-cyan-500 hover:text-cyan-300 transition-colors">
                Vào chiến trường →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filtered.map((inv, i) => {
              const rMeta = RARITY_META[inv.item.rarity as Rarity] ?? RARITY_META.common;
              const isEquipped = !!inv.equippedSlot;
              return (
                <motion.button key={inv.id} onClick={() => setSelected(inv)}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                  className={`relative text-left border rounded-xl p-3 transition-all hover:scale-[1.02] active:scale-[0.98] ${rMeta.bg} ${rMeta.border} ${rMeta.glow ? `shadow-lg ${rMeta.glow}` : ""} ${isEquipped ? "ring-1 ring-cyan-500/50" : ""}`}>
                  {isEquipped && (
                    <div className="absolute top-1.5 right-1.5">
                      <Zap className="w-3 h-3 text-cyan-400" />
                    </div>
                  )}
                  <div className="text-3xl mb-2">{inv.item.icon}</div>
                  <div className={`text-xs font-bold leading-tight mb-1 ${rMeta.color}`}>{inv.item.name}</div>
                  <div className="text-xs text-gray-500">{TYPE_META[inv.item.type as ItemType]?.label}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(inv.item.bonusStats as Record<string, number>).map(([stat, val]) => (
                      <span key={stat} className={`text-xs ${STAT_COLORS[stat] ?? "text-white"} font-bold`}>+{val}{stat}</span>
                    ))}
                  </div>
                  {inv.quantity > 1 && (
                    <div className="absolute bottom-1.5 right-2 text-xs text-gray-500">×{inv.quantity}</div>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center p-4"
            onClick={() => setSelected(null)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-md border rounded-2xl p-5 ${RARITY_META[selected.item.rarity as Rarity]?.bg ?? "bg-gray-900"} ${RARITY_META[selected.item.rarity as Rarity]?.border ?? "border-gray-700"}`}>

              <div className="flex items-start gap-4 mb-4">
                <div className="text-5xl">{selected.item.icon}</div>
                <div className="flex-1">
                  <div className={`font-bold text-lg leading-tight ${RARITY_META[selected.item.rarity as Rarity]?.color ?? "text-white"}`}>
                    {selected.item.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{TYPE_META[selected.item.type as ItemType]?.label}</span>
                    <span className="text-gray-700">·</span>
                    <span className={`text-xs font-semibold flex items-center gap-1 ${RARITY_META[selected.item.rarity as Rarity]?.color}`}>
                      <Star className="w-3 h-3" />{RARITY_META[selected.item.rarity as Rarity]?.label}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-300 mb-4 leading-relaxed">{selected.item.description}</p>

              <div className="flex flex-wrap gap-2 mb-5">
                {Object.entries(selected.item.bonusStats as Record<string, number>).map(([stat, val]) => (
                  <div key={stat} className={`px-3 py-1.5 rounded-xl bg-black/50 border border-gray-700 text-sm font-bold ${STAT_COLORS[stat] ?? "text-white"}`}>
                    +{val} {STAT_LABELS[stat] ?? stat}
                  </div>
                ))}
              </div>

              {selected.item.type !== "consumable" && (
                <button onClick={() => toggleEquip(selected)} disabled={!!equipping}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${selected.equippedSlot
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                    : "bg-cyan-700 hover:bg-cyan-600 text-white"} ${equipping ? "opacity-50 cursor-not-allowed" : ""}`}>
                  {equipping === selected.id ? "Đang xử lý..." : selected.equippedSlot ? "Tháo Ra" : "Trang Bị"}
                </button>
              )}
              {selected.item.type === "consumable" && (
                <div className="text-center text-xs text-gray-500 py-2">Vật phẩm tiêu thụ — áp dụng tự động khi cần</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
