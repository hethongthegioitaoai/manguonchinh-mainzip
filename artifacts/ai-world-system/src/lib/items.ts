export type ItemType = "weapon" | "armor" | "accessory" | "consumable";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type WorldSlug = "cultivation" | "cyberpunk" | "zombie";

export interface BonusStats {
  STR?: number;
  INT?: number;
  AGI?: number;
  LCK?: number;
  HP?: number;
}

export interface ItemTemplate {
  name: string;
  type: ItemType;
  rarity: Rarity;
  worldSlug: WorldSlug;
  description: string;
  icon: string;
  bonusStats: BonusStats;
}

export interface InventoryItem {
  id: string;
  characterId: string;
  itemId: string;
  quantity: number;
  equippedSlot: string | null;
  acquiredAt: string;
  item: {
    id: string;
    name: string;
    type: string;
    rarity: string;
    worldSlug: string;
    description: string;
    icon: string;
    bonusStats: BonusStats;
  };
}

export const RARITY_META: Record<Rarity, { label: string; color: string; border: string; bg: string; glow: string }> = {
  common:    { label: "Phổ Thông",  color: "text-gray-300",   border: "border-gray-600",   bg: "bg-gray-800/40",   glow: "" },
  uncommon:  { label: "Không Phổ", color: "text-green-400",  border: "border-green-600",  bg: "bg-green-900/20",  glow: "shadow-green-900/30" },
  rare:      { label: "Hiếm",       color: "text-blue-400",   border: "border-blue-600",   bg: "bg-blue-900/20",   glow: "shadow-blue-900/30" },
  epic:      { label: "Sử Thi",     color: "text-purple-400", border: "border-purple-600", bg: "bg-purple-900/20", glow: "shadow-purple-900/40" },
  legendary: { label: "Huyền Thoại",color: "text-yellow-300", border: "border-yellow-500", bg: "bg-yellow-900/20", glow: "shadow-yellow-900/50" },
};

export const TYPE_META: Record<ItemType, { label: string; icon: string; slot: string }> = {
  weapon:     { label: "Vũ Khí",   icon: "⚔️",  slot: "weapon" },
  armor:      { label: "Giáp",     icon: "🛡️",  slot: "armor" },
  accessory:  { label: "Phụ Kiện", icon: "💍",  slot: "accessory" },
  consumable: { label: "Tiêu Thụ", icon: "🧪",  slot: "" },
};

export function getEquippedStats(equipped: InventoryItem[]): BonusStats {
  const total: BonusStats = {};
  for (const inv of equipped) {
    if (!inv.equippedSlot) continue;
    const bs = inv.item.bonusStats as BonusStats;
    for (const k of Object.keys(bs) as (keyof BonusStats)[]) {
      total[k] = (total[k] ?? 0) + (bs[k] ?? 0);
    }
  }
  return total;
}
