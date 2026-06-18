import { Sword, Cpu, Biohazard, type LucideIcon } from "lucide-react";

export interface World {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const WORLDS: World[] = [
  {
    id: "cultivation",
    name: "TU TIÊN",
    title: "CỬU THIÊN THĂNG THIÊN",
    description: "Võ đạo cổ xưa hoà quyện với AI thần thức. Vận chuyển chân khí số hoá, tu luyện trong núi mờ sương neon, đột phá từng tiểu cảnh giới để chứng đắc bất tử.",
    icon: Sword,
    color: "hsl(var(--primary))",
  },
  {
    id: "cyberpunk",
    name: "CYBERPUNK",
    title: "NEO-KOWLOON SECUNDUS",
    description: "Siêu đô thị ngập tràn ánh đèn neon và kim loại lạnh. Lướt qua những con phố mưa, hack băng ICE tập đoàn, và sinh tồn trong lòng địa ngục kỹ thuật số.",
    icon: Cpu,
    color: "hsl(var(--secondary))",
  },
  {
    id: "zombie",
    name: "HOANG PHẾ",
    title: "NECRO-BIOME ZERO",
    description: "Sinh tồn kinh dị hậu tận thế. Lùng sục tài nguyên tổng hợp trong thế giới mục rữa phát quang sinh học và những ác mộng cơ hữu đột biến công nghệ.",
    icon: Biohazard,
    color: "hsl(140 80% 50%)",
  },
];

export const SYSTEMS = [
  "Kiếm Thần Hệ Thống",
  "Luyện Đan Hệ Thống",
  "Thương Nhân Hệ Thống",
  "Thú Tướng Hệ Thống",
  "Bất Tử Tu Tiên Hệ Thống",
  "Tử Linh Hệ Thống",
] as const;

export type SystemName = typeof SYSTEMS[number];

export const SYSTEM_ICONS: Record<SystemName, string> = {
  "Kiếm Thần Hệ Thống": "⚔",
  "Luyện Đan Hệ Thống": "⚗",
  "Thương Nhân Hệ Thống": "💹",
  "Thú Tướng Hệ Thống": "🐉",
  "Bất Tử Tu Tiên Hệ Thống": "☯",
  "Tử Linh Hệ Thống": "💀",
};

export const SYSTEM_DESC: Record<SystemName, string> = {
  "Kiếm Thần Hệ Thống": "Vận chuyển thần kiếm năng lượng. Mỗi nhát kiếm xé toạc thực giới, mỗi hơi thở mài giũa ý chí thành sức mạnh sống động.",
  "Luyện Đan Hệ Thống": "Chuyển hoá tinh hoa thô sơ thành tiên đan bất tử. Làm chủ lò luyện vũ trụ — biến độc thành cứu rỗi.",
  "Thương Nhân Hệ Thống": "Giao dịch xuyên chiều không gian. Tích lũy nghiệp tài phú quý, mở khoá thị trường ẩn giữa cõi người và thiên giới.",
  "Thú Tướng Hệ Thống": "Chỉ huy linh thú cổ đại gắn kết qua linh khế. Ý chí của ngươi vang vọng qua từng vảy và vuốt nanh.",
  "Bất Tử Tu Tiên Hệ Thống": "Nén tụ vũ trụ vào đan điền. Vượt qua thiên kiếp để xưng bá giữa các bậc trường sinh bất tử.",
  "Tử Linh Hệ Thống": "Triệu hồi và kiểm soát linh hồn người chết. Biến cái chết thành sức mạnh — mỗi kẻ địch ngã xuống là một chiến binh mới trong đội quân bóng tối.",
};

export const REALM_TITLES: Record<string, string[]> = {
  cultivation: ["Luyện Khí", "Trúc Cơ", "Kim Đan", "Nguyên Anh", "Hóa Thần", "Luyện Hư", "Hợp Thể", "Đại Thừa", "Độ Kiếp", "Bất Tử"],
  cyberpunk:   ["Đường Phố", "Chạy Trốn", "Hacker", "Bóng Ma", "Tinh Anh Chrome", "Netrunner", "Phá Băng", "Sát Tập Đoàn", "Huyền Thoại", "Thần Mạng"],
  zombie:      ["Sinh Tồn Viên", "Thám Tử", "Thợ Săn", "Chiến Binh", "Lãnh Chúa", "Đỉnh Điểm", "Quản Lý", "Bạo Chúa", "Bá Vương", "Necro-Thần"],
};

export function getRealm(worldSlug: string, level: number): string {
  const titles = REALM_TITLES[worldSlug] ?? REALM_TITLES["cultivation"];
  return titles[Math.min(level - 1, titles.length - 1)];
}

export function getWorld(id: string): World | undefined {
  return WORLDS.find((w) => w.id === id);
}

export function rollSystem(): SystemName {
  return SYSTEMS[Math.floor(Math.random() * SYSTEMS.length)];
}
