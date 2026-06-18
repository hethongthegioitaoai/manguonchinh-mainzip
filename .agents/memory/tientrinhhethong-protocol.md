---
name: TIENTRINHHETHONG protocol
description: Quy trình bắt buộc khi mở dự án AI World System — đọc file tiến trình trước, build theo thứ tự, cập nhật file sau khi xong.
---

# Quy trình TIENTRINHHETHONG

**Why:** Dự án có nhiều tính năng ở các giai đoạn khác nhau. File này là nguồn sự thật duy nhất về trạng thái build. Không đọc trước sẽ dẫn đến build trùng lặp hoặc bỏ sót.

**How to apply:** Mỗi khi bắt đầu session mới trên dự án này:

1. Đọc `TIENTRINHHETHONG.md` ở root workspace TRƯỚC TIÊN
2. Kiểm tra workflow `API Server` (port 8080) và `Start application` (port 19734) đang chạy
3. Tìm task `[ ]` đầu tiên theo thứ tự ưu tiên (2 → 3 → 4)
4. Build task đó
5. Sau khi hoàn thành: cập nhật `TIENTRINHHETHONG.md`:
   - Đánh `[x]` cho task đã xong
   - Cập nhật bảng DB nếu thêm bảng mới
   - Cập nhật bảng Route nếu thêm trang mới
   - Sửa ngày "Cập nhật lần cuối" ở đầu file

**Stack nhanh (không cần grep lại):**
- Auth: Replit Auth OIDC — KHÔNG dùng Supabase
- DB schema thay đổi → `pnpm --filter @workspace/db run push`
- EXP formula: `level = floor(totalExp / 100) + 1`
- Battle EXP: win = enemyLevel×10, draw = ×3, lose = 0
