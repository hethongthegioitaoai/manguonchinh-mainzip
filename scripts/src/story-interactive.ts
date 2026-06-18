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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function generate(moiBai: string, ketBai: string, soKichBan: number) {
  const PROMPT = `
Bạn là một nhà biên kịch tài năng. Người dùng đưa cho bạn MỞ BÀI và KẾT BÀI của một câu chuyện. Nhiệm vụ của bạn là sáng tác THÂN BÀI — tức là những gì xảy ra ở giữa.

MỞ BÀI: "${moiBai}"
KẾT BÀI: "${ketBai}"

Hãy tạo ra ĐÚNG ${soKichBan} KỊCH BẢN khác nhau cho thân bài. Mỗi kịch bản phải:
- Bắt đầu từ mở bài, kết thúc tại kết bài
- Có một hướng đi HOÀN TOÀN KHÁC NHAU (vui, buồn, kỳ lạ, phiêu lưu, hài hước, bi kịch, bất ngờ...)
- Gồm 3-5 sự kiện/bước chính diễn ra trong thân bài
- Mỗi bước được mô tả 1-2 câu, sống động và cụ thể
- Không dùng markdown, không dùng ký hiệu đặc biệt

FORMAT đầu ra CHÍNH XÁC như sau:

========================================
KỊCH BẢN [số]: [tên/cảm xúc chủ đạo bằng 3-5 chữ]
========================================

MỞ BÀI: ${moiBai}

[Bước 1]: [mô tả sự kiện]
[Bước 2]: [mô tả sự kiện]
[Bước 3]: [mô tả sự kiện]

KẾT BÀI: ${ketBai}

Lặp lại cho mỗi kịch bản.
`.trim();

  process.stdout.write("\n⏳ Đang sáng tác");
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
  const filename = `story-${safeTitle}-${timestamp}.txt`;
  const outputDir = path.resolve(process.cwd(), "output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const header = [
    "=".repeat(60),
    `MO BAI : ${moiBai}`,
    `KET BAI: ${ketBai}`,
    `Ngay   : ${new Date().toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    "=".repeat(60),
    "",
  ].join("\n");

  fs.writeFileSync(path.join(outputDir, filename), header + text, "utf8");

  console.log(text);
  console.log("\n" + "─".repeat(60));
  console.log(`✅ Đã lưu: output/${filename}`);

  return text;
}

async function main() {
  console.clear();
  console.log("╔══════════════════════════════════════════╗");
  console.log("║        STORY GENERATOR  by Gemini        ║");
  console.log("║  Nhập mở bài + kết bài → AI viết thân bài ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log();

  while (true) {
    const moiBai = await ask("📌 Mở bài  : ");
    if (!moiBai) { console.log("⚠️  Không được để trống.\n"); continue; }

    const ketBai = await ask("🏁 Kết bài : ");
    if (!ketBai) { console.log("⚠️  Không được để trống.\n"); continue; }

    const soRaw = await ask("🔢 Số kịch bản (Enter = 3): ");
    const soKichBan = parseInt(soRaw) || 3;

    console.log();
    console.log(`   Mở bài : "${moiBai}"`);
    console.log(`   Kết bài: "${ketBai}"`);
    console.log(`   Số kịch bản: ${soKichBan}`);

    await generate(moiBai, ketBai, soKichBan);

    console.log();
    const again = await ask("🔄 Tạo câu chuyện khác? (Enter = có / n = thoát): ");
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
