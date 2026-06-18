export const RARITY_BASE_PRICE: Record<string, number> = {
  common: 50,
  uncommon: 150,
  rare: 350,
  epic: 700,
  legendary: 1500,
};

export const RARITY_COLORS: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#4ade80",
  rare: "#60a5fa",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

export const RARITY_LABELS: Record<string, string> = {
  common: "Phổ Thông",
  uncommon: "Hiếm",
  rare: "Quý Hiếm",
  epic: "Sử Thi",
  legendary: "Huyền Thoại",
};

export const SUPPLY_LABELS: Record<string, string> = {
  abundant: "Dồi Dào",
  normal: "Bình Thường",
  scarce: "Khan Hiếm",
  depleted: "Cạn Kiệt",
};

export const SUPPLY_COLORS: Record<string, string> = {
  abundant: "#4ade80",
  normal: "#9ca3af",
  scarce: "#f97316",
  depleted: "#ef4444",
};

export const DEMAND_LABELS: Record<string, string> = {
  low: "Thấp",
  normal: "Bình Thường",
  high: "Cao",
  frenzy: "Sốt Hàng",
};

export interface MarketItem {
  id: string;
  itemId: string;
  worldSlug: string;
  basePrice: number;
  currentPrice: number;
  supplyLevel: string;
  demandLevel: string;
  updatedAt: string;
  item: {
    id: string;
    name: string;
    type: string;
    rarity: string;
    description: string;
    icon: string;
    bonusStats: Record<string, number>;
  };
}
