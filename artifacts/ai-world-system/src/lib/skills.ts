import type { SystemName } from "./worlds";

export interface StatBonus {
  STR?: number;
  INT?: number;
  AGI?: number;
  LCK?: number;
  END?: number;
  SPR?: number;
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3 | 4 | 5;
  cost: number;
  requiredLevel: number;
  requires: string[];
  bonuses: StatBonus;
  flavor: string;
}

export const SKILL_TREES: Record<SystemName, SkillDef[]> = {
  "Kiếm Thần Hệ Thống": [
    {
      id: "kiem_than_1",
      name: "Kiếm Khí Cơ Bản",
      description: "Vận khí vào lưỡi kiếm, tăng sức công kích.",
      tier: 1,
      cost: 1,
      requiredLevel: 1,
      requires: [],
      bonuses: { STR: 2 },
      flavor: "Mỗi nhát kiếm mang theo ý chí của người tu luyện.",
    },
    {
      id: "kiem_than_2",
      name: "Tốc Kiếm",
      description: "Đánh kiếm nhanh như chớp, né tránh linh hoạt hơn.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["kiem_than_1"],
      bonuses: { AGI: 3 },
      flavor: "Chớp mắt — kiếm đã vượt qua chân trời.",
    },
    {
      id: "kiem_than_3",
      name: "Trọng Kiếm Phá Sơn",
      description: "Kiếm nặng như núi, một đòn phá vỡ phòng thủ.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["kiem_than_1"],
      bonuses: { STR: 4, END: 1 },
      flavor: "Sức mạnh tuyệt đối — không cần kỹ xảo.",
    },
    {
      id: "kiem_than_4",
      name: "Kiếm Vực",
      description: "Tạo vùng kiếm khí bao quanh, cân bằng tốc độ và lực.",
      tier: 3,
      cost: 2,
      requiredLevel: 6,
      requires: ["kiem_than_2", "kiem_than_3"],
      bonuses: { STR: 3, AGI: 3 },
      flavor: "Trong kiếm vực, mọi kẻ địch đều là tù nhân.",
    },
    {
      id: "kiem_than_5",
      name: "Thần Kiếm Đoạn Hư",
      description: "Kiếm pháp tối thượng — chém xuyên không gian và thực tại.",
      tier: 4,
      cost: 3,
      requiredLevel: 10,
      requires: ["kiem_than_4"],
      bonuses: { STR: 10, AGI: 5 },
      flavor: "Một kiếm — vạn cõi im lặng.",
    },
  ],

  "Luyện Đan Hệ Thống": [
    {
      id: "luyen_dan_1",
      name: "Tinh Chế Cơ Bản",
      description: "Nắm vững kỹ thuật lọc tinh hoa dược liệu.",
      tier: 1,
      cost: 1,
      requiredLevel: 1,
      requires: [],
      bonuses: { INT: 2 },
      flavor: "Mỗi viên đan là một bí ẩn của vũ trụ được giải khai.",
    },
    {
      id: "luyen_dan_2",
      name: "Dược Linh Cảm Ứng",
      description: "Cảm nhận linh khí ẩn trong dược thảo, tăng tỷ lệ thành công.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["luyen_dan_1"],
      bonuses: { LCK: 3 },
      flavor: "Linh thảo có hồn — người biết lắng nghe sẽ nghe thấy.",
    },
    {
      id: "luyen_dan_3",
      name: "Hồi Phục Thuật",
      description: "Luyện đan hồi phục, tăng thể chất và tinh thần.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["luyen_dan_1"],
      bonuses: { END: 3, SPR: 2 },
      flavor: "Thân thể là lò luyện — linh khí là nguyên liệu.",
    },
    {
      id: "luyen_dan_4",
      name: "Tiên Đan Sơ Cấp",
      description: "Luyện được đan dược cấp tiên — trí tuệ và linh lực vượt bậc.",
      tier: 3,
      cost: 2,
      requiredLevel: 6,
      requires: ["luyen_dan_2", "luyen_dan_3"],
      bonuses: { INT: 5, SPR: 3 },
      flavor: "Đan thành — mùi tiên kỳ lan khắp cõi.",
    },
    {
      id: "luyen_dan_5",
      name: "Vô Thượng Tiên Đan",
      description: "Đỉnh cao luyện đan — đan dược có thể thay đổi vận mệnh.",
      tier: 4,
      cost: 3,
      requiredLevel: 10,
      requires: ["luyen_dan_4"],
      bonuses: { INT: 10, SPR: 5 },
      flavor: "Một viên đan — đổi cả thiên hạ.",
    },
  ],

  "Thương Nhân Hệ Thống": [
    {
      id: "thuong_nhan_1",
      name: "Đàm Phán Cơ Bản",
      description: "Nắm thuật hùng biện, tăng may mắn trong giao dịch.",
      tier: 1,
      cost: 1,
      requiredLevel: 1,
      requires: [],
      bonuses: { LCK: 2 },
      flavor: "Lời nói — vũ khí sắc bén nhất không cần máu.",
    },
    {
      id: "thuong_nhan_2",
      name: "Thị Trường Ngầm",
      description: "Tiếp cận mạng lưới buôn bán bí mật, thông tin là quyền lực.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["thuong_nhan_1"],
      bonuses: { LCK: 3, INT: 1 },
      flavor: "Dưới mỗi thành phố — một thành phố khác đang họp chợ.",
    },
    {
      id: "thuong_nhan_3",
      name: "Mạng Lưới Tình Báo",
      description: "Xây dựng mạng lưới gián điệp khắp nơi.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["thuong_nhan_1"],
      bonuses: { LCK: 5 },
      flavor: "Không có bí mật — chỉ có thông tin chưa mua được.",
    },
    {
      id: "thuong_nhan_4",
      name: "Giao Dịch Vũ Khí",
      description: "Thành thạo buôn bán vũ khí — hiểu rõ sức mạnh và chiến thuật.",
      tier: 3,
      cost: 2,
      requiredLevel: 6,
      requires: ["thuong_nhan_2", "thuong_nhan_3"],
      bonuses: { STR: 3, LCK: 3 },
      flavor: "Kẻ bán vũ khí luôn biết đòn nào nguy hiểm nhất.",
    },
    {
      id: "thuong_nhan_5",
      name: "Vạn Bảo Thương Hành",
      description: "Thống trị thị trường liên thế giới — tài phú vô song.",
      tier: 4,
      cost: 3,
      requiredLevel: 10,
      requires: ["thuong_nhan_4"],
      bonuses: { LCK: 10, INT: 5 },
      flavor: "Tiền bạc không có quê hương — nhưng quyền lực thì có.",
    },
  ],

  "Thú Tướng Hệ Thống": [
    {
      id: "thu_tuong_1",
      name: "Linh Thú Sơ Triệu",
      description: "Triệu hồi linh thú cấp thấp, tăng phản xạ chiến đấu.",
      tier: 1,
      cost: 1,
      requiredLevel: 1,
      requires: [],
      bonuses: { AGI: 2 },
      flavor: "Con thú đầu tiên — khế ước đầu tiên với tự nhiên.",
    },
    {
      id: "thu_tuong_2",
      name: "Thú Vương Chi Lệnh",
      description: "Ra lệnh cho bầy thú tấn công, sức mạnh và tốc độ cộng hưởng.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["thu_tuong_1"],
      bonuses: { STR: 3, AGI: 2 },
      flavor: "Một tiếng gầm — trăm thú lao vào trận.",
    },
    {
      id: "thu_tuong_3",
      name: "Dã Thú Cuồng Bạo",
      description: "Kích hoạt bản năng hoang dã, sức mạnh bùng phát.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["thu_tuong_1"],
      bonuses: { STR: 5 },
      flavor: "Trong huyết mạch có ngọn lửa của kẻ săn mồi.",
    },
    {
      id: "thu_tuong_4",
      name: "Linh Thú Cộng Hưởng",
      description: "Hòa làm một với linh thú — mọi chỉ số đều thăng hoa.",
      tier: 3,
      cost: 2,
      requiredLevel: 6,
      requires: ["thu_tuong_2", "thu_tuong_3"],
      bonuses: { STR: 2, INT: 2, AGI: 2, LCK: 2, END: 2, SPR: 2 },
      flavor: "Người và thú — không còn ranh giới.",
    },
    {
      id: "thu_tuong_5",
      name: "Cổ Thần Thú Thức",
      description: "Thức tỉnh linh thú cổ đại — sức mạnh vượt qua mọi giới hạn.",
      tier: 4,
      cost: 3,
      requiredLevel: 10,
      requires: ["thu_tuong_4"],
      bonuses: { STR: 8, AGI: 8 },
      flavor: "Trước khi thế giới có tên — chúng đã tồn tại.",
    },
  ],

  "Bất Tử Tu Tiên Hệ Thống": [
    {
      id: "bat_tu_1",
      name: "Thần Thức Khai Mở",
      description: "Mở rộng thần thức, cảm nhận linh khí vũ trụ.",
      tier: 1,
      cost: 1,
      requiredLevel: 1,
      requires: [],
      bonuses: { SPR: 2 },
      flavor: "Thần thức rộng mở — vũ trụ như trong lòng bàn tay.",
    },
    {
      id: "bat_tu_2",
      name: "Đan Điền Cường Hóa",
      description: "Tăng cường đan điền, tích trữ linh lực nhiều hơn.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["bat_tu_1"],
      bonuses: { END: 3, SPR: 2 },
      flavor: "Đan điền như biển cả — linh lực như sóng không ngừng.",
    },
    {
      id: "bat_tu_3",
      name: "Bất Tử Chi Thể",
      description: "Tu luyện thể xác đến cảnh giới bất diệt.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["bat_tu_1"],
      bonuses: { END: 5 },
      flavor: "Xác thân là đền thờ — linh hồn bất tử cần nền tảng bền vững.",
    },
    {
      id: "bat_tu_4",
      name: "Thiên Địa Linh Khí",
      description: "Hấp thụ linh khí thiên địa — trí tuệ và tinh thần vượt bậc.",
      tier: 3,
      cost: 2,
      requiredLevel: 6,
      requires: ["bat_tu_2", "bat_tu_3"],
      bonuses: { SPR: 7, INT: 3 },
      flavor: "Trời đất là lò luyện — ta là viên đan đang thành hình.",
    },
    {
      id: "bat_tu_5",
      name: "Vô Lượng Trường Sinh",
      description: "Đạt đến cảnh giới trường sinh — thể xác và tinh thần vĩnh cửu.",
      tier: 4,
      cost: 3,
      requiredLevel: 10,
      requires: ["bat_tu_4"],
      bonuses: { END: 10, SPR: 8 },
      flavor: "Khi thiên kiếp đến — ta vẫn ở đây.",
    },
  ],

  "Tử Linh Hệ Thống": [
    {
      id: "tu_linh_1",
      name: "Hồn Thức Sơ Cấp",
      description: "Cảm nhận và điều khiển linh hồn vất vưởng.",
      tier: 1,
      cost: 1,
      requiredLevel: 1,
      requires: [],
      bonuses: { INT: 2 },
      flavor: "Cái chết không phải kết thúc — chỉ là sự chuyển đổi.",
    },
    {
      id: "tu_linh_2",
      name: "Âm Linh Triệu Hồi",
      description: "Triệu hồi âm linh chiến đấu — trí tuệ và linh lực tăng.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["tu_linh_1"],
      bonuses: { INT: 3, SPR: 2 },
      flavor: "Âm giới mở cửa — đội quân bóng tối xuất hiện.",
    },
    {
      id: "tu_linh_3",
      name: "Tử Khí Khắc Chế",
      description: "Bao phủ bản thân bằng tử khí, làm chậm kẻ địch.",
      tier: 2,
      cost: 1,
      requiredLevel: 3,
      requires: ["tu_linh_1"],
      bonuses: { AGI: 3, INT: 3 },
      flavor: "Tử khí không chỉ giết — nó làm tê liệt ý chí.",
    },
    {
      id: "tu_linh_4",
      name: "Quỷ Vương Chi Lệnh",
      description: "Nắm quyền thống trị cõi âm — mọi chỉ số đều thăng.",
      tier: 3,
      cost: 2,
      requiredLevel: 6,
      requires: ["tu_linh_2", "tu_linh_3"],
      bonuses: { STR: 2, INT: 2, AGI: 2, LCK: 2, END: 2, SPR: 2 },
      flavor: "Quỷ vương không cần ra lệnh — chúng tự biết phải làm gì.",
    },
    {
      id: "tu_linh_5",
      name: "Bất Diệt Tử Linh Quân",
      description: "Đội quân tử linh vô tận — mạnh mẽ và trí tuệ tuyệt đỉnh.",
      tier: 4,
      cost: 3,
      requiredLevel: 10,
      requires: ["tu_linh_4"],
      bonuses: { INT: 10, END: 5 },
      flavor: "Mọi cái chết đều phụng sự ta — mọi linh hồn đều là lính của ta.",
    },
  ],
};

export function getSkillTree(system: SystemName): SkillDef[] {
  return SKILL_TREES[system] ?? [];
}

export function getTotalBonusesFromSkills(
  system: SystemName,
  unlockedIds: string[]
): StatBonus {
  const tree = getSkillTree(system);
  const result: StatBonus = {};
  for (const skill of tree) {
    if (unlockedIds.includes(skill.id)) {
      for (const [stat, val] of Object.entries(skill.bonuses) as [keyof StatBonus, number][]) {
        result[stat] = (result[stat] ?? 0) + val;
      }
    }
  }
  return result;
}

export function canUnlockSkill(
  skill: SkillDef,
  characterLevel: number,
  unlockedIds: string[],
  availablePoints: number
): { ok: boolean; reason?: string } {
  if (unlockedIds.includes(skill.id)) return { ok: false, reason: "Đã học kỹ năng này" };
  if (characterLevel < skill.requiredLevel)
    return { ok: false, reason: `Cần cấp ${skill.requiredLevel}` };
  if (availablePoints < skill.cost)
    return { ok: false, reason: `Cần ${skill.cost} điểm kỹ năng` };
  if (skill.requires.length > 0 && !skill.requires.some((r) => unlockedIds.includes(r)))
    return { ok: false, reason: "Cần học kỹ năng tiên quyết trước" };
  return { ok: true };
}
