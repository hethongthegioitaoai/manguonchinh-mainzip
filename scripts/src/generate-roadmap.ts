import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const topic = process.argv.slice(2).join(" ").trim();

if (!topic) {
  console.error("❌ Thiếu chủ đề. Cách dùng:");
  console.error('   pnpm --filter @workspace/scripts run roadmap "Học lập trình web từ zero"');
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Thiếu GEMINI_API_KEY trong secrets.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const PROMPT = `
Bạn là một chuyên gia lập kế hoạch. Từ chủ đề sau, hãy tạo ra một ROADMAP chi tiết, thực tế và có thể thực hiện được.

CHỦ ĐỀ: "${topic}"

YÊU CẦU:
- Chia thành các giai đoạn rõ ràng (Giai đoạn 1, 2, 3...)
- Mỗi giai đoạn có: mục tiêu, các bước cụ thể, timeline ước tính, kết quả cần đạt
- Thêm mục "Tài nguyên cần thiết" và "Rủi ro & Cách xử lý"
- Kết thúc bằng "Tầm nhìn dài hạn"
- Viết bằng tiếng Việt, rõ ràng, dùng ký tự ASCII thông thường (không dùng emoji hay markdown phức tạp)
- Chỉ xuất văn bản thuần túy, không dùng ký hiệu markdown như ** hay ##

Hãy viết như một kịch bản phim — có mở đầu hấp dẫn, hành trình rõ ràng, và kết thúc truyền cảm hứng.
`.trim();

async function main() {
  console.log(`\n🚀 Đang tạo roadmap cho: "${topic}"...\n`);

  const result = await model.generateContent(PROMPT);
  const text = result.response.text();

  const safeTitle = topic
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `roadmap-${safeTitle}-${timestamp}.txt`;
  const outputDir = path.resolve(process.cwd(), "output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filepath = path.join(outputDir, filename);

  const header = [
    "=".repeat(70),
    `ROADMAP: ${topic.toUpperCase()}`,
    `Tạo ngày: ${new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
    "=".repeat(70),
    "",
  ].join("\n");

  fs.writeFileSync(filepath, header + text, "utf8");

  console.log("✅ Đã tạo xong!\n");
  console.log(`📄 File: output/${filename}`);
  console.log(`📏 Độ dài: ${text.split("\n").length} dòng\n`);
  console.log("-".repeat(50));
  console.log(text.slice(0, 500) + (text.length > 500 ? "\n\n... (xem file để đọc đầy đủ)" : ""));
}

main().catch((err) => {
  console.error("❌ Lỗi:", err.message);
  process.exit(1);
});
