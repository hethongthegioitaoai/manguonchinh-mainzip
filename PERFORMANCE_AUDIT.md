# PERFORMANCE AUDIT — AI World System Simulation
**Date:** 2026-06-21  
**Scope:** Full audit trước khi thêm feature mới — tick timing, DB growth, query plans, missing indexes, bottleneck analysis.

---

## 1. TÓM TẮT ĐIỀU HÀNH

| Metric | Kết quả |
|--------|---------|
| DB bottleneck chính | **5 bảng thiếu index** → Seq Scan khi data lớn |
| Tick time bottleneck | **Gemini API** (~500–2000ms/tick, chiếm 95%+ total) |
| Bảng tăng trưởng không giới hạn | `npc_memories`, `territory_logs`, `world_sim_log` |
| Retention đã có | `world_event_log` (100k/world — Phase 65.5) |
| Index thêm | **9 indexes mới** trên 6 bảng |

---

## 2. TICK TIMING ANALYSIS

### 2A. Thành phần thời gian mỗi tick

| Operation | Thời gian (ước tính) | Ghi chú |
|-----------|---------------------|---------|
| SELECT worldSimState | ~0.1–0.5ms | Indexed (unique) ✅ |
| SELECT worldDisasters | ~0.1–0.5ms | Nhỏ |
| SELECT worldWeather | ~0.1–0.5ms | Nhỏ |
| UPDATE worldSimState | ~0.5–2ms | Single row update |
| INSERT worldSimLog | ~0.5–2ms | 1 row/tick |
| INSERT worldEventLog (emitEvent) | ~0.5–2ms | 0–3 rows/tick |
| INSERT worldHistory | ~0.5–2ms | 0–1 row/tick (15% chance) |
| INSERT worldSnapshots | ~0.5–2ms | 1 row mỗi 50 ticks |
| SELECT territories (physics) | ~1–10ms | Scales với territory count |
| SELECT npcCores (20 NPCs) | ~1–5ms | Limited to 20/tick |
| **Gemini API call** | **~500–2000ms** | **DOMINANT — 95%+ of tick time** |
| **TOTAL per tick** | **~510–2050ms** | |

### 2B. Ước tính thời gian chạy N ticks

| Ticks | DB-only (không Gemini) | Với Gemini (avg 1200ms) | Với Gemini (worst 2000ms) |
|-------|----------------------|------------------------|--------------------------|
| 100 | ~2–5s | ~2.1 phút | ~3.5 phút |
| 500 | ~10–25s | ~10.4 phút | ~17.3 phút |
| 1000 | ~20–50s | ~20.8 phút | ~34.7 phút |
| 5000 | ~100–250s | **~1.7 giờ** | **~2.9 giờ** |

> **Kết luận:** Với GEMINI_API_KEY đang bị thiếu, tất cả Gemini calls sẽ fail ngay lập tức → mỗi tick chỉ mất ~2–50ms. 1000 ticks ≈ 20–50 giây. Đây thực ra là cơ hội tốt để benchmark "pure DB speed".

### 2C. Phân bổ theo bottleneck
```
Tick timeline (Gemini enabled):
├── DB reads         ~1–5ms   (0.5%)
├── DB writes        ~2–8ms   (0.5%)
├── Business logic   ~1–2ms   (<0.1%)
└── Gemini API      ~500–2000ms (95–99%)  ← BOTTLENECK #1
```

---

## 3. TABLE GROWTH AUDIT

### 3A. Growth Rate per Tick (per World)

| Bảng | Rows/tick | Rows/1k ticks | Rows/10k ticks | Rows/100k ticks | Retention |
|------|-----------|---------------|----------------|-----------------|-----------|
| `world_sim_log` | 1.0 | 1,000 | 10,000 | **100,000** | ❌ Không giới hạn |
| `world_event_log` | ~0.4–0.6 | ~500 | ~5,000 | ~50,000 | ✅ Cap 100k/world |
| `world_history` | ~0.15 | ~150 | ~1,500 | ~15,000 | ❌ Không giới hạn |
| `world_snapshots` | 0.02 | ~20 | ~200 | ~2,000 | ❌ (nhỏ, OK) |
| `territory_logs` | ~0.15 | ~150 | ~1,500 | ~15,000 | ❌ Không giới hạn |
| `npc_memories` | ~5–100 | ~5k–100k | ~50k–1M | **~500k–10M** | ❌ **NGUY HIỂM** |

### 3B. Dự báo sau 100k ticks (3 worlds)

| Bảng | Dự báo rows | Kích thước ước tính | Nguy cơ |
|------|------------|--------------------|---------| 
| `world_sim_log` | 300,000 | ~150MB | ⚠️ Cần retention |
| `world_event_log` | ≤300,000 | ~200MB | ✅ Có cap |
| `world_history` | ~45,000 | ~40MB | ✅ Nhỏ |
| `world_snapshots` | ~6,000 | ~500MB (JSON lớn) | ⚠️ JSON snapshots nặng |
| `territory_logs` | ~45,000 | ~20MB | ✅ Nhỏ |
| `npc_memories` | ~1.5M–30M | **~5–100GB** | 🚨 **CRITICAL — TĂNG VÔ HẠN** |

### 3C. Snapshot size warning
`world_snapshots.data` là JSON blob chứa toàn bộ territories + factions + armies. Với 50 territories + 10 factions + 20 armies, mỗi snapshot ~50–200KB. Sau 2,000 snapshots = **100–400MB chỉ riêng snapshots**.

---

## 4. QUERY PLAN ANALYSIS (EXPLAIN ANALYZE)

### 4A. Event Feed Endpoint — ✅ TỐT
```sql
SELECT * FROM world_event_log WHERE world_slug = 'cultivation' ORDER BY ts DESC LIMIT 300;
```
```
Index Scan Backward using world_event_log_world_ts_idx
  Index Cond: (world_slug = 'cultivation')
  Planning Time: 0.72ms | Execution Time: 0.06ms
```
**→ Dùng index đúng. Scale tốt.**

### 4B. Event Feed với Category Filter — ⚠️ CẦN CẢI THIỆN
```sql
SELECT * FROM world_event_log WHERE world_slug = 'cultivation' AND event IN (...10 events...) ORDER BY ts DESC LIMIT 300;
```
```
Index Scan Backward using world_event_log_world_ts_idx
  Filter: event = ANY('{...}')   ← Filter SAU index scan
  Planning Time: 61.8ms (!!) | Execution Time: 0.30ms
```
**→ Planning time cao bất thường (61ms). Cần composite index `(world_slug, event, ts)`.** ✅ Đã thêm.

### 4C. History Endpoint — ❌ SEQ SCAN
```sql
SELECT * FROM world_history WHERE world_slug = 'cultivation' ORDER BY tick DESC LIMIT 200;
```
```
Seq Scan on world_history
  Filter: (world_slug = 'cultivation')
  Sort Key: tick DESC
  Planning Time: 1.43ms | Execution Time: 0.09ms (empty table)
```
**→ Không có index. Với 100k rows: ~90–900ms/query. ✅ Đã thêm `(world_slug, tick)`.**

### 4D. Timeline Endpoint — ❌ SEQ SCAN
```sql
SELECT tick, event_type, title, created_at FROM world_history WHERE world_slug = 'cultivation' ORDER BY tick ASC LIMIT 500;
```
```
Seq Scan → Sort Key: tick
Planning Time: 1.17ms | Execution Time: 0.11ms (empty table)
```
**→ Cùng bảng `world_history`. ✅ Đã fix bằng index chung `(world_slug, tick)`.**

### 4E. Analytics Endpoint — ❌ SEQ SCAN
```sql
SELECT tick, data, created_at FROM world_snapshots WHERE world_slug = 'cultivation' ORDER BY tick ASC LIMIT 200;
```
```
Seq Scan → Sort Key: tick
Planning Time: 4.02ms | Execution Time: 0.14ms (empty table)
```
**→ Không có index. ✅ Đã thêm `(world_slug, tick)`.**

### 4F. npc_memories by character_id — ❌ SEQ SCAN
```sql
SELECT * FROM npc_memories WHERE character_id = ? ORDER BY last_interaction DESC LIMIT 20;
```
```
Seq Scan → Filter: character_id = ?
Planning Time: 2.43ms | Execution Time: 0.55ms (empty table)
```
**→ Với 1M rows: ~550ms/query. ✅ Đã thêm index `(character_id)` và `(npc_key)`.**

### 4G. territory_logs by territory_id — ❌ SEQ SCAN
```sql
SELECT * FROM territory_logs WHERE territory_id = ? ORDER BY created_at DESC LIMIT 50;
```
```
Seq Scan → Filter: territory_id = ?
```
**→ ✅ Đã thêm composite index `(territory_id, created_at)`.**

### 4H. Map State Endpoint — ✅ TỐT
```sql
SELECT * FROM world_sim_state WHERE world_slug = 'cultivation';
```
**→ Uses unique index. O(1). Scale hoàn hảo.**

---

## 5. MISSING INDEXES ĐÃ THÊM

| Bảng | Index mới | Endpoints được cải thiện |
|------|-----------|--------------------------|
| `world_history` | `(world_slug, tick)` | history, timeline |
| `world_history` | `(world_slug, event_type)` | history với filter |
| `world_snapshots` | `(world_slug, tick)` | analytics, timeline-jump |
| `world_sim_log` | `(world_slug, happened_at)` | logs endpoint |
| `world_sim_log` | `(world_slug, tick_number)` | tick lookup |
| `territory_logs` | `(territory_id, created_at)` | territory detail |
| `territories` | `(world_slug)` | territory physics |
| `territories` | `(world_slug, status)` | collapse/recolon checks |
| `npc_memories` | `(character_id)` | NPC memory queries |
| `npc_memories` | `(npc_key)` | NPC relationship lookup |
| `world_event_log` | `(world_slug, event, ts)` | category filter (66A) |

---

## 6. BOTTLENECK SUMMARY

### 🔴 Critical Bottlenecks

**1. Gemini API (tick speed)**
- **Impact:** 95–99% của tick time
- **Fix:** Implement `GEMINI_API_KEY`; hoặc thêm flag `skipAI=true` cho stress testing
- **Workaround ngay:** Khi key thiếu, server fallback về empty string — ticks chạy nhanh ~2–50ms

**2. `npc_memories` — tăng vô hạn**
- **Impact:** Có thể đạt 10M+ rows sau 100k ticks (3 worlds)
- **Fix cần làm:** Retention tương tự Phase 65.5 — giữ 1000 memories mới nhất per character

**3. `world_sim_log` — không có retention**
- **Impact:** 100k rows/world sau 100k ticks (nhỏ nhưng tăng không giới hạn)
- **Fix:** Add retention giữ 10k–50k rows mới nhất per world

### 🟡 Performance Risks

**4. Category filter planning time (61ms)**
- **Root cause:** Planner phải evaluate IN clause với 10 event names
- **Fix:** Composite index `(world_slug, event, ts)` ✅ Đã thêm

**5. `world_snapshots` JSON size**
- **Root cause:** Mỗi snapshot serialize full state ~50–200KB
- **Fix:** Giảm snapshot frequency (mỗi 100 ticks thay vì 50), hoặc compress JSON

**6. NPC heartbeat bottleneck tại 20 NPCs/tick**
- **Root cause:** Hard limit 20 NPCs/tick để giới hạn load
- **OK hiện tại:** Nhưng với 500+ NPCs/world, rotation sẽ không đảm bảo fairness

### 🟢 Đang tốt

- **`world_event_log`**: Có retention 100k/world + index đầy đủ ✅
- **`world_sim_state`**: Unique index + single row update ✅
- **Event feed query**: Index Scan, O(log n) ✅
- **Map state query**: Unique index, O(1) ✅

---

## 7. RECOMMENDED FIXES (THỨ TỰ ƯU TIÊN)

### P0 — Ngay bây giờ ✅ Done
- [x] Push 11 missing indexes lên DB
- [x] `world_event_log` retention (Phase 65.5)

### P1 — Trước 1000-tick test
- [ ] **`npc_memories` retention** — giữ 1000 rows mới nhất per character
- [ ] **`world_sim_log` retention** — giữ 50k rows mới nhất per world
- [ ] **Gemini skip flag** cho stress test — `POST /api/simulation/tick/:slug?skipAI=true`

### P2 — Trước 5000-tick test
- [ ] **Snapshot compression** hoặc giảm frequency (50 → 100 ticks)
- [ ] **`territory_logs` retention** — giữ 500 entries mới nhất per territory
- [ ] **NPC heartbeat rotation** — đảm bảo fairness với > 200 NPCs

### P3 — Scale production (100k+ ticks)
- [ ] **Read replica** cho analytics/history queries
- [ ] **Partitioning** `world_event_log` by `world_slug`
- [ ] **Archive strategy** `world_sim_log` → cold storage sau 30 ngày

---

## 8. INDEX IMPACT PREDICTION

Với 100k rows per table, estimated query time với vs không có index:

| Query | Without Index | With Index | Speedup |
|-------|--------------|------------|---------|
| history ORDER BY tick | ~100–900ms | ~1–5ms | **100–500x** |
| timeline ORDER BY tick | ~100–900ms | ~1–5ms | **100–500x** |
| analytics snapshots | ~50–500ms | ~1–3ms | **50–300x** |
| npc_memories by char | ~550ms–5s | ~0.1–1ms | **500–5000x** |
| territory_logs by id | ~100ms–1s | ~0.1–1ms | **100–1000x** |
| event feed category | ~50–500ms | ~1–5ms | **50–200x** |

---

## 9. STRESS TEST READINESS

| Test | Sẵn sàng? | Điều kiện |
|------|-----------|-----------|
| 100 ticks | ✅ Sẵn sàng | |
| 500 ticks | ✅ Sẵn sàng | |
| 1000 ticks | ⚠️ Cần P1 fixes | npc_memories retention |
| 5000 ticks | ⚠️ Cần P2 fixes | + snapshot optimization |
| WS enabled | ✅ Sẵn sàng | broadcastEvent không blocking |
| Political Map open | ✅ Sẵn sàng | Map-state query indexed |
| Analytics open | ✅ Sẵn sàng | After index push |
| Event Feed open | ✅ Sẵn sàng | All endpoints indexed |

---

*Generated by performance audit — AI World System v1.0*  
*Indexes applied: 2026-06-21 | Schema pushed to DB*
