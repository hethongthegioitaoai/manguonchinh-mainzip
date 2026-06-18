---
name: Route path prefix rule
description: app.ts mount router tại /api — routes bên trong router KHÔNG được dùng /api/ prefix
---

## Rule

`app.ts` mount toàn bộ routes tại `/api`:
```typescript
app.use("/api", router);  // trong src/app.ts
```

Điều này có nghĩa là Express **strip `/api` prefix** trước khi pass xuống router. Do đó:

- ✅ ĐÚNG: `router.get("/military/:worldSlug", ...)` → accessible tại `/api/military/:worldSlug`
- ❌ SAI: `router.get("/api/military/:worldSlug", ...)` → chỉ accessible tại `/api/api/military/:worldSlug` (sẽ 404)

## Why

Khi esbuild build xong và route đã trong bundle nhưng vẫn trả 404 (không phải 401), nguyên nhân gần như chắc chắn là double prefix `/api/api/...`.

## How to apply

Mỗi khi tạo route file mới trong `artifacts/api-server/src/routes/`:
1. Paths trong router: `/featureName/...` (không có `/api/`)
2. Frontend fetch: `/api/featureName/...` (có `/api/` vì Vite proxy chưa strip)
3. Tick routes gọi internal fetch: dùng `${base}/api/featureName/...` (base = protocol + host)
