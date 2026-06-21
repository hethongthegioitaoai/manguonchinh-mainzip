# MULTI_WORLD_REPORT — AI World System
**Date:** 2026-06-21 12:44:34  
**Duration:** 957ms  
**Worlds:** cultivation, cyberpunk, wasteland, medieval, scifi  
**Ticks/world:** 1000  
**Isolation:** ✅ PASS — Không phát hiện data leak  

---

## 1. TÓM TẮT

| Metric | Kết quả |
|--------|--------|
| Số worlds | 5 |
| Ticks/world | 1,000 |
| Total ticks | 5.000 |
| Tổng thời gian | 957ms |
| Avg tick speed | 2395 ticks/s/world |
| Data isolation | ✅ PASS |
| Anomalies | 172 |
| Issues | 0 |

## 2. KẾT QUẢ TỪNG WORLD

### Tiên Giới (`cultivation`)
> Tu Tiên — Cõi Tiên Thánh

#### Seed
| Entity | Count | Target | Status |
|--------|-------|--------|--------|
| Territories | 20 | 20 | ✅ |
| NPCs | 100 | 100 | ✅ |
| Factions | 2 | 2 | ✅ |
| Armies | 2 | 2 | ✅ |

#### Tick Performance
- Duration: **405ms**
- Speed: **2469 ticks/giây**
- Ticks completed: **1.000**

#### Final State (sau 1000 ticks)
| Metric | Value |
|--------|-------|
| Population | 16.747 |
| Economy Score | 43.7 / 100 |
| Avg Mood | 17.7 / 100 |
| Stability | 18.7 / 100 |

#### DB Events Written
| Bảng | Rows written | Isolaion check |
|------|-------------|----------------|
| world_sim_log | 3.004 | ✅ |
| world_event_log | 822 | ✅ |
| world_history | 125 | ✅ |
| world_snapshots | 30 | ✅ |
| territories | 20 | ✅ |
| npc_cores | 100 | ✅ |
| npc_factions | 2 | ✅ |
| military_forces | 2 | ✅ |

#### Isolation
✅ **PASS** — Không phát hiện cross-world data leak.

#### Anomalies
- [Tick 115] 💰 ECONOMY MAX: 100.0
- [Tick 137] 🏛️ CHÍNH PHỦ SUP ĐỔ: stability=0.0
- [Tick 216] 💰 ECONOMY MAX: 100.0
- [Tick 217] 💰 ECONOMY MAX: 100.0
- [Tick 229] 💰 ECONOMY MAX: 100.0
- [Tick 233] 💰 ECONOMY MAX: 100.0
- [Tick 618] 💰 ECONOMY MAX: 99.9
- [Tick 620] 💰 ECONOMY MAX: 99.2
- [Tick 623] 💰 ECONOMY MAX: 99.1
- [Tick 738] 💰 ECONOMY MAX: 99.2
- [Tick 739] 💰 ECONOMY MAX: 99.9
- [Tick 742] 💰 ECONOMY MAX: 100.0
- [Tick 743] 💰 ECONOMY MAX: 100.0
- [Tick 744] 💰 ECONOMY MAX: 100.0
- [Tick 746] 💰 ECONOMY MAX: 99.6
- [Tick 792] 💰 ECONOMY MAX: 100.0
- [Tick 793] 💰 ECONOMY MAX: 100.0
- [Tick 794] 💰 ECONOMY MAX: 100.0
- [Tick 795] 💰 ECONOMY MAX: 100.0
- [Tick 906] 💰 ECONOMY MAX: 100.0
- [Tick 907] 💰 ECONOMY MAX: 99.2

---

### Neon Megacity 2087 (`cyberpunk`)
> Cyberpunk — Đô Thị Neon 2087

#### Seed
| Entity | Count | Target | Status |
|--------|-------|--------|--------|
| Territories | 20 | 20 | ✅ |
| NPCs | 100 | 100 | ✅ |
| Factions | 2 | 2 | ✅ |
| Armies | 2 | 2 | ✅ |

#### Tick Performance
- Duration: **407ms**
- Speed: **2457 ticks/giây**
- Ticks completed: **1.000**

#### Final State (sau 1000 ticks)
| Metric | Value |
|--------|-------|
| Population | 18.696 |
| Economy Score | 94.5 / 100 |
| Avg Mood | 93.4 / 100 |
| Stability | 59.1 / 100 |

#### DB Events Written
| Bảng | Rows written | Isolaion check |
|------|-------------|----------------|
| world_sim_log | 3.004 | ✅ |
| world_event_log | 833 | ✅ |
| world_history | 119 | ✅ |
| world_snapshots | 30 | ✅ |
| territories | 20 | ✅ |
| npc_cores | 100 | ✅ |
| npc_factions | 2 | ✅ |
| military_forces | 2 | ✅ |

#### Isolation
✅ **PASS** — Không phát hiện cross-world data leak.

#### Anomalies
- [Tick 306] 🏛️ CHÍNH PHỦ SUP ĐỔ: stability=2.1
- [Tick 403] 💰 ECONOMY MAX: 100.0
- [Tick 404] 💰 ECONOMY MAX: 100.0
- [Tick 423] 💰 ECONOMY MAX: 100.0
- [Tick 424] 💰 ECONOMY MAX: 100.0
- [Tick 425] 💰 ECONOMY MAX: 100.0
- [Tick 428] 💰 ECONOMY MAX: 100.0
- [Tick 429] 💰 ECONOMY MAX: 100.0
- [Tick 502] 💰 ECONOMY MAX: 99.4
- [Tick 503] 💰 ECONOMY MAX: 100.0
- [Tick 505] 💰 ECONOMY MAX: 100.0
- [Tick 506] 💰 ECONOMY MAX: 100.0
- [Tick 507] 💰 ECONOMY MAX: 100.0
- [Tick 510] 💰 ECONOMY MAX: 100.0
- [Tick 511] 💰 ECONOMY MAX: 100.0
- [Tick 512] 💰 ECONOMY MAX: 100.0
- [Tick 755] 💰 ECONOMY MAX: 100.0
- [Tick 756] 💰 ECONOMY MAX: 99.9
- [Tick 834] 💰 ECONOMY MAX: 99.7
- [Tick 836] 💰 ECONOMY MAX: 99.4
- [Tick 837] 💰 ECONOMY MAX: 100.0
- [Tick 838] 💰 ECONOMY MAX: 99.9
- [Tick 839] 💰 ECONOMY MAX: 100.0
- [Tick 840] 💰 ECONOMY MAX: 99.5
- [Tick 898] 💰 ECONOMY MAX: 100.0
- [Tick 903] 💰 ECONOMY MAX: 100.0
- [Tick 918] 💰 ECONOMY MAX: 100.0
- [Tick 919] 💰 ECONOMY MAX: 100.0
- [Tick 920] 💰 ECONOMY MAX: 100.0
- [Tick 921] 💰 ECONOMY MAX: 100.0
- [Tick 923] 💰 ECONOMY MAX: 100.0
- [Tick 924] 💰 ECONOMY MAX: 100.0
- [Tick 925] 💰 ECONOMY MAX: 100.0
- [Tick 926] 💰 ECONOMY MAX: 99.5
- [Tick 928] 💰 ECONOMY MAX: 100.0
- [Tick 929] 💰 ECONOMY MAX: 100.0
- [Tick 930] 💰 ECONOMY MAX: 99.4
- [Tick 931] 💰 ECONOMY MAX: 99.4
- [Tick 994] 💰 ECONOMY MAX: 100.0

---

### Hoang Địa Tàn Thế (`wasteland`)
> Wasteland — Hậu Tận Thế Ký

#### Seed
| Entity | Count | Target | Status |
|--------|-------|--------|--------|
| Territories | 20 | 20 | ✅ |
| NPCs | 100 | 100 | ✅ |
| Factions | 2 | 2 | ✅ |
| Armies | 2 | 2 | ✅ |

#### Tick Performance
- Duration: **417ms**
- Speed: **2398 ticks/giây**
- Ticks completed: **1.000**

#### Final State (sau 1000 ticks)
| Metric | Value |
|--------|-------|
| Population | 20.457 |
| Economy Score | 55.3 / 100 |
| Avg Mood | 66.2 / 100 |
| Stability | 47.0 / 100 |

#### DB Events Written
| Bảng | Rows written | Isolaion check |
|------|-------------|----------------|
| world_sim_log | 3.001 | ✅ |
| world_event_log | 848 | ✅ |
| world_history | 130 | ✅ |
| world_snapshots | 30 | ✅ |
| territories | 20 | ✅ |
| npc_cores | 100 | ✅ |
| npc_factions | 2 | ✅ |
| military_forces | 2 | ✅ |

#### Isolation
✅ **PASS** — Không phát hiện cross-world data leak.

#### Anomalies
- [Tick 206] 💰 ECONOMY MAX: 100.0
- [Tick 252] 💰 ECONOMY MAX: 100.0
- [Tick 253] 💰 ECONOMY MAX: 99.6
- [Tick 254] 💰 ECONOMY MAX: 99.1
- [Tick 255] 💰 ECONOMY MAX: 100.0
- [Tick 260] 💰 ECONOMY MAX: 100.0
- [Tick 272] 💰 ECONOMY MAX: 100.0
- [Tick 273] 💰 ECONOMY MAX: 100.0
- [Tick 274] 💰 ECONOMY MAX: 100.0
- [Tick 454] 🏛️ CHÍNH PHỦ SUP ĐỔ: stability=5.0
- [Tick 567] 💰 ECONOMY MAX: 99.4
- [Tick 568] 💰 ECONOMY MAX: 99.2
- [Tick 578] 💰 ECONOMY MAX: 100.0
- [Tick 579] 💰 ECONOMY MAX: 100.0
- [Tick 581] 💰 ECONOMY MAX: 99.5
- [Tick 621] 💰 ECONOMY MAX: 100.0
- [Tick 622] 💰 ECONOMY MAX: 100.0
- [Tick 623] 💰 ECONOMY MAX: 100.0
- [Tick 624] 💰 ECONOMY MAX: 100.0
- [Tick 625] 💰 ECONOMY MAX: 100.0
- [Tick 626] 💰 ECONOMY MAX: 100.0
- [Tick 627] 💰 ECONOMY MAX: 99.2
- [Tick 628] 💰 ECONOMY MAX: 100.0
- [Tick 635] 💰 ECONOMY MAX: 100.0
- [Tick 637] 💰 ECONOMY MAX: 100.0
- [Tick 682] 💰 ECONOMY MAX: 99.6
- [Tick 686] 💰 ECONOMY MAX: 100.0
- [Tick 689] 💰 ECONOMY MAX: 100.0
- [Tick 690] 💰 ECONOMY MAX: 99.3
- [Tick 866] 💰 ECONOMY MAX: 99.8
- [Tick 945] 💰 ECONOMY MAX: 100.0
- [Tick 946] 💰 ECONOMY MAX: 100.0
- [Tick 947] 💰 ECONOMY MAX: 100.0

---

### Vương Triều Trung Cổ (`medieval`)
> Medieval Fantasy — Vương Triều Thần Thánh

#### Seed
| Entity | Count | Target | Status |
|--------|-------|--------|--------|
| Territories | 20 | 20 | ✅ |
| NPCs | 100 | 100 | ✅ |
| Factions | 2 | 2 | ✅ |
| Armies | 2 | 2 | ✅ |

#### Tick Performance
- Duration: **426ms**
- Speed: **2347 ticks/giây**
- Ticks completed: **1.000**

#### Final State (sau 1000 ticks)
| Metric | Value |
|--------|-------|
| Population | 18.563 |
| Economy Score | 97.1 / 100 |
| Avg Mood | 87.0 / 100 |
| Stability | 92.1 / 100 |

#### DB Events Written
| Bảng | Rows written | Isolaion check |
|------|-------------|----------------|
| world_sim_log | 3.001 | ✅ |
| world_event_log | 857 | ✅ |
| world_history | 139 | ✅ |
| world_snapshots | 30 | ✅ |
| territories | 20 | ✅ |
| npc_cores | 100 | ✅ |
| npc_factions | 2 | ✅ |
| military_forces | 2 | ✅ |

#### Isolation
✅ **PASS** — Không phát hiện cross-world data leak.

#### Anomalies
- [Tick 192] 💰 ECONOMY MAX: 100.0
- [Tick 193] 💰 ECONOMY MAX: 100.0
- [Tick 194] 💰 ECONOMY MAX: 100.0
- [Tick 195] 💰 ECONOMY MAX: 99.8
- [Tick 196] 💰 ECONOMY MAX: 99.7
- [Tick 262] 🏛️ CHÍNH PHỦ SUP ĐỔ: stability=2.0
- [Tick 351] 💰 ECONOMY MAX: 100.0
- [Tick 353] 💰 ECONOMY MAX: 100.0
- [Tick 354] 💰 ECONOMY MAX: 100.0
- [Tick 355] 💰 ECONOMY MAX: 100.0
- [Tick 359] 💰 ECONOMY MAX: 100.0
- [Tick 572] 💰 ECONOMY MAX: 100.0
- [Tick 727] 💰 ECONOMY MAX: 100.0
- [Tick 877] 💰 ECONOMY MAX: 100.0
- [Tick 878] 💰 ECONOMY MAX: 100.0
- [Tick 971] 💰 ECONOMY MAX: 100.0
- [Tick 972] 💰 ECONOMY MAX: 100.0
- [Tick 973] 💰 ECONOMY MAX: 100.0
- [Tick 974] 💰 ECONOMY MAX: 100.0
- [Tick 975] 💰 ECONOMY MAX: 100.0
- [Tick 981] 💰 ECONOMY MAX: 100.0
- [Tick 987] 💰 ECONOMY MAX: 100.0
- [Tick 988] 💰 ECONOMY MAX: 100.0
- [Tick 989] 💰 ECONOMY MAX: 100.0
- [Tick 990] 💰 ECONOMY MAX: 100.0
- [Tick 991] 💰 ECONOMY MAX: 100.0
- [Tick 994] 💰 ECONOMY MAX: 100.0

---

### Liên Bang Ngân Hà (`scifi`)
> Sci-Fi — Liên Bang Thiên Hà 3047

#### Seed
| Entity | Count | Target | Status |
|--------|-------|--------|--------|
| Territories | 20 | 20 | ✅ |
| NPCs | 100 | 100 | ✅ |
| Factions | 2 | 2 | ✅ |
| Armies | 2 | 2 | ✅ |

#### Tick Performance
- Duration: **434ms**
- Speed: **2304 ticks/giây**
- Ticks completed: **1.000**

#### Final State (sau 1000 ticks)
| Metric | Value |
|--------|-------|
| Population | 19.142 |
| Economy Score | 77.0 / 100 |
| Avg Mood | 78.2 / 100 |
| Stability | 49.3 / 100 |

#### DB Events Written
| Bảng | Rows written | Isolaion check |
|------|-------------|----------------|
| world_sim_log | 3.001 | ✅ |
| world_event_log | 841 | ✅ |
| world_history | 114 | ✅ |
| world_snapshots | 30 | ✅ |
| territories | 20 | ✅ |
| npc_cores | 100 | ✅ |
| npc_factions | 2 | ✅ |
| military_forces | 2 | ✅ |

#### Isolation
✅ **PASS** — Không phát hiện cross-world data leak.

#### Anomalies
- [Tick 176] 💰 ECONOMY MAX: 99.9
- [Tick 177] 💰 ECONOMY MAX: 100.0
- [Tick 191] 💰 ECONOMY MAX: 100.0
- [Tick 192] 💰 ECONOMY MAX: 100.0
- [Tick 197] 💰 ECONOMY MAX: 100.0
- [Tick 208] 💰 ECONOMY MAX: 100.0
- [Tick 209] 💰 ECONOMY MAX: 99.6
- [Tick 349] 💰 ECONOMY MAX: 100.0
- [Tick 366] 🏛️ CHÍNH PHỦ SUP ĐỔ: stability=0.0
- [Tick 473] 💰 ECONOMY MAX: 100.0
- [Tick 478] 💰 ECONOMY MAX: 100.0
- [Tick 494] 💰 ECONOMY MAX: 100.0
- [Tick 495] 💰 ECONOMY MAX: 100.0
- [Tick 496] 💰 ECONOMY MAX: 100.0
- [Tick 573] 💰 ECONOMY MAX: 100.0
- [Tick 574] 💰 ECONOMY MAX: 100.0
- [Tick 577] 💰 ECONOMY MAX: 100.0
- [Tick 578] 💰 ECONOMY MAX: 99.6
- [Tick 582] 💰 ECONOMY MAX: 100.0
- [Tick 584] 💰 ECONOMY MAX: 100.0
- [Tick 585] 💰 ECONOMY MAX: 100.0
- [Tick 625] 💰 ECONOMY MAX: 100.0
- [Tick 626] 💰 ECONOMY MAX: 99.2
- [Tick 627] 💰 ECONOMY MAX: 100.0
- [Tick 628] 💰 ECONOMY MAX: 100.0
- [Tick 632] 💰 ECONOMY MAX: 100.0
- [Tick 633] 💰 ECONOMY MAX: 100.0
- [Tick 635] 💰 ECONOMY MAX: 100.0
- [Tick 639] 💰 ECONOMY MAX: 99.9
- [Tick 640] 💰 ECONOMY MAX: 100.0
- [Tick 642] 💰 ECONOMY MAX: 99.6
- [Tick 643] 💰 ECONOMY MAX: 100.0
- [Tick 849] 💰 ECONOMY MAX: 100.0
- [Tick 850] 💰 ECONOMY MAX: 100.0
- [Tick 852] 💰 ECONOMY MAX: 100.0
- [Tick 853] 💰 ECONOMY MAX: 99.7
- [Tick 854] 💰 ECONOMY MAX: 100.0
- [Tick 855] 💰 ECONOMY MAX: 100.0
- [Tick 856] 💰 ECONOMY MAX: 99.8
- [Tick 857] 💰 ECONOMY MAX: 100.0
- [Tick 860] 💰 ECONOMY MAX: 100.0
- [Tick 949] 💰 ECONOMY MAX: 100.0
- [Tick 950] 💰 ECONOMY MAX: 100.0
- [Tick 951] 💰 ECONOMY MAX: 100.0
- [Tick 952] 💰 ECONOMY MAX: 100.0
- [Tick 953] 💰 ECONOMY MAX: 100.0
- [Tick 954] 💰 ECONOMY MAX: 100.0
- [Tick 955] 💰 ECONOMY MAX: 100.0
- [Tick 991] 💰 ECONOMY MAX: 99.2
- [Tick 992] 💰 ECONOMY MAX: 100.0
- [Tick 993] 💰 ECONOMY MAX: 100.0
- [Tick 994] 💰 ECONOMY MAX: 99.1

---

## 3. BẢNG SO SÁNH 5 WORLDS

| World | Pop cuối | Economy | Mood | Stability | Ticks/s | Events | Anomalies |
|-------|----------|---------|------|-----------|---------|--------|----------|
| cultivation | 16.747 | 43.7 | 17.7 | 18.7 | 2469 | 268 | 21 |
| cyberpunk | 18.696 | 94.5 | 93.4 | 59.1 | 2457 | 291 | 39 |
| wasteland | 20.457 | 55.3 | 66.2 | 47.0 | 2398 | 279 | 33 |
| medieval | 18.563 | 97.1 | 87.0 | 92.1 | 2347 | 286 | 27 |
| scifi | 19.142 | 77.0 | 78.2 | 49.3 | 2304 | 280 | 52 |

## 4. DB GROWTH

| Bảng | Trước test | Sau test | Tăng thêm |
|------|-----------|---------|----------|
| `world_sim_log` | 10.015 | 15.015 | **+5.000** |
| `world_event_log` | 2.797 | 4.201 | **+1.404** |
| `world_history` | 420 | 627 | **+207** |
| `world_snapshots` | 100 | 150 | **+50** |
| `territories` | 100 | 100 | **+0** |
| `npc_cores` | 500 | 500 | **+0** |
| `npc_factions` | 10 | 10 | **+0** |
| `military_forces` | 10 | 10 | **+0** |
| `territory_logs` | 260 | 260 | **+0** |

## 5. DATA ISOLATION MATRIX

Mỗi world's data phải nằm 100% trong phạm vi world đó (world_slug = slug của world đó).

| World | world_sim_log | world_event_log | world_history | world_snapshots | territories | npc_cores | fac | army | Status |
|-------|:-------------:|:---------------:|:-------------:|:---------------:|:-----------:|:---------:|:---:|:----:|:------:|
| `cultivation` | 3004 | 822 | 125 | 30 | 20 | 100 | 2 | 2 | ✅ |
| `cyberpunk` | 3004 | 833 | 119 | 30 | 20 | 100 | 2 | 2 | ✅ |
| `wasteland` | 3001 | 848 | 130 | 30 | 20 | 100 | 2 | 2 | ✅ |
| `medieval` | 3001 | 857 | 139 | 30 | 20 | 100 | 2 | 2 | ✅ |
| `scifi` | 3001 | 841 | 114 | 30 | 20 | 100 | 2 | 2 | ✅ |

## 6. ANOMALIES

Phát hiện **172** anomaly:

- [cultivation] [Tick 115] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 137] 🏛️ CHÍNH PHỦ SUP ĐỔ: stability=0.0
- [cultivation] [Tick 216] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 217] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 229] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 233] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 618] 💰 ECONOMY MAX: 99.9
- [cultivation] [Tick 620] 💰 ECONOMY MAX: 99.2
- [cultivation] [Tick 623] 💰 ECONOMY MAX: 99.1
- [cultivation] [Tick 738] 💰 ECONOMY MAX: 99.2
- [cultivation] [Tick 739] 💰 ECONOMY MAX: 99.9
- [cultivation] [Tick 742] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 743] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 744] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 746] 💰 ECONOMY MAX: 99.6
- [cultivation] [Tick 792] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 793] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 794] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 795] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 906] 💰 ECONOMY MAX: 100.0
- [cultivation] [Tick 907] 💰 ECONOMY MAX: 99.2
- [cyberpunk] [Tick 306] 🏛️ CHÍNH PHỦ SUP ĐỔ: stability=2.1
- [cyberpunk] [Tick 403] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 404] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 423] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 424] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 425] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 428] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 429] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 502] 💰 ECONOMY MAX: 99.4
- [cyberpunk] [Tick 503] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 505] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 506] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 507] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 510] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 511] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 512] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 755] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 756] 💰 ECONOMY MAX: 99.9
- [cyberpunk] [Tick 834] 💰 ECONOMY MAX: 99.7
- [cyberpunk] [Tick 836] 💰 ECONOMY MAX: 99.4
- [cyberpunk] [Tick 837] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 838] 💰 ECONOMY MAX: 99.9
- [cyberpunk] [Tick 839] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 840] 💰 ECONOMY MAX: 99.5
- [cyberpunk] [Tick 898] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 903] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 918] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 919] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 920] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 921] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 923] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 924] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 925] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 926] 💰 ECONOMY MAX: 99.5
- [cyberpunk] [Tick 928] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 929] 💰 ECONOMY MAX: 100.0
- [cyberpunk] [Tick 930] 💰 ECONOMY MAX: 99.4
- [cyberpunk] [Tick 931] 💰 ECONOMY MAX: 99.4
- [cyberpunk] [Tick 994] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 206] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 252] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 253] 💰 ECONOMY MAX: 99.6
- [wasteland] [Tick 254] 💰 ECONOMY MAX: 99.1
- [wasteland] [Tick 255] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 260] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 272] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 273] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 274] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 454] 🏛️ CHÍNH PHỦ SUP ĐỔ: stability=5.0
- [wasteland] [Tick 567] 💰 ECONOMY MAX: 99.4
- [wasteland] [Tick 568] 💰 ECONOMY MAX: 99.2
- [wasteland] [Tick 578] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 579] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 581] 💰 ECONOMY MAX: 99.5
- [wasteland] [Tick 621] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 622] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 623] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 624] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 625] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 626] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 627] 💰 ECONOMY MAX: 99.2
- [wasteland] [Tick 628] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 635] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 637] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 682] 💰 ECONOMY MAX: 99.6
- [wasteland] [Tick 686] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 689] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 690] 💰 ECONOMY MAX: 99.3
- [wasteland] [Tick 866] 💰 ECONOMY MAX: 99.8
- [wasteland] [Tick 945] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 946] 💰 ECONOMY MAX: 100.0
- [wasteland] [Tick 947] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 192] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 193] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 194] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 195] 💰 ECONOMY MAX: 99.8
- [medieval] [Tick 196] 💰 ECONOMY MAX: 99.7
- [medieval] [Tick 262] 🏛️ CHÍNH PHỦ SUP ĐỔ: stability=2.0
- [medieval] [Tick 351] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 353] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 354] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 355] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 359] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 572] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 727] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 877] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 878] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 971] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 972] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 973] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 974] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 975] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 981] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 987] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 988] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 989] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 990] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 991] 💰 ECONOMY MAX: 100.0
- [medieval] [Tick 994] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 176] 💰 ECONOMY MAX: 99.9
- [scifi] [Tick 177] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 191] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 192] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 197] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 208] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 209] 💰 ECONOMY MAX: 99.6
- [scifi] [Tick 349] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 366] 🏛️ CHÍNH PHỦ SUP ĐỔ: stability=0.0
- [scifi] [Tick 473] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 478] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 494] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 495] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 496] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 573] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 574] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 577] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 578] 💰 ECONOMY MAX: 99.6
- [scifi] [Tick 582] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 584] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 585] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 625] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 626] 💰 ECONOMY MAX: 99.2
- [scifi] [Tick 627] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 628] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 632] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 633] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 635] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 639] 💰 ECONOMY MAX: 99.9
- [scifi] [Tick 640] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 642] 💰 ECONOMY MAX: 99.6
- [scifi] [Tick 643] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 849] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 850] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 852] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 853] 💰 ECONOMY MAX: 99.7
- [scifi] [Tick 854] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 855] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 856] 💰 ECONOMY MAX: 99.8
- [scifi] [Tick 857] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 860] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 949] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 950] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 951] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 952] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 953] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 954] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 955] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 991] 💰 ECONOMY MAX: 99.2
- [scifi] [Tick 992] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 993] 💰 ECONOMY MAX: 100.0
- [scifi] [Tick 994] 💰 ECONOMY MAX: 99.1

## 7. TICK PERFORMANCE

```
cultivation     █████████████████████████  2469 ticks/s  405ms
cyberpunk       █████████████████████████  2457 ticks/s  407ms
wasteland       ████████████████████████░  2398 ticks/s  417ms
medieval        ████████████████████████░  2347 ticks/s  426ms
scifi           ███████████████████████░░  2304 ticks/s  434ms
```

> **Lưu ý:** Tốc độ cao nhờ in-memory simulation (không gọi Gemini AI). DB writes được batch 100 ticks/lần.

## 8. MEMORY USAGE

- Node.js heap (tại thời điểm viết report): **5 MB**
- In-memory state per world: ~**5 KB** (SimState object nhỏ)
- Peak memory (5 worlds parallel): ~**15 MB** ước tính
- Batch buffers (flush mỗi 100 ticks): max ~**500 objects** = ~**2-5 MB**

## 9. KẾT LUẬN

### ✅ Đã chứng minh được:

1. **5 worlds đồng thời** hoạt động ổn định — mỗi world có dữ liệu độc lập.
2. **Data isolation hoàn toàn** — không phát hiện cross-world data leak.
3. **1000 ticks/world** hoàn thành trong 434ms (world chậm nhất).
4. **Event stream đúng world** — world_event_log.world_slug = slug đúng.
5. **Snapshots đúng world** — world_snapshots.world_slug = slug đúng.
6. **History đúng world** — world_history.world_slug = slug đúng.

### ⚠️ Cần theo dõi:

- **172 anomalies** được phát hiện (xem mục 6).
- **npc_memories** chưa có retention — cần implement trước 10k+ tick test.
- **Gemini disabled** trong test này — performance sẽ khác khi có AI narrative.

### 📋 Next Steps:

1. Implement npc_memories retention (P1)
2. Test với Gemini enabled (real AI narrative)
3. Scale test: 5000 ticks/world
4. Load test: concurrent HTTP requests tới tick endpoints

---
*Generated by multi-world stress test script — AI World System*
