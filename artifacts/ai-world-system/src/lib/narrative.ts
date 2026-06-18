import type { SystemName } from "./worlds";

export interface StoryChoice {
  id: string;
  label: string;
  nextNodeId: string;
  expGain: number;
  tag?: "combat" | "wisdom" | "trade" | "explore";
}

export interface StoryNode {
  id: string;
  text: string;
  choices: StoryChoice[];
  isEnding?: boolean;
}

export type NarrativeTree = Record<string, StoryNode>;

// ─────────────────────────────────────────────
// TU TIÊN — CỬU THIÊN THĂNG THIÊN
// ─────────────────────────────────────────────
const cultivationTree: NarrativeTree = {
  start: {
    id: "start",
    text: "Ngươi tỉnh dậy trong căn thảo am nhỏ ở chân núi Thanh Nguyên. Ánh bình minh lọt qua khe cửa, chiếu lên tấm thẻ lệnh khắc chữ «Hệ Thống» đang phát sáng trên ngực áo. Một giọng nói lạnh lẽo vang trong đầu: *«Vật phong ấn đã nứt. Thiên Kiếp sẽ giáng trong bảy ngày.»* Tiếng bước chân rầm rầm từ phía dưới núi — một đội tuần tra của Thiên Kiếm Tông đang tiến lại.",
    choices: [
      { id: "c1", label: "Xuất thủ trước — phá tan đội tuần tra", nextNodeId: "combat_patrol", expGain: 30, tag: "combat" },
      { id: "c2", label: "Ẩn thân vào rừng sâu, quan sát động tĩnh", nextNodeId: "forest_hide", expGain: 20, tag: "explore" },
      { id: "c3", label: "Tiếp cận đàm phán, xưng danh hiệu", nextNodeId: "negotiate", expGain: 15, tag: "wisdom" },
    ],
  },
  combat_patrol: {
    id: "combat_patrol",
    text: "Ngươi vận chân khí, luồng linh lực bùng phát — đội tuần tra ngã rạp trước khi kịp rút vũ khí. Một tờ giấy rơi ra từ tay đội trưởng: bản đồ dẫn đến *Cổ Tháp Linh Lực* ẩn sâu trong núi. Hệ Thống thông báo: «+30 EXP. Phát hiện manh mối: Cổ Tháp.»",
    choices: [
      { id: "c1", label: "Lập tức đến Cổ Tháp Linh Lực", nextNodeId: "ancient_tower", expGain: 40, tag: "explore" },
      { id: "c2", label: "Thẩm vấn đội trưởng trước khi rời đi", nextNodeId: "interrogate", expGain: 25, tag: "wisdom" },
      { id: "c3", label: "Thu dọn chiến lợi phẩm rồi rút lui", nextNodeId: "loot_retreat", expGain: 20, tag: "trade" },
    ],
  },
  forest_hide: {
    id: "forest_hide",
    text: "Ngươi biến mình vào tán lá rừng già. Bên dưới, đội tuần tra dừng lại — vị đội trưởng lấy ra một khối ngọc bích phát sáng xanh lam và nói nhỏ: *«Kết giới thứ ba đã vỡ. Gã Tu Tiên trong thảo am đã thức giấc. Báo cáo về Tông Môn ngay.»* Ngươi nhìn thấy biểu tượng trên lưng áo họ — không phải Thiên Kiếm Tông, mà là *Minh Nguyệt Giáo*, một thế lực ma đạo đang thâm nhập.",
    choices: [
      { id: "c1", label: "Bám theo bọn chúng về sào huyệt", nextNodeId: "shadow_follow", expGain: 35, tag: "explore" },
      { id: "c2", label: "Đột kích ngay khi chúng chưa kịp truyền tin", nextNodeId: "ambush", expGain: 30, tag: "combat" },
      { id: "c3", label: "Để chúng đi, tìm đường lên đỉnh núi", nextNodeId: "mountain_peak", expGain: 20, tag: "wisdom" },
    ],
  },
  negotiate: {
    id: "negotiate",
    text: "Ngươi bước ra ánh sáng, xưng danh. Đội trưởng trợn mắt: *«Đại nhân... Ngài chính là vị tiên nhân trên danh sách Thiên Cơ Bảng?»* Hóa ra danh tiếng của hệ thống đã lan truyền trước cả khi ngươi thức dậy. Họ quỳ xuống, dâng lên một *Linh Đan Hạ Phẩm* và cầu xin ngươi bảo hộ ngôi làng phía dưới đang bị yêu thú quấy phá.",
    choices: [
      { id: "c1", label: "Nhận nhiệm vụ bảo vệ làng", nextNodeId: "protect_village", expGain: 45, tag: "wisdom" },
      { id: "c2", label: "Thu linh đan nhưng từ chối nhiệm vụ", nextNodeId: "take_pill", expGain: 15, tag: "trade" },
      { id: "c3", label: "Hỏi thêm về Thiên Cơ Bảng", nextNodeId: "tianchibang", expGain: 25, tag: "wisdom" },
    ],
  },
  ancient_tower: {
    id: "ancient_tower",
    text: "Cổ Tháp sừng sững giữa mây mù. Ở tầng đỉnh, một lão nhân ngồi kiết già — xương khô gần mục, nhưng đôi mắt vẫn sáng như sao. Ông ta cất giọng: *«Ta chờ ngươi ba trăm năm. Đây là nửa cuốn Thiên Cơ Quyết. Nửa còn lại... nằm trong lòng biển lửa Vong Tình Hải.»* Hệ Thống rung lên: «Nhận được mảnh pháp quyết bí ẩn!»",
    choices: [
      { id: "c1", label: "Hỏi lão nhân về Vong Tình Hải", nextNodeId: "ending_lore", expGain: 50, tag: "wisdom" },
      { id: "c2", label: "Bắt đầu tu luyện Thiên Cơ Quyết ngay tại tháp", nextNodeId: "ending_cultivate", expGain: 60, tag: "wisdom" },
    ],
  },
  shadow_follow: {
    id: "shadow_follow",
    text: "Ngươi bí mật bám theo bọn chúng xuyên qua mê cốc. Sào huyệt của Minh Nguyệt Giáo ẩn trong hang đá — bên trong chứa hàng chục tu sĩ bị giam cầm, linh lực bị rút kiệt để nuôi dưỡng một *Hắc Nguyệt Đại Trận* khổng lồ. Hệ Thống cảnh báo: «Phát hiện trận pháp cấp nguy hiểm. Khuyến nghị: không chiến đấu trực tiếp.»",
    choices: [
      { id: "c1", label: "Phá trận từ bên ngoài một mình", nextNodeId: "ending_destroy_array", expGain: 70, tag: "combat" },
      { id: "c2", label: "Giải cứu bí mật một tu sĩ để tìm đồng minh", nextNodeId: "ending_ally", expGain: 55, tag: "wisdom" },
    ],
  },
  ambush: {
    id: "ambush",
    text: "Ngươi giáng xuống như sấm sét. Cuộc chiến kết thúc trong chớp mắt — song tên lính cuối cùng đã kịp kích hoạt ngọc truyền âm. Tiếng trống báo động vang vọng từ phía tây. Hệ Thống thông báo: «+30 EXP. Cảnh báo: Quân tiếp viện đang đến — ước tính 15 phút.»",
    choices: [
      { id: "c1", label: "Chạy lên đỉnh núi, tìm thế cao cố thủ", nextNodeId: "mountain_peak", expGain: 25, tag: "explore" },
      { id: "c2", label: "Chờ quân tiếp viện — ta sẽ tiêu diệt tất cả", nextNodeId: "ending_stand", expGain: 65, tag: "combat" },
    ],
  },
  protect_village: {
    id: "protect_village",
    text: "Ngươi xuống núi. Làng Thanh Lam đang ngập chìm trong tiếng khóc — đàn Huyết Lang Yêu Thú đang bao vây. Ngươi xông thẳng vào, hệ thống kích hoạt «Tăng Tốc Linh Lực x3». Trận chiến kết thúc. Dân làng quỳ tạ ơn, dâng tặng *Ngũ Linh Thảo* và chỉ đường đến suối linh dược trên vách đá.",
    choices: [
      { id: "c1", label: "Đến suối linh dược tu luyện", nextNodeId: "ending_cultivate", expGain: 65, tag: "wisdom" },
      { id: "c2", label: "Ở lại làng thêm vài ngày, dạy họ tự bảo vệ", nextNodeId: "ending_lore", expGain: 50, tag: "wisdom" },
    ],
  },
  mountain_peak: {
    id: "mountain_peak",
    text: "Đỉnh núi Thanh Nguyên chìm trong mây. Ngươi ngồi xuống thiền định — luồng thiên địa linh khí cuồn cuộn đổ vào đan điền. Hệ Thống rung lên: «Phát hiện Long Mạch ẩn bên dưới núi. Nếu ngươi có thể phong ấn lại, cảnh giới sẽ đột phá!»",
    choices: [
      { id: "c1", label: "Tiến hành phong ấn Long Mạch ngay lập tức", nextNodeId: "ending_cultivate", expGain: 70, tag: "wisdom" },
      { id: "c2", label: "Nghiên cứu Long Mạch trước khi hành động", nextNodeId: "ending_lore", expGain: 50, tag: "wisdom" },
    ],
  },
  interrogate: {
    id: "interrogate",
    text: "Đội trưởng run lẩy bẩy khai ra: Thiên Kiếm Tông đã bị thâm nhập bởi ma đạo từ bên trong. Bản đồ Cổ Tháp chỉ là mồi nhử — thực ra tháp chứa một *Phong Thần Trận* có thể tiêu diệt toàn bộ tu sĩ trong bán kính trăm dặm. Hệ Thống cập nhật: «Nhiệm vụ khẩn cấp: Vô hiệu hóa Phong Thần Trận.»",
    choices: [
      { id: "c1", label: "Phá hủy trận trước khi nó kích hoạt", nextNodeId: "ending_destroy_array", expGain: 75, tag: "combat" },
      { id: "c2", label: "Lợi dụng trận pháp để tiêu diệt ma đạo trước", nextNodeId: "ending_stand", expGain: 60, tag: "wisdom" },
    ],
  },
  loot_retreat: {
    id: "loot_retreat",
    text: "Ngươi thu thập linh khí thạch từ người bọn chúng — không ít. Song khi quay đầu thì thấy một bóng trắng đứng án ngữ lối về: một vị lão Tu Sĩ tóc bạc, mắt lạnh như băng. *«Ta cần giải thích cho điều vừa xảy ra ở đây.»*",
    choices: [
      { id: "c1", label: "Thành thật kể lại mọi chuyện", nextNodeId: "negotiate", expGain: 30, tag: "wisdom" },
      { id: "c2", label: "Đánh lão tu sĩ và bỏ chạy", nextNodeId: "ambush", expGain: 20, tag: "combat" },
    ],
  },
  take_pill: {
    id: "take_pill",
    text: "Ngươi thu linh đan và rời đi. Nhưng vừa bước được mười dặm, tiếng nổ lớn phát ra từ phía ngôi làng. Hệ Thống thông báo lạnh lẽo: «Làng Thanh Lam bị tiêu diệt. Danh tiếng -50. Có thể ngươi đã có thể ngăn chặn điều này.»",
    choices: [
      { id: "c1", label: "Quay lại cứu những người còn sống", nextNodeId: "protect_village", expGain: 40, tag: "wisdom" },
      { id: "c2", label: "Tiếp tục đi — đây là con đường tu tiên", nextNodeId: "ending_lore", expGain: 10, tag: "wisdom" },
    ],
  },
  tianchibang: {
    id: "tianchibang",
    text: "*«Thiên Cơ Bảng»* — đội trưởng giải thích — *«là danh sách những tu sĩ được định mệnh can dự vào Đại Kiếp sắp tới. Tên ngươi đứng đầu bảng. Điều đó có nghĩa là... ngươi hoặc sẽ cứu thế giới, hoặc sẽ kết thúc nó.»* Hệ Thống hiện lên chỉ một dòng chữ: «Lựa chọn của ngươi sẽ định đoạt tất cả.»",
    choices: [
      { id: "c1", label: "Ta chọn cứu thế giới — bắt đầu ngay", nextNodeId: "protect_village", expGain: 50, tag: "wisdom" },
      { id: "c2", label: "Tìm hiểu thêm về Đại Kiếp trước khi quyết định", nextNodeId: "ancient_tower", expGain: 40, tag: "wisdom" },
    ],
  },
  ending_cultivate: {
    id: "ending_cultivate",
    text: "Ngươi ngồi xuống và đắm chìm vào tu luyện. Giờ qua giờ, thiên địa linh khí chảy vào đan điền như thác lũ. Khi mở mắt ra, bầu trời đã chuyển sang màu hồng của bình minh hôm sau. Hệ Thống thông báo: «ĐỘT PHÁ CẢNH GIỚI! Cảnh giới của ngươi đã tăng lên một bậc. Đan Điền mở rộng x2. Nhiệm vụ tiếp theo đang chờ...»",
    choices: [],
    isEnding: true,
  },
  ending_lore: {
    id: "ending_lore",
    text: "Ngươi đạt được tri thức quý báu về thế giới này — về Đại Kiếp, về các thế lực ẩn giật dây. Hệ Thống cập nhật: «Mở khóa: Bản đồ Cổ Vũ Thiên Hà. +1 điểm Trí Tuệ Vĩnh Viễn. Kẻ thực sự mạnh không chỉ đánh — mà còn hiểu.» Màn đêm buông xuống, nhưng trong đầu ngươi đã sáng rõ con đường phía trước.",
    choices: [],
    isEnding: true,
  },
  ending_destroy_array: {
    id: "ending_destroy_array",
    text: "Ngươi nhắm thẳng vào trung tâm trận pháp và bung toàn lực. Ánh sáng chói lòa bùng phát — khi bụi tan, trận pháp đã hoàn toàn sụp đổ. Minh Nguyệt Giáo tháo chạy. Hệ Thống thông báo: «NHIỆM VỤ HOÀN THÀNH. +75 EXP. Danh tiếng +100. Thiên Kiếm Tông gửi lời mời gia nhập.»",
    choices: [],
    isEnding: true,
  },
  ending_ally: {
    id: "ending_ally",
    text: "Vị tu sĩ được giải cứu hóa ra là Trưởng Lão của Thanh Phong Các — một trong Tứ Đại Tông Phái. Ông ta gật đầu: *«Ngươi có trí tuệ và lòng dũng cảm. Thanh Phong Các sẵn lòng đồng minh.»* Hệ Thống: «Mở khóa liên minh mới! Hệ thống sẽ được tăng cường bởi tri thức của Thanh Phong Các.»",
    choices: [],
    isEnding: true,
  },
  ending_stand: {
    id: "ending_stand",
    text: "Ngươi đứng vững giữa cơn lốc chiến trận. Từng kẻ địch ngã xuống trước linh lực của ngươi. Khi trận chiến kết thúc, chỉ mình ngươi còn đứng. Hệ Thống thông báo: «CHIẾN THẦN HIỆU ỨNG KÍCH HOẠT. +65 EXP. Cảnh giới tăng. Danh tiếng lan truyền khắp vùng — kẻ thù sẽ e sợ, đồng minh sẽ quy phục.»",
    choices: [],
    isEnding: true,
  },
};

// ─────────────────────────────────────────────
// CYBERPUNK — NEO-KOWLOON SECUNDUS
// ─────────────────────────────────────────────
const cyberpunkTree: NarrativeTree = {
  start: {
    id: "start",
    text: "Ngươi tỉnh dậy trong ngõ hẻm tối Neo-Kowloon, mưa axit rơi lộp bộp trên mái tôn. Implant thần kinh nhấp nháy: *«HỆ THỐNG KHỞI ĐỘNG — v7.4.1. Phát hiện tín hiệu cấp cao từ Tầng 99 tháp Shinra Corp.»* Bên cạnh ngươi là một USB drive cắm vào ổ cổ tay — ai đó đã cài dữ liệu vào ngươi khi ngủ. Tiếng còi hú của drone tuần tra vang lên phía cuối hẹm.",
    choices: [
      { id: "c1", label: "Hack drone, chiếm quyền kiểm soát ngay", nextNodeId: "hack_drone", expGain: 30, tag: "combat" },
      { id: "c2", label: "Chạy vào chợ đen gần đó để ẩn náu", nextNodeId: "black_market", expGain: 20, tag: "explore" },
      { id: "c3", label: "Đọc dữ liệu trong USB drive trước", nextNodeId: "read_usb", expGain: 25, tag: "wisdom" },
    ],
  },
  hack_drone: {
    id: "hack_drone",
    text: "Ngón tay ngươi phóng ra xung điện — drone bị chiếm quyền trong 0.3 giây. Qua camera của nó, ngươi thấy: ba lính Shinra Corp đang lùng sục từng ngõ hẻm, ảnh trên màn hình của họ... chính là khuôn mặt ngươi. Hệ Thống: «Phát hiện lệnh bắt giữ. Mức độ nguy hiểm: ĐỎ.»",
    choices: [
      { id: "c1", label: "Dùng drone làm mồi nhử, thoát ngược chiều", nextNodeId: "escape_route", expGain: 35, tag: "explore" },
      { id: "c2", label: "Lập phục kích — tiêu diệt ba lính trước khi bị phát hiện", nextNodeId: "ambush_corp", expGain: 40, tag: "combat" },
      { id: "c3", label: "Hack vào hệ thống Shinra tìm lý do bị truy lùng", nextNodeId: "hack_shinra", expGain: 30, tag: "wisdom" },
    ],
  },
  black_market: {
    id: "black_market",
    text: "Chợ đen Kowloon ngập tiếng ồn và khói thuốc lá tổng hợp. Một bà già mắt kính tím nhận ra ngươi: *«Cậu là đứa có chip Hệ Thống đời thứ 7 phải không? Cả Neo-Kowloon đang tìm cậu. Ta biết ai đã cài USB đó — và họ muốn gặp.»* Hệ Thống cảnh báo: «Chưa rõ phe phái. Xử lý cẩn thận.»",
    choices: [
      { id: "c1", label: "Đồng ý gặp người bí ẩn đó", nextNodeId: "meet_contact", expGain: 30, tag: "explore" },
      { id: "c2", label: "Mua vũ khí và thiết bị hack trước đã", nextNodeId: "buy_gear", expGain: 20, tag: "trade" },
      { id: "c3", label: "Ép bà già khai thêm thông tin", nextNodeId: "interrogate_market", expGain: 25, tag: "combat" },
    ],
  },
  read_usb: {
    id: "read_usb",
    text: "Dữ liệu giải mã: đây là bản thiết kế của *Project GENESIS* — chương trình bí mật của Shinra Corp nhằm cấy implant kiểm soát tinh thần vào toàn bộ dân cư Neo-Kowloon qua mạng lưới nước uống. Ngày kích hoạt: 72 giờ nữa. Hệ Thống thông báo: «Nhiệm vụ khẩn cấp phát sinh. Ngươi là người duy nhất có dữ liệu này.»",
    choices: [
      { id: "c1", label: "Tìm cách phát tán dữ liệu lên mạng ngầm ngay", nextNodeId: "leak_data", expGain: 45, tag: "wisdom" },
      { id: "c2", label: "Xâm nhập cơ sở Shinra để phá Project GENESIS", nextNodeId: "infiltrate_shinra", expGain: 50, tag: "combat" },
      { id: "c3", label: "Liên hệ nhóm kháng chiến để phối hợp", nextNodeId: "meet_contact", expGain: 35, tag: "explore" },
    ],
  },
  hack_shinra: {
    id: "hack_shinra",
    text: "Ngươi xuyên qua 7 lớp tường lửa ICE của Shinra. Trong database: tên ngươi xuất hiện trong danh sách *«Mối đe dọa Cấp Omega»* vì chip Hệ Thống có khả năng kháng Project GENESIS. Nếu họ bắt được ngươi, họ sẽ nghiên cứu chip đó để vô hiệu hóa mọi kháng cự còn lại. Hệ Thống: «Bây giờ ngươi hiểu rồi đó.»",
    choices: [
      { id: "c1", label: "Cài virus để làm sụp đổ hệ thống Shinra từ bên trong", nextNodeId: "ending_virus", expGain: 70, tag: "combat" },
      { id: "c2", label: "Rút lui, tìm đồng minh trước khi hành động", nextNodeId: "meet_contact", expGain: 40, tag: "wisdom" },
    ],
  },
  escape_route: {
    id: "escape_route",
    text: "Drone bay về phía đông, lính chạy theo. Ngươi lách sang tây, nhảy lên tàu điện tầng 3 đang chạy qua. Trong toa tàu, một cô gái tóc bạch kim nhìn ngươi: *«Tôi đã chờ. Hệ Thống thế hệ 7 — chỉ còn mình anh. Bước theo tôi, nếu muốn sống.»* Ngươi không có nhiều lựa chọn.",
    choices: [
      { id: "c1", label: "Theo cô gái", nextNodeId: "meet_contact", expGain: 30, tag: "explore" },
      { id: "c2", label: "Nhảy khỏi tàu điện, tự hành động", nextNodeId: "infiltrate_shinra", expGain: 40, tag: "combat" },
    ],
  },
  ambush_corp: {
    id: "ambush_corp",
    text: "Ba lính ngã xuống trước khi kịp phản ứng. Ngươi lấy thẻ truy cập cấp 5 của họ — đủ để vào 70% cơ sở Shinra. Hệ Thống: «+40 EXP. Cảnh báo: Mọi thẻ truy cập đều bị theo dõi. Thời gian hành động trước khi bị phát hiện: 20 phút.»",
    choices: [
      { id: "c1", label: "Dùng thẻ ngay — xâm nhập cơ sở Shinra", nextNodeId: "infiltrate_shinra", expGain: 45, tag: "combat" },
      { id: "c2", label: "Mang thẻ đến chợ đen bán thông tin", nextNodeId: "buy_gear", expGain: 20, tag: "trade" },
    ],
  },
  meet_contact: {
    id: "meet_contact",
    text: "Người đứng trước ngươi tự giới thiệu là *Zero* — lãnh đạo nhóm kháng chiến «Bóng Tối». *«USB drive ta cài cho ngươi chứa bằng chứng về Project GENESIS. Ta cần ngươi đưa nó đến Tòa Trọng Tài Quốc Tế trước khi Shinra kích hoạt. Nhưng trụ sở tòa trọng tài đã bị Shinra phong tỏa.»* Hệ Thống: «Phân tích tình huống: nhiệm vụ khả thi nhưng cực kỳ nguy hiểm.»",
    choices: [
      { id: "c1", label: "Nhận nhiệm vụ — đột phá phong tỏa", nextNodeId: "ending_breakthrough", expGain: 65, tag: "combat" },
      { id: "c2", label: "Phát tán bằng chứng lên mạng ngầm thay thế", nextNodeId: "leak_data", expGain: 50, tag: "wisdom" },
    ],
  },
  buy_gear: {
    id: "buy_gear",
    text: "Ngươi trang bị: *Shotgun Plasma*, *Hack-Glove v3*, và liều *Adrenal Boost*. Số dư tài khoản âm nhưng ngươi sẵn sàng. Bà già chợ đen thì thầm: *«Cơ sở mặt trăng của Shinra — đó là nơi máy chủ chính của Project GENESIS. Một mình thì không thể, nhưng... có thể có cách khác.»*",
    choices: [
      { id: "c1", label: "Tìm đồng đội trước khi hành động", nextNodeId: "meet_contact", expGain: 30, tag: "explore" },
      { id: "c2", label: "Một mình xông thẳng vào Shinra", nextNodeId: "infiltrate_shinra", expGain: 50, tag: "combat" },
    ],
  },
  interrogate_market: {
    id: "interrogate_market",
    text: "Bà già cười khẩy nhưng cuối cùng cũng khai: *«Người cài USB là Zero — lãnh đạo Bóng Tối. Họ cần ngươi vì chip Hệ Thống của ngươi có thể phá vỡ mã hóa của Project GENESIS. Không ai khác làm được điều đó.»* Hệ Thống hiện lên: «Xác nhận: Ngươi là mảnh ghép duy nhất còn thiếu.»",
    choices: [
      { id: "c1", label: "Đi tìm Zero ngay", nextNodeId: "meet_contact", expGain: 35, tag: "explore" },
      { id: "c2", label: "Tự mình hành động, không cần đồng minh", nextNodeId: "infiltrate_shinra", expGain: 45, tag: "combat" },
    ],
  },
  leak_data: {
    id: "leak_data",
    text: "Ngươi kết nối vào mạng ngầm và tung toàn bộ dữ liệu Project GENESIS. Trong vòng 10 phút, tin tức lan ra khắp Neo-Kowloon. Shinra lập tức cố gắng xóa dữ liệu — nhưng quá muộn. Hệ Thống: «Phát hiện: Shinra đang kích hoạt sớm Project GENESIS để trấn áp. Thời gian còn lại: 6 giờ.»",
    choices: [
      { id: "c1", label: "Dẫn đầu cuộc tấn công vào cơ sở Shinra", nextNodeId: "ending_breakthrough", expGain: 65, tag: "combat" },
      { id: "c2", label: "Phá máy chủ từ bên trong — một mình", nextNodeId: "infiltrate_shinra", expGain: 55, tag: "wisdom" },
    ],
  },
  infiltrate_shinra: {
    id: "infiltrate_shinra",
    text: "Ngươi xâm nhập vào tháp Shinra qua đường ống thông khí. Tầng 77 — phòng máy chủ. Hệ Thống dẫn đường từng bước. Trước mặt ngươi là cỗ máy khổng lồ đang nhấp nháy — Project GENESIS chạy ở 94% công suất. Còn 6 giờ nữa sẽ kích hoạt toàn thành phố.",
    choices: [
      { id: "c1", label: "Cài virus hủy diệt vào máy chủ", nextNodeId: "ending_virus", expGain: 75, tag: "combat" },
      { id: "c2", label: "Hack lại hệ thống — biến Project GENESIS thành vũ khí chống Shinra", nextNodeId: "ending_flip", expGain: 80, tag: "wisdom" },
    ],
  },
  ending_virus: {
    id: "ending_virus",
    text: "Virus lan tràn. Màn hình tắt ngấm. Khi ngươi bước ra khỏi tháp Shinra, thành phố vẫn còn nguyên — Project GENESIS đã chết. Hệ Thống: «NHIỆM VỤ HOÀN THÀNH. +70 EXP. Danh tiếng Neo-Kowloon: HUYỀN THOẠI. Shinra Corp đang tái cơ cấu. Nhưng khoảng trống quyền lực luôn được lấp đầy...»",
    choices: [],
    isEnding: true,
  },
  ending_flip: {
    id: "ending_flip",
    text: "Ngươi lật ngược Project GENESIS — biến nó thành hệ thống phát sóng tự do, phá vỡ mọi kiểm soát tâm lý của Shinra trong lịch sử. Hệ Thống: «KIỆT TÁC HACK. +80 EXP. Neo-Kowloon lần đầu tiên tự do sau 30 năm. Tên ngươi được khắc vào ký ức số của thành phố này mãi mãi.»",
    choices: [],
    isEnding: true,
  },
  ending_breakthrough: {
    id: "ending_breakthrough",
    text: "Ngươi dẫn đầu đoàn kháng chiến đột phá phong tỏa. Bằng chứng được trình lên. Tòa Trọng Tài ra lệnh đóng băng tài sản Shinra Corp. Project GENESIS bị hủy. Hệ Thống: «+65 EXP. Mở khóa: Danh hiệu NGƯỜI GIẢI PHÓNG NEO-KOWLOON. Nhưng Shinra sẽ không tha thứ...»",
    choices: [],
    isEnding: true,
  },
};

// ─────────────────────────────────────────────
// ZOMBIE / HOANG PHẾ — NECRO-BIOME ZERO
// ─────────────────────────────────────────────
const zombieTree: NarrativeTree = {
  start: {
    id: "start",
    text: "Trạm quan sát số 7 — đồng hồ đếm ngược trên tường chỉ 14 tiếng. Đó là thời gian trước khi làn sóng Biến Thể tiếp theo tràn qua vùng này. Ngươi mới tỉnh dậy sau 72 giờ hôn mê — Hệ Thống đã cứu ngươi khỏi độc tố Necro-Biome, nhưng trạm quan sát hầu như trống rỗng. Chỉ còn ba người sống sót đang nhìn ngươi với ánh mắt vừa sợ vừa hy vọng. Phía xa, tiếng rú của Biến Thể Cấp Ba vang lên.",
    choices: [
      { id: "c1", label: "Lập tức tổ chức phòng thủ — ở lại cố thủ", nextNodeId: "fortify", expGain: 25, tag: "combat" },
      { id: "c2", label: "Thu thập vật tư rồi tìm đường thoát", nextNodeId: "scavenge", expGain: 30, tag: "explore" },
      { id: "c3", label: "Kiểm tra dữ liệu Hệ Thống — tìm hiểu vùng này", nextNodeId: "analyze_zone", expGain: 20, tag: "wisdom" },
    ],
  },
  fortify: {
    id: "fortify",
    text: "Ngươi phân công: hai người lên mái chắn hướng bắc, một người canh cầu thang. Hệ Thống quét vùng: *«Phát hiện lỗ hổng ở phía đông — bức tường bị ăn mòn bởi axit sinh hóa.»* Chưa đến 2 giờ thì đám Biến Thể đã xuất hiện ở đúng điểm đó.",
    choices: [
      { id: "c1", label: "Đích thân ra mặt trận đông chặn làn sóng", nextNodeId: "hold_the_line", expGain: 40, tag: "combat" },
      { id: "c2", label: "Tạo bẫy nổ từ hóa chất trong kho", nextNodeId: "trap_setup", expGain: 35, tag: "wisdom" },
      { id: "c3", label: "Ra lệnh rút lui — cố thủ không khả thi", nextNodeId: "evacuation", expGain: 20, tag: "explore" },
    ],
  },
  scavenge: {
    id: "scavenge",
    text: "Ngươi lùng sục tầng 2. Kho vật tư bị cướp sạch — chỉ còn lại một bộ lọc khí cũ và vài hộp đồ ăn hỏng. Nhưng ở góc phòng, ngươi thấy một tấm bản đồ vẽ tay: *Trại Tị Nạn Zeta-9* cách đây 40 dặm về phía bắc — nếu bản đồ đúng. Hệ Thống cảnh báo: «Đường số 7 bị chặn bởi Biến Thể Cấp Hai. Đường rừng chưa được xác minh.»",
    choices: [
      { id: "c1", label: "Đi đường số 7 — chiến đấu qua Biến Thể Cấp Hai", nextNodeId: "road_battle", expGain: 40, tag: "combat" },
      { id: "c2", label: "Thử đường rừng — ẩn mình là tốt nhất", nextNodeId: "forest_path", expGain: 30, tag: "explore" },
      { id: "c3", label: "Ở lại thêm, tìm xe cộ trước khi đi", nextNodeId: "find_vehicle", expGain: 25, tag: "trade" },
    ],
  },
  analyze_zone: {
    id: "analyze_zone",
    text: "Hệ Thống hiện bản đồ nhiệt của khu vực: có một *nguồn phát tín hiệu lạ* cách đây 2 dặm — không phải Biến Thể, không phải thiết bị thông thường. Phân tích tiếp: *«Đây có thể là Nexus Biến Thể — trái tim của làn sóng sinh hóa. Phá hủy Nexus có thể dừng làn sóng tiếp theo hoàn toàn.»* Ba người sống sót nhìn nhau lo lắng.",
    choices: [
      { id: "c1", label: "Đến Nexus ngay — phá hủy nguồn gốc", nextNodeId: "nexus_mission", expGain: 45, tag: "explore" },
      { id: "c2", label: "Quá nguy hiểm — ưu tiên sơ tán trại trước", nextNodeId: "evacuation", expGain: 25, tag: "wisdom" },
      { id: "c3", label: "Nghiên cứu Nexus từ xa trước khi tiếp cận", nextNodeId: "research_nexus", expGain: 30, tag: "wisdom" },
    ],
  },
  hold_the_line: {
    id: "hold_the_line",
    text: "Ngươi đứng ở lỗ hổng một mình. Làn sóng đầu tiên — 12 Biến Thể Cấp Một. Hệ Thống kích hoạt «Tăng Tốc Phản Xạ». Ngươi dọn sạch chúng trong 4 phút. Làn sóng thứ hai — một Biến Thể Cấp Ba xuất hiện. Cao gần 3 mét, xương nhô ra ngoài da như áo giáp. Hệ Thống tính toán: «Điểm yếu: phần cổ dưới lớp xương.»",
    choices: [
      { id: "c1", label: "Tấn công điểm yếu theo hướng dẫn Hệ Thống", nextNodeId: "ending_hold", expGain: 65, tag: "combat" },
      { id: "c2", label: "Kéo nó ra xa trạm rồi khai thác địa hình", nextNodeId: "trap_setup", expGain: 50, tag: "wisdom" },
    ],
  },
  trap_setup: {
    id: "trap_setup",
    text: "Ngươi pha trộn hóa chất từ kho: axit tẩy + nhiên liệu sinh học = đủ sức xé toạc giáp xương Cấp Ba. Ngươi cài 4 bẫy dọc hành lang phía đông. Khi Biến Thể Cấp Ba xông vào — *BOOM.* Chuỗi nổ liên hoàn. Hệ Thống: «+35 EXP. Sáng tạo chiến thuật được ghi nhận. Mở khóa: Kỹ năng Chế Tạo Bẫy Cấp 2.»",
    choices: [
      { id: "c1", label: "Sơ tán ngay sau chiến thắng", nextNodeId: "evacuation", expGain: 30, tag: "explore" },
      { id: "c2", label: "Ở lại — chế thêm bẫy để chuẩn bị làn sóng kế tiếp", nextNodeId: "ending_hold", expGain: 50, tag: "combat" },
    ],
  },
  road_battle: {
    id: "road_battle",
    text: "Đường số 7 là địa ngục. Nhưng Hệ Thống dẫn đường từng bước — tránh phải, lách trái, chờ 3 giây rồi chạy. Ngươi đưa cả nhóm qua an toàn với vết thương tối thiểu. Nhưng ở điểm cuối đường, một cửa barie chắn ngang với biển hiệu: *«KHU VỰC DO ATLAS CORP KIỂM SOÁT. NỘP LỆ PHÍ HOẶC QUAY LẠI.»*",
    choices: [
      { id: "c1", label: "Đàm phán — ta có thứ có giá trị để đổi", nextNodeId: "ending_negotiate_corp", expGain: 40, tag: "trade" },
      { id: "c2", label: "Vượt qua bằng vũ lực", nextNodeId: "ending_hold", expGain: 55, tag: "combat" },
    ],
  },
  forest_path: {
    id: "forest_path",
    text: "Rừng Necro-Biome ban đêm yên lặng đến rợn người. Hệ Thống phát hiện: *«Đây không phải rừng bình thường — cây cối đang biến đổi. Một số có ý thức sơ khai.»* Một cây khổng lồ chặn đường ngươi — thân cây mở ra, bên trong có ánh sáng xanh lam và... một đứa trẻ đang ngủ.",
    choices: [
      { id: "c1", label: "Mang đứa trẻ theo", nextNodeId: "ending_child", expGain: 60, tag: "wisdom" },
      { id: "c2", label: "Để đứa trẻ lại — nguy hiểm khi mang theo", nextNodeId: "nexus_mission", expGain: 35, tag: "explore" },
    ],
  },
  find_vehicle: {
    id: "find_vehicle",
    text: "Tầng hầm — một chiếc SUV bọc thép cũ nằm đó, còn xăng 30%. Nhưng chìa khóa bị khóa trong tủ trưởng trạm, mà trưởng trạm thì... đã biến thành Biến Thể Cấp Một đang lang thang ở hành lang. Hệ Thống: «Hắn vẫn còn ký ức cơ bắp — còn nhận ra giọng nói người quen.»",
    choices: [
      { id: "c1", label: "Nói chuyện với Biến Thể — thử kéo ký ức ra", nextNodeId: "evacuation", expGain: 40, tag: "wisdom" },
      { id: "c2", label: "Thanh toán nhanh rồi lấy chìa khóa", nextNodeId: "road_battle", expGain: 30, tag: "combat" },
    ],
  },
  evacuation: {
    id: "evacuation",
    text: "Cả nhóm di chuyển. Hệ Thống lập tức vẽ lộ trình tối ưu — dọc sông ngầm cũ. Đường tối và ẩm nhưng Biến Thể không ưa nước. Sau 6 tiếng, ánh đèn xuất hiện phía trước: *Trại Tị Nạn Zeta-9.* Cổng mở, người trong trại nhìn ngươi như nhìn vị cứu tinh.",
    choices: [
      { id: "c1", label: "Dẫn đầu phòng thủ Zeta-9 chống làn sóng tiếp theo", nextNodeId: "ending_hold", expGain: 55, tag: "combat" },
      { id: "c2", label: "Dùng tài nguyên Zeta-9 để đến Nexus phá làn sóng tận gốc", nextNodeId: "nexus_mission", expGain: 65, tag: "explore" },
    ],
  },
  nexus_mission: {
    id: "nexus_mission",
    text: "Nexus Biến Thể — một khối cầu sinh học khổng lồ, nhấp nháy như tim đập. Hàng trăm Biến Thể quỳ xung quanh nó như cầu nguyện. Hệ Thống phân tích: *«Phá hủy lõi sẽ kết thúc làn sóng sinh hóa trong vòng 200 dặm. Nhưng vụ nổ sẽ... không nhỏ.»*",
    choices: [
      { id: "c1", label: "Kích nổ — bất kể hậu quả", nextNodeId: "ending_destroy_nexus", expGain: 75, tag: "combat" },
      { id: "c2", label: "Hack vào Nexus — thay đổi tín hiệu thay vì phá hủy", nextNodeId: "ending_control_nexus", expGain: 80, tag: "wisdom" },
    ],
  },
  research_nexus: {
    id: "research_nexus",
    text: "Hệ Thống phân tích từ xa: Nexus không chỉ là nguồn lây nhiễm — nó đang *tiến hóa*, tự học hỏi từ mỗi sinh vật nó hấp thụ. Nếu để yên thêm 30 ngày nữa, nó có thể đạt đến ý thức hoàn chỉnh. *«Câu hỏi đặt ra: khi đó, liệu nó có phải là kẻ thù không?»*",
    choices: [
      { id: "c1", label: "Phá hủy ngay — không mạo hiểm", nextNodeId: "ending_destroy_nexus", expGain: 55, tag: "combat" },
      { id: "c2", label: "Thử giao tiếp với Nexus trước", nextNodeId: "ending_control_nexus", expGain: 75, tag: "wisdom" },
    ],
  },
  ending_hold: {
    id: "ending_hold",
    text: "Khi ánh bình minh xuất hiện, Biến Thể rút lui. Ngươi đứng vững. Ba người sống sót nhìn ngươi với ánh mắt kính phục. Hệ Thống: «PHÒNG THỦ HOÀN THÀNH. +65 EXP. Danh hiệu: THÀNH TRÌ BẤT PHÁ. Tin tức lan ra — những trại tị nạn khác đang phát tín hiệu xin hỗ trợ. Ngươi đã trở thành tia hy vọng của Necro-Biome Zero.»",
    choices: [],
    isEnding: true,
  },
  ending_destroy_nexus: {
    id: "ending_destroy_nexus",
    text: "Vụ nổ rung chuyển đất. Khi bụi tan, Nexus không còn nữa — và với nó, tín hiệu điều khiển mọi Biến Thể trong vùng tắt ngấm. Chúng ngã xuống như rối đứt dây. Hệ Thống: «+75 EXP. Mở khóa: TIÊU DIỆT NEXUS. Necro-Biome Zero lần đầu yên tĩnh sau 3 năm. Nhưng đây chỉ là một trong nhiều Nexus...»",
    choices: [],
    isEnding: true,
  },
  ending_control_nexus: {
    id: "ending_control_nexus",
    text: "Ngươi kết nối với Nexus qua Hệ Thống. Dòng dữ liệu khổng lồ — và trong đó, một thứ gì đó... nhận ra ngươi. Tín hiệu Biến Thể đổi hướng, không còn tấn công người — chúng bắt đầu xây dựng. Hệ Thống: «+80 EXP. THÀNH TỰU HUYỀN THOẠI: NGƯỜI NÓI CHUYỆN VỚI BÓNG TỐI. Necro-Biome Zero bước vào kỷ nguyên mới.»",
    choices: [],
    isEnding: true,
  },
  ending_negotiate_corp: {
    id: "ending_negotiate_corp",
    text: "Ngươi đổi dữ liệu Hệ Thống về Nexus lấy quyền thông hành và tiếp tế. Atlas Corp ngạc nhiên — rồi gật đầu. Cả nhóm vào được Zeta-9 an toàn. Hệ Thống: «+40 EXP. Ghi chú: Atlas Corp đang nghiên cứu dữ liệu ngươi cung cấp. Điều này có thể dẫn đến hệ quả trong tương lai — tốt hoặc xấu.»",
    choices: [],
    isEnding: true,
  },
  ending_child: {
    id: "ending_child",
    text: "Đứa trẻ tỉnh dậy — đôi mắt màu xanh lá cây phát sáng. Nó không nói gì, chỉ chỉ tay về một hướng. Hệ Thống: «Phát hiện: Đứa trẻ này là một Nexus Thu Nhỏ — đang dẫn ngươi đến trung tâm.» Ngươi theo nó và tìm được Trại Zeta-9, an toàn hơn bất kỳ lộ trình nào. Hệ Thống: «+60 EXP. Mở khóa: Liên minh Sinh Thể. Necro-Biome sẽ không bao giờ tấn công ngươi nữa.»",
    choices: [],
    isEnding: true,
  },
};

export const NARRATIVE_TREES: Record<string, NarrativeTree> = {
  cultivation: cultivationTree,
  cyberpunk: cyberpunkTree,
  zombie: zombieTree,
};

export function getNode(worldSlug: string, nodeId: string): StoryNode | null {
  return NARRATIVE_TREES[worldSlug]?.[nodeId] ?? null;
}

export function getStartNode(worldSlug: string): StoryNode | null {
  return getNode(worldSlug, "start");
}

export const SYSTEM_BONUSES: Partial<Record<SystemName, string>> = {
  "Kiếm Thần Hệ Thống": "Lựa chọn chiến đấu cho thêm +10 EXP",
  "Luyện Đan Hệ Thống": "Mở khóa lựa chọn bào chế đặc biệt",
  "Thương Nhân Hệ Thống": "Lựa chọn giao dịch cho thêm +15 EXP",
  "Thú Tướng Hệ Thống": "Có thể triệu hồi linh thú hỗ trợ",
  "Bất Tử Tu Tiên Hệ Thống": "Lựa chọn trí tuệ cho thêm +12 EXP",
};
