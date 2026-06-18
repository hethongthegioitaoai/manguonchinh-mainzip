export type WorldSlug = "cultivation" | "cyberpunk" | "zombie";
export type EnemyType = "Yêu Thú" | "Tà Tu" | "Corp Soldier" | "Rogue AI" | "Zombie Horde" | "Raider";

export interface EnemyTemplate {
  name: string;
  type: EnemyType;
  worldSlug: WorldSlug;
  icon: string;
  description: string;
}

export interface Enemy extends EnemyTemplate {
  level: number;
  hpMax: number;
  hp: number;
  atk: number;
  def: number;
  speed: number;
}

const TEMPLATES: EnemyTemplate[] = [
  { worldSlug: "cultivation", name: "Thạch Hổ Yêu", type: "Yêu Thú", icon: "🐯", description: "Mãnh thú linh khí dày đặc, bộ da cứng như đá." },
  { worldSlug: "cultivation", name: "Huyết Ảnh Lang", type: "Yêu Thú", icon: "🐺", description: "Bầy lang yêu cực nhanh, tấn công bằng huyết khí." },
  { worldSlug: "cultivation", name: "Phong Linh Điểu", type: "Yêu Thú", icon: "🦅", description: "Linh điểu kiểm soát gió, tấn công từ xa." },
  { worldSlug: "cultivation", name: "Cổ Yêu Rễ Thần", type: "Yêu Thú", icon: "🌿", description: "Cổ thụ thành tinh, rễ cây như thép." },
  { worldSlug: "cultivation", name: "Tà Tu Hắc Bào", type: "Tà Tu", icon: "🧙", description: "Đệ tử tà phái dùng độc thuật và ám khí." },
  { worldSlug: "cultivation", name: "Ma Đạo Sát Thủ", type: "Tà Tu", icon: "⚔️", description: "Sát thủ ma đạo luyện công bằng sinh linh." },

  { worldSlug: "cyberpunk", name: "Corp Soldier MK-II", type: "Corp Soldier", icon: "🪖", description: "Lính tập đoàn được trang bị giáp ngoại cốt hạng nặng." },
  { worldSlug: "cyberpunk", name: "Arasaka Guard Elite", type: "Corp Soldier", icon: "🔰", description: "Vệ binh tinh nhuệ Arasaka, phản ứng cực nhanh." },
  { worldSlug: "cyberpunk", name: "Maelstrom Enforcer", type: "Corp Soldier", icon: "💀", description: "Thành viên Maelstrom cải tạo cơ thể quá mức." },
  { worldSlug: "cyberpunk", name: "Rogue AI NEXUS-7", type: "Rogue AI", icon: "🤖", description: "AI nổi loạn kiểm soát hệ thống vũ khí tự động." },
  { worldSlug: "cyberpunk", name: "Ghost Protocol Bot", type: "Rogue AI", icon: "👾", description: "Bot tàng hình hack thần kinh đối thủ." },
  { worldSlug: "cyberpunk", name: "Neural Wraith v3", type: "Rogue AI", icon: "🧠", description: "AI đột biến tấn công qua giao diện thần kinh." },

  { worldSlug: "zombie", name: "Zombie Horde Alpha", type: "Zombie Horde", icon: "🧟", description: "Đàn xác sống đông đảo di chuyển không ngừng." },
  { worldSlug: "zombie", name: "Bloater Mutant", type: "Zombie Horde", icon: "☣️", description: "Zombie đột biến phình to, phát nổ khi chết." },
  { worldSlug: "zombie", name: "Screamer Pack", type: "Zombie Horde", icon: "😱", description: "Nhóm xác sống phát âm thanh thu hút đồng loại." },
  { worldSlug: "zombie", name: "Raider Captain", type: "Raider", icon: "🔫", description: "Thủ lĩnh cướp bóc dày dạn kinh nghiệm chiến đấu." },
  { worldSlug: "zombie", name: "Scavenger Ambush", type: "Raider", icon: "🪤", description: "Nhóm kẻ cướp chuyên mai phục và bẫy đường." },
  { worldSlug: "zombie", name: "Warlord Scout", type: "Raider", icon: "🗡️", description: "Trinh sát của lãnh chúa chiến tranh, nguy hiểm khi cô lập." },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateEnemy(worldSlug: WorldSlug, characterLevel: number): Enemy {
  const pool = TEMPLATES.filter(t => t.worldSlug === worldSlug);
  const template = pickRandom(pool.length > 0 ? pool : TEMPLATES);

  const variance = Math.floor(characterLevel * 0.2);
  const level = Math.max(1, characterLevel + Math.floor(Math.random() * (variance * 2 + 1)) - variance);

  const hpMax = 60 + level * 20;
  const atk = 8 + level * 3;
  const def = 4 + level * 2;
  const speed = 5 + level;

  return { ...template, level, hpMax, hp: hpMax, atk, def, speed };
}

export function getEnemyPool(worldSlug: WorldSlug): EnemyTemplate[] {
  return TEMPLATES.filter(t => t.worldSlug === worldSlug);
}
