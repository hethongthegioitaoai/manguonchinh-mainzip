# AI World System

Web app nhập vai phong cách cyber cultivation tối tăm — đăng nhập Replit, chọn thế giới, tạo nhân vật, chiến đấu, nhận quest, và phiêu lưu.

> **🗂️ Tiến trình build:** Xem `TIENTRINHHETHONG.md` ở root — đọc file đó TRƯỚC KHI làm bất cứ thứ gì.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 8080)
- `pnpm --filter @workspace/ai-world-system run dev` — Frontend (port 19734)
- `pnpm run typecheck` — typecheck toàn workspace
- `pnpm run build` — build tất cả packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod schemas từ OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema (dev only, **chạy sau mỗi lần thêm/sửa schema**)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS v4 + Framer Motion + Wouter + shadcn/ui
- Backend: Express 5 (port 8080)
- Auth: **Replit Auth** (OIDC — `openid-client` + `passport`) — KHÔNG dùng Supabase
- DB: PostgreSQL (Replit managed) + Drizzle ORM
- Session: `express-session` + `connect-pg-simple`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (backend), Vite (frontend)

## Where things live

- DB schema: `lib/db/src/schema/` — source of truth cho tất cả bảng
- API routes: `artifacts/api-server/src/routes/`
- Frontend pages: `artifacts/ai-world-system/src/pages/`
- Shared libs: `artifacts/ai-world-system/src/lib/` (worlds, enemies, narrative)
- Battle components: `artifacts/ai-world-system/src/components/battle/`
- Auth logic: `artifacts/api-server/src/auth/replitAuth.ts`

## Architecture decisions

- Replit Auth OIDC thay vì Supabase Auth — tích hợp sẵn với Replit environment
- Server-side session lưu PostgreSQL (không dùng JWT stateless) — bảo mật hơn cho game state
- Drizzle ORM thay vì Supabase client — full control query, type-safe, không lộ DB ra FE
- Enemy generator chạy phía backend (route `/api/battle/start`) — không thể cheat stats
- 6 battle mode độc lập (component riêng) — dễ thêm mode mới mà không ảnh hưởng các mode khác

## Product

- Đăng nhập bằng tài khoản Replit
- Chọn 1 trong 3 thế giới: Tu Tiên / Cyberpunk / Vùng Hoang Phế
- Tạo nhân vật với hệ thống ngẫu nhiên (Kiếm Thần / Thương Nhân / Bất Tử / ...)
- Chiến đấu theo 6 chế độ khác nhau (Turn-Based / Real-Time / Auto / Puzzle / Narrative / Dice)
- Nhận quest, hoàn thành để lên cấp và nhận EXP
- Xem hồ sơ nhân vật, radar chart 6 chỉ số, lộ trình cảnh giới
- Bảng xếp hạng toàn server

## User preferences

- File `TIENTRINHHETHONG.md` là nguồn sự thật duy nhất về tiến trình — PHẢI đọc trước, cập nhật sau khi build
- Toàn bộ UI bằng tiếng Việt
- Aesthetic: cyber cultivation tối tăm — màu cyan/red/purple trên nền đen

## Gotchas

- Schema thay đổi → PHẢI chạy `pnpm --filter @workspace/db run push` trước khi restart API Server
- API Server cần rebuild (không hot-reload) — restart workflow sau mỗi lần sửa backend
- Frontend Vite hot-reload tự động — không cần restart
- `SESSION_SECRET` phải có trong secrets — thiếu thì auth crash
- Vite proxy `/api` → `http://localhost:8080` — đảm bảo API Server đang chạy khi dev

## Pointers

- Tiến trình build chi tiết: `TIENTRINHHETHONG.md`
- Workspace structure: `.local/skills/package-management/SKILL.md`
