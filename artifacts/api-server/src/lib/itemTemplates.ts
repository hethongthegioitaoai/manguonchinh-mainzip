export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type WorldSlug = "cultivation" | "cyberpunk" | "zombie";

export interface ItemTemplate {
  name: string;
  type: string;
  rarity: Rarity;
  worldSlug: WorldSlug;
  description: string;
  icon: string;
  bonusStats: Record<string, number>;
  dropWeight: number;
}

export const ITEM_TEMPLATES: ItemTemplate[] = [
  // ── CULTIVATION ──
  { worldSlug: "cultivation", name: "Thiết Kiếm Bình Thường", type: "weapon",    rarity: "common",    icon: "🗡️",  description: "Thanh kiếm rèn thô bằng sắt thường, chút linh khí cũng khó lưu giữ.",              bonusStats: { STR: 3 },             dropWeight: 40 },
  { worldSlug: "cultivation", name: "Linh Giáp Sơ Cấp",       type: "armor",     rarity: "common",    icon: "🥋",  description: "Áo giáp da thú nhuộm linh khí, bảo vệ thân thể sơ bộ trước ngoại thương.",       bonusStats: { HP: 20 },             dropWeight: 35 },
  { worldSlug: "cultivation", name: "Hộ Thân Phù",             type: "accessory", rarity: "uncommon",  icon: "🔮",  description: "Bùa hộ thân vẽ bằng huyết hổ, tăng phản xạ người đeo.",                         bonusStats: { AGI: 4 },             dropWeight: 25 },
  { worldSlug: "cultivation", name: "Ngưng Khí Đan",           type: "consumable",rarity: "uncommon",  icon: "💊",  description: "Đan dược ngưng tụ linh khí, uống vào khí hải tạm thời mở rộng.",                bonusStats: { INT: 5 },             dropWeight: 20 },
  { worldSlug: "cultivation", name: "Vân Hư Kiếm",             type: "weapon",    rarity: "rare",      icon: "⚡",  description: "Kiếm trắng rèn từ thiên lôi thạch, mỗi đao chém thoát điện quang.",               bonusStats: { STR: 8, AGI: 3 },     dropWeight: 12 },
  { worldSlug: "cultivation", name: "Thiên Tàm Giáp",          type: "armor",     rarity: "rare",      icon: "🧣",  description: "Giáp dệt từ tơ thiên tàm, nhẹ như không mà cứng hơn thép vạn năm.",             bonusStats: { HP: 50, AGI: 2 },     dropWeight: 10 },
  { worldSlug: "cultivation", name: "Thần Thức Vòng",          type: "accessory", rarity: "epic",      icon: "🌀",  description: "Vòng ngọc khắc bát quái, mở rộng thần thức người đeo gấp ba lần.",               bonusStats: { INT: 12, LCK: 4 },    dropWeight: 5  },
  { worldSlug: "cultivation", name: "Bất Tử Kiếm Hồn",        type: "weapon",    rarity: "legendary", icon: "☯️",  description: "Kiếm thần ngưng tụ hồn của vạn kiếm sĩ, dao quang xé vũ trụ.",                  bonusStats: { STR: 20, INT: 8, AGI: 5 }, dropWeight: 1 },

  // ── CYBERPUNK ──
  { worldSlug: "cyberpunk", name: "Dao Rạch Thường",      type: "weapon",    rarity: "common",    icon: "🔪",  description: "Dao monofilament rẻ tiền, sắc nhưng mòn nhanh trong điều kiện ẩm ướt Kowloon.",    bonusStats: { STR: 3 },             dropWeight: 40 },
  { worldSlug: "cyberpunk", name: "Áo Chống Đạn Loại C",  type: "armor",     rarity: "common",    icon: "🦺",  description: "Áo kevlar tổng hợp phổ thông, chặn được đạn handgun thế hệ cũ.",                  bonusStats: { HP: 20 },             dropWeight: 35 },
  { worldSlug: "cyberpunk", name: "Phản Xạ Cấy Ghép I",   type: "accessory", rarity: "uncommon",  icon: "🦾",  description: "Chip tăng cường phản xạ thần kinh cấy vào cổ tay, phản ứng nhanh hơn 40ms.",      bonusStats: { AGI: 5 },             dropWeight: 25 },
  { worldSlug: "cyberpunk", name: "Nootropic Stack",       type: "consumable",rarity: "uncommon",  icon: "💉",  description: "Cocktail dược phẩm hack não, IQ tạm thời +20 điểm trong 4 tiếng.",                 bonusStats: { INT: 6 },             dropWeight: 20 },
  { worldSlug: "cyberpunk", name: "Mantis Blade Mk.II",    type: "weapon",    rarity: "rare",      icon: "⚔️",  description: "Lưỡi dao titan gắn trực tiếp vào cẳng tay, bung ra trong 0.02 giây.",             bonusStats: { STR: 9, AGI: 2 },     dropWeight: 12 },
  { worldSlug: "cyberpunk", name: "EMP Nano-Giáp",         type: "armor",     rarity: "rare",      icon: "🔋",  description: "Giáp phân tử tích hợp lá chắn EMP, vô hiệu hóa tấn công AI trong bán kính 2m.",   bonusStats: { HP: 45, INT: 5 },     dropWeight: 10 },
  { worldSlug: "cyberpunk", name: "Quickhack Deck Pro",    type: "accessory", rarity: "epic",      icon: "🖥️",  description: "Bộ deck hack thần kinh cấp cao, xâm nhập ICE tập đoàn trong vài millisecond.",     bonusStats: { INT: 15, LCK: 3 },    dropWeight: 5  },
  { worldSlug: "cyberpunk", name: "Sandevistan Omega",     type: "accessory", rarity: "legendary", icon: "⚡",  description: "Bộ tăng tốc thần kinh siêu cấp — thế giới đứng yên khi ngươi di chuyển.",          bonusStats: { AGI: 18, STR: 6, LCK: 6 }, dropWeight: 1 },

  // ── ZOMBIE ──
  { worldSlug: "zombie", name: "Dụi Sắt Rỉ",          type: "weapon",    rarity: "common",    icon: "🔨",  description: "Dụi sắt nhặt từ garage cũ, gỉ sét nhưng vẫn đủ dập vỡ hộp sọ xác sống.",        bonusStats: { STR: 4 },             dropWeight: 40 },
  { worldSlug: "zombie", name: "Áo Da Vá Víu",         type: "armor",     rarity: "common",    icon: "🧥",  description: "Áo da chắp vá từ nhiều lớp, tuy xấu xí nhưng ngăn được cắn của xác sống thường.", bonusStats: { HP: 22 },             dropWeight: 35 },
  { worldSlug: "zombie", name: "Đôi Giày Chạy Nhanh",  type: "accessory", rarity: "uncommon",  icon: "👟",  description: "Giày chạy bộ chuyên dụng, nhẹ và bám đường — đôi khi bỏ chạy là chiến thuật tốt.", bonusStats: { AGI: 5 },             dropWeight: 25 },
  { worldSlug: "zombie", name: "Thuốc Kháng Sinh",     type: "consumable",rarity: "uncommon",  icon: "🩹",  description: "Kháng sinh cuối thế giới, hiếm như vàng. Giảm nguy cơ nhiễm độc.",               bonusStats: { HP: 15, LCK: 2 },     dropWeight: 20 },
  { worldSlug: "zombie", name: "Súng Trường Tùy Chỉnh",type: "weapon",    rarity: "rare",      icon: "🔫",  description: "M4A1 độ nòng dài và giảm thanh, sửa thêm ổ tiếp đạn 60 viên.",                   bonusStats: { STR: 7, AGI: 3 },     dropWeight: 12 },
  { worldSlug: "zombie", name: "Giáp Quân Đội Cũ",     type: "armor",     rarity: "rare",      icon: "🪖",  description: "Giáp chiến đấu quân đội từ trước thảm họa, vẫn còn phần lớn tấm chắn nguyên vẹn.", bonusStats: { HP: 55, STR: 3 },     dropWeight: 10 },
  { worldSlug: "zombie", name: "Bản Đồ Kho Vũ Khí",   type: "accessory", rarity: "epic",      icon: "🗺️",  description: "Bản đồ kho vũ khí bí mật của chính phủ — ai nắm được sẽ là chủ chiến trường.",    bonusStats: { LCK: 10, INT: 5 },    dropWeight: 5  },
  { worldSlug: "zombie", name: "Huyết Thanh Nexus",    type: "consumable",rarity: "legendary", icon: "☣️",  description: "Huyết thanh tổng hợp tuyệt mật — tiêm vào nâng cấp cơ thể vượt giới hạn người.",   bonusStats: { STR: 12, HP: 80, AGI: 8 }, dropWeight: 1 },
];

const DROP_CHANCE: Record<string, number> = {
  win: 0.55,
  draw: 0.15,
  lose: 0,
};

export function shouldDropItem(result: string, enemyLevel: number): boolean {
  const base = DROP_CHANCE[result] ?? 0;
  const bonus = Math.min(0.2, enemyLevel * 0.01);
  return Math.random() < base + bonus;
}

export function pickDropItem(worldSlug: string, enemyLevel: number): ItemTemplate | null {
  const pool = ITEM_TEMPLATES.filter(t => t.worldSlug === worldSlug);
  if (!pool.length) return null;

  const rarityThreshold = Math.min(enemyLevel / 30, 1);
  const filtered = pool.filter(t => {
    const rarityScore = { common: 0, uncommon: 0.25, rare: 0.5, epic: 0.75, legendary: 1 }[t.rarity] ?? 0;
    return rarityScore <= rarityThreshold + 0.3;
  });

  const eligible = filtered.length ? filtered : pool;
  const totalWeight = eligible.reduce((s, t) => s + t.dropWeight, 0);
  let rand = Math.random() * totalWeight;
  for (const t of eligible) {
    rand -= t.dropWeight;
    if (rand <= 0) return t;
  }
  return eligible[0];
}
