export interface FactionDef {
  name: string;
  description: string;
  alignment: "righteous" | "evil" | "neutral" | "wanderer";
  icon: string;
  color: string;
  bonusStats: Partial<Record<"STR" | "INT" | "AGI" | "LCK" | "END" | "SPR", number>>;
  lore: string;
}

export const FACTION_SEEDS: Record<string, FactionDef[]> = {
  cultivation: [
    {
      name: "Thiên Môn Tông",
      description: "Tông môn cổ xưa theo chính đạo, thờ phụng thiên luật và bảo vệ thế nhân.",
      alignment: "righteous",
      icon: "☀",
      color: "#f59e0b",
      bonusStats: { SPR: 3, END: 2 },
      lore: "Ngàn năm trước, Thiên Môn Tông lập ra để chống lại tà ma. Đến nay vẫn là lực lượng chính đạo hùng mạnh nhất cõi tu tiên.",
    },
    {
      name: "Ma Đạo Liên Minh",
      description: "Liên minh của những kẻ theo ma đạo, tìm kiếm sức mạnh bằng mọi giá.",
      alignment: "evil",
      icon: "🩸",
      color: "#ef4444",
      bonusStats: { STR: 3, INT: 2 },
      lore: "Ma đạo không phải ác — chỉ là con đường khác. Những ai dám bước vào sẽ nhận được sức mạnh mà chính đạo không bao giờ dám trao.",
    },
    {
      name: "Kiếm Tông Trung Lập",
      description: "Tông phái kiếm thuật thuần túy, không can thiệp chính sự, chỉ theo đuổi đỉnh cao võ đạo.",
      alignment: "neutral",
      icon: "⚔",
      color: "#06b6d4",
      bonusStats: { AGI: 3, STR: 2 },
      lore: "Kiếm là kiếm. Tà hay chính chỉ là trong lòng kẻ cầm kiếm. Tông ta không phán xét — ta chỉ luyện kiếm.",
    },
    {
      name: "Vô Danh Lãng Khách",
      description: "Những tu sĩ không thuộc tông môn nào, lang thang tự do khắp thiên hạ.",
      alignment: "wanderer",
      icon: "🌙",
      color: "#a855f7",
      bonusStats: { LCK: 4, AGI: 1 },
      lore: "Không tên — không ràng buộc. Thiên hạ rộng lớn, ta một mình đi qua tất cả.",
    },
  ],
  cyberpunk: [
    {
      name: "Tập Đoàn Arasaka",
      description: "Tập đoàn megacorp quyền lực nhất, kiểm soát công nghệ và thị trường toàn cầu.",
      alignment: "evil",
      icon: "🏢",
      color: "#ef4444",
      bonusStats: { INT: 4, LCK: 1 },
      lore: "Arasaka không phải kẻ thù — họ là thực tại. Gia nhập hay bị nghiền nát.",
    },
    {
      name: "Băng Đảng Đường Phố",
      description: "Liên minh các băng đảng kiểm soát khu phố tầng dưới, sức mạnh thô bạo.",
      alignment: "neutral",
      icon: "🔥",
      color: "#f97316",
      bonusStats: { STR: 4, END: 1 },
      lore: "Đường phố là nhà. Anh em là gia đình. Kẻ nào xâm phạm lãnh thổ — không có đường về.",
    },
    {
      name: "Hacker Underground",
      description: "Mạng lưới hacker bí mật chống lại các tập đoàn, thông tin là vũ khí.",
      alignment: "righteous",
      icon: "💻",
      color: "#06b6d4",
      bonusStats: { INT: 3, AGI: 2 },
      lore: "Dữ liệu là quyền lực. Chúng ta hack để tự do — không phải để giàu có.",
    },
    {
      name: "Lính Đánh Thuê PMC",
      description: "Lực lượng quân sự tư nhân, trung thành với người trả tiền cao nhất.",
      alignment: "wanderer",
      icon: "🎯",
      color: "#84cc16",
      bonusStats: { STR: 2, AGI: 2, END: 1 },
      lore: "Không có lý tưởng — chỉ có hợp đồng. Và ta luôn hoàn thành hợp đồng.",
    },
  ],
  zombie: [
    {
      name: "Pháo Đài Sinh Tồn",
      description: "Cộng đồng có tổ chức, bảo vệ thường dân sau bức tường thép.",
      alignment: "righteous",
      icon: "🏰",
      color: "#f59e0b",
      bonusStats: { END: 4, SPR: 1 },
      lore: "Trong địa ngục này, chúng ta vẫn còn người. Pháo đài là hy vọng cuối cùng.",
    },
    {
      name: "Đoàn Săn Mồi",
      description: "Nhóm thợ săn chuyên nghiệp, thu thập tài nguyên và tiêu diệt zombie đột biến.",
      alignment: "neutral",
      icon: "🗡",
      color: "#ef4444",
      bonusStats: { AGI: 3, STR: 2 },
      lore: "Thế giới mục rữa — ta sống sót bằng cách không ngừng di chuyển và không ngừng giết.",
    },
    {
      name: "Hội Đồng Trắng",
      description: "Các nhà khoa học và bác sĩ tìm kiếm vaccine, tin vào tương lai của nhân loại.",
      alignment: "righteous",
      icon: "🧬",
      color: "#06b6d4",
      bonusStats: { INT: 4, LCK: 1 },
      lore: "Khoa học là ánh sáng cuối đường hầm. Ta sẽ tìm ra phương thuốc — dù phải chết thử.",
    },
    {
      name: "Bầy Sói Cô Đơn",
      description: "Những kẻ sống sót một mình, không tin ai, chỉ tin vào bản năng sinh tồn.",
      alignment: "wanderer",
      icon: "🐺",
      color: "#a855f7",
      bonusStats: { LCK: 3, AGI: 2 },
      lore: "Đồng đội là gánh nặng. Một mình — nhẹ hơn, nhanh hơn, sống lâu hơn.",
    },
  ],
};

export const ALIGNMENT_LABELS: Record<string, string> = {
  righteous: "Chính Đạo",
  evil: "Tà Đạo",
  neutral: "Trung Lập",
  wanderer: "Lãng Khách",
};

export const ALIGNMENT_COLORS: Record<string, string> = {
  righteous: "#f59e0b",
  evil: "#ef4444",
  neutral: "#06b6d4",
  wanderer: "#a855f7",
};

export const REP_RANKS = [
  { min: 0, max: 499, rank: "Mới Gia Nhập", stars: 1 },
  { min: 500, max: 1499, rank: "Thành Viên", stars: 2 },
  { min: 1500, max: 2999, rank: "Cốt Cán", stars: 3 },
  { min: 3000, max: 5999, rank: "Trọng Thần", stars: 4 },
  { min: 6000, max: Infinity, rank: "Lãnh Tụ Bóng Tối", stars: 5 },
];

export function getRepRank(rep: number) {
  return REP_RANKS.find((r) => rep >= r.min && rep <= r.max) ?? REP_RANKS[0];
}
