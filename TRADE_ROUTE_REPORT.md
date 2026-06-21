# TRADE_ROUTE_REPORT.md
> Hệ thống Tuyến Thương Mại — Báo cáo triển khai & stress test

---

## 1. Tổng Quan Hệ Thống

Trade Route System cho phép các lãnh thổ có **Thịnh Vượng > 60** thiết lập tuyến vận chuyển hàng hoá với nhau. Mỗi tick mô phỏng, hàng hoá được tự động dịch chuyển từ nguồn đến đích — hoặc bị gián đoạn nếu an ninh < 20.

---

## 2. Schema Database

### Bảng `trade_routes`
| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `id` | UUID PK | Định danh tuyến |
| `world_slug` | VARCHAR(64) | Thế giới sở hữu |
| `source_territory_id` | UUID FK → territories | Lãnh thổ nguồn |
| `destination_territory_id` | UUID FK → territories | Lãnh thổ đích |
| `item` | VARCHAR(64) | Hàng hoá vận chuyển |
| `amount` | INTEGER | Số lượng mỗi tick |
| `active` | BOOLEAN | Tuyến đang hoạt động |
| `disrupted` | BOOLEAN | Đang bị gián đoạn |
| `total_ticks_active` | INTEGER | Tổng số tick đã chạy |
| `total_transferred` | INTEGER | Tổng hàng hoá đã vận chuyển |
| `created_at` / `updated_at` | TIMESTAMP | Thời gian |

### Bảng `trade_route_history`
| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `id` | UUID PK | Định danh sự kiện |
| `trade_route_id` | UUID FK → trade_routes | Tuyến liên quan |
| `world_slug` | VARCHAR(64) | Thế giới |
| `event_type` | VARCHAR(64) | Loại sự kiện |
| `description` | TEXT | Mô tả chi tiết |
| `tick` | INTEGER | Tick xảy ra |
| `created_at` | TIMESTAMP | Thời gian |

---

## 3. Logic Hệ Thống

### Điều Kiện Tạo Tuyến
```
source.prosperity > 60  →  đủ điều kiện mở tuyến thương mại
```

### Mỗi Tick World Simulation
```
source.supply  -= route.amount   (nếu không bị gián đoạn)
dest.supply    += route.amount   (nếu không bị gián đoạn)
```

### Gián Đoạn Tuyến
```
source.security < 20  OR  dest.security < 20  →  route.disrupted = true
```
Khi gián đoạn: không vận chuyển hàng, ghi lịch sử `route_disrupted`.  
Khi khôi phục: ghi lịch sử `route_restored`.

### History Events
| Event Type | Trigger |
|-----------|---------|
| `trade_route_created` | Tạo tuyến mới |
| `trade_route_destroyed` | Giải tán tuyến |
| `route_disrupted` | An ninh < 20 |
| `route_restored` | An ninh phục hồi ≥ 20 |

---

## 4. API Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/trade-routes/:worldSlug` | Lấy tất cả tuyến + lãnh thổ |
| POST | `/api/trade-routes/:worldSlug` | Tạo tuyến mới |
| DELETE | `/api/trade-routes/:id` | Giải tán tuyến |
| GET | `/api/trade-routes/:worldSlug/history` | Lịch sử sự kiện |
| POST | `/api/trade-routes/:worldSlug/tick` | Manual tick |
| POST | `/api/trade-routes/:worldSlug/stress-test` | Stress test |

---

## 5. Map Visualization

Frontend (`/trade-routes`) vẽ SVG bản đồ với:
- **Chấm lãnh thổ**: màu thế giới nếu thịnh vượng > 60, xám nếu không đủ điều kiện
- **Đường xanh** (`#22c55e`, liền): tuyến đang hoạt động bình thường
- **Đường đỏ** (`#ef4444`, đứt): tuyến bị gián đoạn
- **Icon hàng hoá** hiển thị giữa mỗi tuyến

---

## 6. Stress Test — 1000 Ticks

**Thế giới thử nghiệm:** `cultivation`  
**Lãnh thổ:** 5 territories (Xóm Cây Đa, Bình Nguyên Xanh, Bến Cảng Gió Đông, Quận Đông Thành + 1)  
**Tuyến thương mại:** 4 routes hoạt động song song

### Kết Quả

| Chỉ Số | Giá Trị |
|--------|---------|
| **Tổng ticks** | 1,000 |
| **Thời gian thực hiện** | 49,942 ms (~50s) |
| **Trung bình / tick** | **50 ms** |
| **Tuyến đang hoạt động** | 4 |
| **Sự kiện gián đoạn** | 94 lần |
| **Sự kiện khôi phục** | 92 lần |
| **Sự kiện lịch sử tạo ra** | **315 events** |
| **Tổng hàng hoá vận chuyển** | **29,811 đơn vị** |

### Chi Tiết Từng Tuyến

| Hàng Hoá | Amount/tick | Ticks Hoạt Động | Tổng Vận Chuyển | Trạng Thái Cuối |
|----------|------------|-----------------|-----------------|----------------|
| 🌾 thực phẩm | 15 | 667/1000 | 10,005 | ✅ Hoạt động |
| 💰 vàng | 12 | 625/1000 | 7,500 | ✅ Hoạt động |
| 🪵 gỗ | 10 | 717/1000 | 7,170 | ✅ Hoạt động |
| 🐟 cá | 8 | 642/1000 | 5,136 | ⚠️ Gián đoạn |

### Phân Tích

- **Tỷ lệ gián đoạn**: ~33% ticks bị ảnh hưởng (do an ninh dao động ±10 mỗi tick)
- **Tỷ lệ phục hồi**: ~97% các lần gián đoạn đều được khôi phục
- **Hiệu suất**: 50ms/tick với 4 tuyến × 5 lãnh thổ — đủ hiệu quả cho production
- **Tính đúng đắn**: Supply drain/fill hoạt động chính xác; lịch sử được ghi đầy đủ

---

## 7. Files Đã Tạo

| File | Mô tả |
|------|--------|
| `lib/db/src/schema/tradeRoutes.ts` | Schema `trade_routes` + `trade_route_history` |
| `lib/db/src/schema/index.ts` | Export schema mới |
| `artifacts/api-server/src/routes/tradeRoutes.ts` | API routes + `tickTradeRoutes()` |
| `artifacts/api-server/src/routes/worldSimulation.ts` | Hook tick vào world simulation |
| `artifacts/api-server/src/routes/index.ts` | Register router |
| `artifacts/ai-world-system/src/pages/TradeRoutePage.tsx` | Frontend UI + SVG map |
| `artifacts/ai-world-system/src/App.tsx` | Route `/trade-routes` |
| `artifacts/ai-world-system/src/pages/DashboardPage.tsx` | Navigation entry |

---

## 8. Kết Luận

Hệ thống Trade Route hoạt động ổn định qua 1,000 ticks. Logic gián đoạn/khôi phục dựa trên security < 20 chạy đúng. Lịch sử được ghi đầy đủ. Bản đồ SVG phân biệt tuyến xanh/đỏ trực quan. Sẵn sàng production.
