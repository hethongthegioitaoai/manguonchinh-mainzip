import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import readline from "readline";

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Thiếu GEMINI_API_KEY trong secrets.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

async function generate(moiBai: string, ketBai: string, soPhienBan: number) {
  const ketBaiLine = ketBai
    ? `KẾT BÀI (tầm nhìn cuối): "${ketBai}"`
    : `KẾT BÀI: Chưa xác định — hãy TỰ ĐỀ XUẤT một tầm nhìn phù hợp với mở bài và ghi rõ ở đầu mỗi phiên bản.`;

  const PROMPT = `
Bạn là một Game Designer và Product Strategist kỳ cựu.

Người dùng có một ý tưởng game/sản phẩm:
MỞ BÀI (ý tưởng ban đầu): "${moiBai}"
${ketBaiLine}

Nhiệm vụ: Tạo ra ĐÚNG ${soPhienBan} PHIÊN BẢN ROADMAP khác nhau cho phần THÂN BÀI — tức là toàn bộ hành trình xây dựng sản phẩm từ ý tưởng đến tầm nhìn.

Mỗi phiên bản phải:
- Có một HƯỚNG PHÁT TRIỂN khác nhau (ví dụ: tập trung vào PvP, hoặc kinh tế, hoặc narrative, hoặc social...)
- Chia thành 4-6 GIA ĐOẠN rõ ràng
- Mỗi giai đoạn có: tên, mục tiêu, danh sách 3-5 tính năng/hệ thống cần build
- Thực tế, cụ thể, có thể build được

Không dùng markdown, không dùng ký hiệu ** hay ##.

FORMAT CHÍNH XÁC (không thêm bớt):

============================================================
PHIÊN BẢN [số]: [hướng phát triển chủ đạo 4-6 chữ]
============================================================
${ketBai ? "" : "TẦM NHÌN ĐỀ XUẤT: [AI tự viết]\n"}
MỞ BÀI: ${moiBai}

GIAI ĐOẠN [số] — [tên giai đoạn]
Mục tiêu: [1 câu]
Tính năng:
  - [tính năng 1]
  - [tính năng 2]
  - [tính năng 3]
  ...

(tiếp tục các giai đoạn)

KẾT BÀI: [tầm nhìn cuối]

Lặp lại cho mỗi phiên bản.
`.trim();

  process.stdout.write("\n⏳ Đang thiết kế roadmap");
  const interval = setInterval(() => process.stdout.write("."), 600);

  const result = await model.generateContent(PROMPT);
  const text = result.response.text();

  clearInterval(interval);
  process.stdout.write("\n\n");

  const safeTitle = moiBai
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `game-roadmap-${safeTitle}-${timestamp}.txt`;
  const outputDir = path.resolve(process.cwd(), "output");

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const header = [
    "=".repeat(60),
    `MO BAI : ${moiBai}`,
    ketBai ? `KET BAI: ${ketBai}` : `KET BAI: (AI tu de xuat)`,
    `Ngay   : ${new Date().toLocaleDateString("vi-VN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    })}`,
    "=".repeat(60),
    "",
  ].join("\n");

  fs.writeFileSync(path.join(outputDir, filename), header + text, "utf8");
  console.log(text);
  console.log("\n" + "─".repeat(60));
  console.log(`✅ Đã lưu: output/${filename}`);
}

async function main() {
  console.clear();
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║        GAME ROADMAP GENERATOR by Gemini      ║");
  console.log("║  Ý tưởng + Tầm nhìn → AI thiết kế lộ trình  ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();
  console.log("Mẹo: Kết bài có thể để TRỐNG — AI sẽ tự đề xuất tầm nhìn phù hợp.");
  console.log();

  while (true) {
    const moiBai = await ask("💡 Ý tưởng ban đầu (mở bài)  : ");
    if (!moiBai) { console.log("⚠️  Không được để trống.\n"); continue; }

    const ketBai = await ask("🏆 Tầm nhìn cuối (Enter = để AI tự đề xuất): ");

    const soRaw = await ask("🔢 Số phiên bản roadmap (Enter = 2): ");
    const soPhienBan = parseInt(soRaw) || 2;

    console.log();
    console.log(`   Mở bài : "${moiBai}"`);
    console.log(ketBai ? `   Kết bài: "${ketBai}"` : `   Kết bài: (AI tự đề xuất)`);
    console.log(`   Số phiên bản: ${soPhienBan}`);

    await generate(moiBai, ketBai, soPhienBan);

    console.log();
    const again = await ask("🔄 Tạo roadmap khác? (Enter = có / n = thoát): ");
    if (again.toLowerCase() === "n") break;
    console.log("\n" + "═".repeat(60) + "\n");
  }

  console.log("\n👋 Tạm biệt!\n");
  rl.close();
}

main().catch((err) => {
  console.error("❌ Lỗi:", err.message);
  rl.close();
  process.exit(1);
});
