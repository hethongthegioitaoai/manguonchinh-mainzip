# UNITY_STREAM_REPORT.md
> Unity Delta Stream — Thiết kế, triển khai & benchmark băng thông

---

## 1. Vấn Đề

Unity nhận **full world state** mỗi lần poll → gửi toàn bộ territories, NPCs, factions, armies dù phần lớn không thay đổi.

**Giải pháp:** Chỉ gửi **delta events** — những thay đổi xảy ra từ tick cuối Unity đã nhận.

---

## 2. Thiết Kế Delta Stream

### Format Delta Event

```json
{
  "type":     "territory_capture",
  "tick":     142,
  "entityId": "uuid-của-lãnh-thổ",
  "changes":  { "capturedBy": "...", "previousOwner": "..." }
}
```

| Field | Mô tả |
|-------|--------|
| `type` | Loại sự kiện Unity cần xử lý |
| `tick` | Tick xảy ra trong world simulation |
| `entityId` | UUID của entity bị ảnh hưởng (NPC, territory, army, faction) |
| `changes` | Chỉ các field thay đổi — không phải toàn bộ entity |

### Các Event Type Được Hỗ Trợ

| Unity Delta Type | Nguồn từ `world_event_log` |
|-----------------|---------------------------|
| `npc_move` | `npc_migrate`, `npc_goal_changed`, `npc_birth`, `npc_death` |
| `territory_capture` | `territory_capture` |
| `territory_collapse` | `territory_collapse` |
| `territory_recolonized` | `territory_recolonized` |
| `army_move` | `army_move` |
| `army_arrived` | `army_arrived` |
| `army_siege` | `army_siege_started`, `army_siege_ended` |
| `faction_changed` | `faction_leader_changed`, `election_result`, `diplomacy_action`, `world_war_start`, `world_war_end`, `battle_result` |
| `world_tick` | `world_tick`, `route_disrupted`, `route_restored` |

---

## 3. Server: `lastTickSent`

Server giữ cursor per-client trong bộ nhớ (in-memory Map):

```
key: "${worldSlug}:${clientId}"
value: số tick cuối cùng đã gửi cho client đó
```

Unity truyền `?clientId=xxx` → server tự nhớ cursor → **Unity không cần quản lý state**.

Nếu không có `clientId`, dùng `?lastTick=N` từ client (stateless mode).

---

## 4. API Endpoints

### `GET /api/unity/delta/:worldSlug`

```
?clientId=unity-client-1   — server nhớ lastTickSent cho client này
?lastTick=0                — fallback nếu không có clientId
?limit=200                 — max events (default 200, max 1000)
```

**Response:**
```json
{
  "worldSlug":       "cultivation",
  "lastTickSent":    142,
  "previousCursor":  100,
  "count":           38,
  "events": [
    { "type": "npc_move", "tick": 101, "entityId": "uuid", "changes": { ... } },
    { "type": "territory_capture", "tick": 115, "entityId": "uuid", "changes": { ... } }
  ]
}
```

### `GET /api/unity/delta/:worldSlug/snapshot-size`

Trả về byte size của full-state snapshot (so sánh với delta).

### `POST /api/unity/delta/:worldSlug/benchmark`

Body: `{ "ticks": 1000 }` (max 5000). Yêu cầu auth.  
Trả về object so sánh đầy đủ `fullState` vs `delta`.

---

## 5. Luồng Unity

```
Unity Boot
  └─► GET /api/unity/delta/cultivation?clientId=unity-1&lastTick=0
        → nhận toàn bộ events từ tick 0
        → apply tất cả deltas vào scene

Mỗi N giây (ví dụ mỗi 2s):
  └─► GET /api/unity/delta/cultivation?clientId=unity-1
        → server tự biết lastTickSent = 142
        → chỉ trả về events tick > 142
        → Unity apply changes
```

---

## 6. Benchmark Băng Thông

### Điều Kiện Test

| Thông số | Giá Trị |
|----------|---------|
| Thế giới | `cultivation` |
| Tổng events seeded | 20,053 events |
| Tổng ticks | 5,000 |
| Avg events/tick | ~4 events |
| Avg bytes/event (delta) | **155 bytes** |
| Full-state poll interval | Mỗi 10 ticks |

---

### A. Kết Quả Đo Thực Tế (test world — 5 territories, 0 NPCs)

| Metric | 1,000 ticks | 5,000 ticks |
|--------|------------|------------|
| Full snapshot (1 lần) | **1 KB** | **1 KB** |
| Full-state polls | 100 lần | 500 lần |
| **Full-state tổng** | **115 KB** | **576 KB** |
| **Delta tổng** | **599 KB** | **2,980 KB** |
| Winner | Full-state | Full-state |

> **Lý do:** Test world có quá ít entities → snapshot chỉ 1 KB, nhỏ hơn nhiều so với delta.

---

### B. Mô Hình Hóa Theo Quy Mô World (avg 4 events/tick, 155 bytes/event)

| World Size | Snapshot | Full-state 1000t | Delta 1000t | Tiết Kiệm |
|-----------|---------|-----------------|------------|----------|
| Sparse (5 terr, 0 NPC) | 1 KB | 137 KB | 605 KB | **-343%** (full wins) |
| Small (10 terr, 50 NPC) | 13 KB | 1,312 KB | 605 KB | **+54%** ✅ delta wins |
| Medium (25 terr, 200 NPC) | 47 KB | 4,730 KB | 605 KB | **+87%** ✅ |
| Large (50 terr, 500 NPC) | 114 KB | 11,405 KB | 605 KB | **+95%** ✅ |
| Mega (100 terr, 1000 NPC) | 228 KB | 22,808 KB | 605 KB | **+97%** ✅ |

| World Size | Snapshot | Full-state 5000t | Delta 5000t | Tiết Kiệm |
|-----------|---------|-----------------|------------|----------|
| Sparse (5 terr, 0 NPC) | 1 KB | 684 KB | 3,027 KB | **-343%** (full wins) |
| Small (10 terr, 50 NPC) | 13 KB | 6,558 KB | 3,027 KB | **+54%** ✅ delta wins |
| Medium (25 terr, 200 NPC) | 47 KB | 23,652 KB | 3,027 KB | **+87%** ✅ |
| Large (50 terr, 500 NPC) | 114 KB | 57,026 KB | 3,027 KB | **+95%** ✅ |
| Mega (100 terr, 1000 NPC) | 228 KB | 114,038 KB | 3,027 KB | **+97%** ✅ |

---

### C. Ngưỡng Crossover

**Delta thắng khi snapshot > ~6 KB** (bất kể 1000 hay 5000 ticks).

Với world có ≥ 10 territories + ≥ 50 NPCs → snapshot ≥ 13 KB → delta tiết kiệm ≥ 54% băng thông.

---

### D. Event Breakdown (5000-tick window)

| Delta Type | Events | % |
|-----------|--------|---|
| `faction_changed` | 5,896 | 29.4% |
| `npc_move` | 4,762 | 23.8% |
| `army_siege` | 2,337 | 11.7% |
| `territory_collapse` | 1,228 | 6.1% |
| `territory_recolonized` | 1,212 | 6.0% |
| `territory_capture` | 1,148 | 5.7% |
| `world_tick` | 1,147 | 5.7% |
| `army_arrived` | 1,169 | 5.8% |
| `army_move` | 1,154 | 5.8% |
| **Total** | **20,053** | **100%** |

---

## 7. Files Tạo Ra

| File | Mô tả |
|------|--------|
| `artifacts/api-server/src/routes/unityDelta.ts` | Route handler: delta endpoint, snapshot-size, benchmark |
| `artifacts/api-server/src/routes/index.ts` | Đã đăng ký `unityDeltaRouter` |

---

## 8. Kết Luận

| | Full-state Polling | Delta Stream |
|--|-------------------|-------------|
| Nhỏ (< 6 KB snapshot) | ✅ Tốt hơn | ❌ Tốn hơn |
| Trung bình (> 6 KB) | ❌ Tốn băng thông | ✅ Tiết kiệm 54-87% |
| Lớn (> 50 KB) | ❌ Không khả thi | ✅ Tiết kiệm 95-97% |
| Tính deterministic | ❌ Không (overwrite state) | ✅ Có (event replay) |
| Unity phức tạp hơn | ✅ Đơn giản | ⚠️ Cần apply deltas |

**Khuyến nghị:** Dùng Delta Stream khi world có ≥ 10 territories hoặc ≥ 50 NPCs. Dưới ngưỡng đó, full-state snapshot nhỏ hơn và đơn giản hơn.

Delta Stream được tích hợp hoàn chỉnh vào `world_event_log` — không cần thêm bảng mới, không thay đổi emitter hiện có.
