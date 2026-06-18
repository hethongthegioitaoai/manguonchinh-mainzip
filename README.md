# AI World System

Ứng dụng web phong cách cyber cultivation tối tăm, nơi người chơi đăng nhập, chọn thế giới nhập vai do AI dẫn dắt và tạo nhân vật gắn với hệ thống năng lực được chỉ định ngẫu nhiên.

---

## Công nghệ sử dụng

- **Frontend**: React + Vite + TypeScript
- **Giao diện**: Tailwind CSS v4, Framer Motion
- **Font chữ**: Orbitron (tiêu đề), Rajdhani (nội dung)
- **Điều hướng**: Wouter
- **Xác thực & Cơ sở dữ liệu**: Supabase
- **Thành phần UI**: shadcn/ui + Radix UI

---

## Các trang

| Đường dẫn | Trang | Mô tả |
|---|---|---|
| `/` | Trang chủ | Màn hình đầy đủ với logo có hiệu ứng động và nút Vào Thế Giới |
| `/login` | Đăng nhập | Xác thực bằng email + mật khẩu qua Supabase. Tài khoản mới tự động đăng ký |
| `/worlds` | Chọn Thế Giới | Ba thẻ thế giới — Tu Tiên, Cyberpunk, Vùng Hoang Phế |
| `/create-character/:worldId` | Tạo Nhân Vật | Nhập tên, quay ngẫu nhiên Hệ Thống, lưu nhân vật vào Supabase |

---

## Các thế giới

| Thế Giới | Phụ đề | Màu chủ đạo |
|---|---|---|
| Tu Tiên | Cửu Thiên Thăng Thiên | Xanh Cyan |
| Cyberpunk | Neo-Kowloon Secundus | Tím |
| Vùng Hoang Phế | Necro-Biome Zero | Xanh Độc |

---

## Hệ Thống (chỉ định ngẫu nhiên)

- Kiếm Thần Hệ Thống
- Luyện Đan Hệ Thống
- Thương Nhân Hệ Thống
- Thú Tướng Hệ Thống
- Bất Tử Tu Tiên Hệ Thống

---

## Cài đặt Supabase

### Biến môi trường

| Bí mật | Mô tả |
|---|---|
| `SUPABASE_URL` | URL dự án — lấy tại Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Khóa công khai anon tại cùng mục trên |

> Ứng dụng tự động thêm `https://` nếu URL được nhập thiếu giao thức.

### Bảng cơ sở dữ liệu

Chạy file `artifacts/ai-world-system/supabase-setup.sql` trong **SQL Editor** của Supabase:

```
users       — Hồ sơ công khai, tự tạo qua trigger khi có user mới trong auth.users
worlds      — 3 thế giới (đã seed sẵn: cultivation, cyberpunk, zombie)
characters  — Nhân vật người dùng với tên, khóa ngoại thế giới và JSONB stats
```

Tất cả các bảng đều bật **Row Level Security** — người dùng chỉ đọc/ghi được dữ liệu của chính mình.

---

## Chạy dự án

```bash
# Cài đặt dependencies
pnpm install

# Khởi động frontend
pnpm --filter @workspace/ai-world-system run dev

# Khởi động API server
pnpm --filter @workspace/api-server run dev

# Kiểm tra kiểu dữ liệu toàn bộ dự án
pnpm run typecheck
```

---

## Cấu trúc dự án

```
artifacts/
  ai-world-system/          # Frontend React + Vite
    src/
      pages/
        LandingPage.tsx
        LoginPage.tsx
        WorldsPage.tsx
        CharacterCreationPage.tsx
      contexts/
        AuthContext.tsx     # Quản lý phiên đăng nhập Supabase
      lib/
        supabase.ts         # Khởi tạo Supabase client
        worlds.ts           # Hằng số Thế Giới & Hệ Thống
      components/ui/        # Thành phần shadcn/ui
    supabase-setup.sql      # Schema DB + RLS policies
    vite.config.ts
  api-server/               # API Express (logic backend tương lai)
lib/                        # Thư viện dùng chung giữa các package
```

---

## Luồng xác thực

1. Người dùng nhập email + mật khẩu tại `/login`
2. Thử `signInWithPassword` — nếu tài khoản chưa tồn tại, tự động `signUp` rồi đăng nhập
3. Phiên đăng nhập được Supabase lưu vào localStorage và quản lý qua `AuthContext`
4. Các trang được bảo vệ (`/worlds`, `/create-character/*`) tự chuyển về `/login` nếu chưa đăng nhập

---

## Luồng tạo nhân vật

1. Chọn thế giới tại `/worlds`
2. Nhập tên nhân vật (2–32 ký tự)
3. Nhấn **ASSIGN SYSTEM** — hiệu ứng quay roulette chạy qua tất cả hệ thống rồi dừng ngẫu nhiên
4. Xem mô tả hệ thống, quay lại hoặc xác nhận
5. Khi xác nhận: nhân vật được lưu vào bảng `characters` với tên, khóa ngoại thế giới và `stats.system`
6. Tự động chuyển về `/worlds`
