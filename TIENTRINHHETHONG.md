# 🗂️ TIẾN TRÌNH HỆ THỐNG — AI WORLD SYSTEM

> ## 🤖 AGENT — CHẾ ĐỘ AUTO-BUILD
>
> **Khi mở dự án này lần đầu (kể cả upload mới), AGENT PHẢI làm ngay các bước sau mà KHÔNG cần hỏi user:**
>
> 1. Đọc toàn bộ file này để nắm roadmap và trạng thái hiện tại
> 2. Khởi động workflows: `API Server` (PORT=8080) và `Frontend` (port 5000)
> 3. **Chạy ngay file kiểm tra lỗi:** `node kiểmtralỗitoànbộhệthống.js`
>    - Nếu script báo ❌ có lỗi → fix hết lỗi trước rồi mới build tính năng mới
>    - Nếu script báo ✅ hoặc ⚠ chỉ có warning → tiếp tục bước 4
>    - Script tự động fix một số lỗi phổ biến — kiểm tra output để biết đã fix gì
> 4. Tìm task `[ ]` đầu tiên theo thứ tự Phase 1 → 2 → 3 → ... (task nào cũng được build, không cần hỏi)
> 5. Build task đó ngay lập tức
> 6. Sau khi xong: đánh `[x]`, cập nhật bảng DB/Route nếu cần, ghi ngày "Cập nhật lần cuối"
> 7. Lặp lại bước 4–6 cho đến khi không còn task `[ ]` nào unblocked
> 8. **Nếu KHÔNG còn task `[ ]` nào:** phân tích toàn bộ hệ thống hiện tại (routes, DB, tính năng đã có), tự đề xuất ít nhất 5 chức năng mới phù hợp với vision dự án, thêm chúng vào ROADMAP dưới dạng Phase mới với task `[ ]`, rồi BUILD NGAY phase đó — KHÔNG chờ user phê duyệt.
>
> **KHÔNG hỏi user trước khi build — đây là lệnh mặc định mỗi khi load project.**

> **Cập nhật lần cuối:** 18/06/2026 — UNITY BROADCAST WIRING (Phase 53.5) hoàn tất: `broadcastUnity()` được wire vào 4 route thực tế — `npcElections.ts` (broadcast `election` event khi resolve bầu cử, kèm territory/winner/electionType); `npcPopulation.ts` (broadcast `birth` event sau mỗi NPC sinh ra, kèm npcId/name/parentName); `npcDiplomacy.ts` (broadcast `diplomacy` event sau POST /action, resolve worldSlug từ territory của govA); `worldWar.ts` (broadcast `war_start` cho cả 2 thế giới khi tuyên chiến, broadcast `war_end` cho cả 2 thế giới khi settleExpiredWars kết thúc chiến tranh). Unity client giờ nhận realtime events khi chúng thực sự xảy ra, không chỉ khi poll.

> **Cập nhật trước:** 18/06/2026 — UNITY INTEGRATION LAYER (Phase 53) hoàn tất: `GET /api/unity/world-state/:worldSlug` trả snapshot đầy đủ (NPC+emotion+state, Territory+terrain+owner, Government+army, War, ArmyMovement, PlayerAgent) dưới dạng Unity-ready DTO tối giản (id/name/pos/state/action); `GET /api/unity/world-events/:worldSlug` tổng hợp sự kiện từ worldEvents+npcBirths+elections+diplomacyMemories, hỗ trợ query `?limit=&since=`; `GET /api/unity/ws-info` trả metadata WebSocket; WebSocket `/ws/unity` broadcast realtime per-world (subscribe bằng `{type:"subscribe",worlds:[...]}`); 9 event type: npc_move/battle/election/diplomacy/birth/death/war_start/war_end/world_tick; `broadcastUnity()` export để các route khác gọi; file `lib/unityWs.ts` tách biệt khỏi notify.ts player-level.

> **Cập nhật trước:** 18/06/2026 — HỆ THỐNG BẢN ĐỒ THẾ GIỚI (Phase 52.5) hoàn tất: SVG bản đồ hex 1000×620 tương tác (pan/zoom chuột), 7 loại địa hình màu sắc riêng, hiển thị phe phái sở hữu lãnh thổ (hash màu), icon loại lãnh thổ, mini stat bars (dân số/thịnh vượng/an ninh), đường chiến tranh dashed đỏ animation, player marker cyan, di chuyển player agent qua click; thêm cột `x`/`y`/`terrain` vào `territories`, cột `current_territory_id` vào `player_agents`, bảng `army_movements`; 6 API endpoints (GET map/seed/territory detail/player move/player me/armies); trang `/world-map` đăng ký App.tsx; `WorldMapPage.tsx` 860 dòng.

> **Cập nhật trước:** 18/06/2026 — HỆ THỐNG CẢM XÚC NPC (Emotion System) hoàn tất: 2 bảng DB (`npc_emotions` — id/npc_id/happiness/anger/fear/sadness/confidence/stress 0-100; `npc_emotion_logs` — id/npc_id/emotion_type/delta/reason); tick cập nhật cảm xúc dựa trên hunger/energy/money/happiness/personality/ký ức quan trọng/quan hệ/kế hoạch; decay tự nhiên về baseline; 10 trigger sự kiện thủ công (nhận_tiền/mất_tiền/bị_phản_bội/chiến_thắng/thất_bại/kết_hôn/mất_người_thân/thăng_cấp/bị_cướp/gặp_bạn); behavior flags (aggressive/avoidsConflict/likelyToRunForLeader/likelyToExpand/workEfficiency); behavior-driven memory tự sinh; 5 endpoints (GET npc/GET world/POST tick/POST trigger/GET summary); trang `/npc-emotions` (progress bars 6 cảm xúc, trung bình thế giới, trigger UI, lịch sử log, sort theo cảm xúc cao nhất); nút Dashboard "CẢM XÚC NPC". FIX: `Smile`+`ListChecks` icon cần thêm vào import DashboardPage.tsx.

> **Cập nhật trước:** 18/06/2026 — HỆ THỐNG LẬP KẾ HOẠCH NPC (Planning Engine) hoàn tất: 2 bảng DB (`npc_plans` — id/npc_id/goal_id/current_step/status/created_at; `npc_plan_steps` — id/plan_id/step_order/action_type/target/completed); 3 trạng thái kế hoạch (đang_thực_hiện/hoàn_thành/thất_bại); 7 template kế hoạch tương ứng 7 loại mục tiêu (5–6 bước mỗi kế hoạch); auto-generate từ mục tiêu active; tick: kiểm tra điều kiện từng bước (tiền/happiness/energy), bước thất bại 3 lần→từ bỏ→tạo kế hoạch dự phòng bỏ bước đầu; milestone memory tự sinh; 5 endpoints (GET npc/GET world/POST auto-generate/POST tick/GET summary); trang `/npc-plans` (4 stat cards, progress bar tổng, card NPC mở rộng xem từng bước với màu pending/current/done); nút Dashboard "KẾ HOẠCH NPC".

> **Cập nhật trước:** 18/06/2026 — HỆ THỐNG MỤC TIÊU DÀI HẠN NPC hoàn tất: 1 bảng DB (`npc_long_term_goals` — 8 trường: id/npc_id/goal_type/target_value/progress/priority/status/created_at); 7 loại mục tiêu (làm_giàu/mua_nhà/lập_gia_đình/tham_gia_phe_phái/trở_thành_lãnh_đạo/mở_rộng_kinh_doanh/trở_thành_tướng_lĩnh); sinh mục tiêu tự động theo tính cách (greed→làm_giàu, kindness→lập_gia_đình, bravery→tướng_lĩnh)+tuổi+nghề+tài sản+quan hệ; tick tiến độ theo trạng thái NPC; milestone memory (25%/50%/75%/100%); auto-goal khi hoàn thành; 4 endpoints (GET npc/GET world/POST auto-generate/POST tick/GET summary); trang `/npc-goals` (4 stat cards, phân bố loại mục tiêu, card mở rộng từng NPC, progress bar màu theo %); nút Dashboard "MỤC TIÊU DÀI HẠN NPC". Đồng thời: FIX install lại pnpm sau reboot — cần `pnpm install` trước `pnpm --filter @workspace/db run push`.

> **Cập nhật trước:** 18/06/2026 — HỆ THỐNG QUÂN ĐỘI NPC hoàn tất: 2 bảng DB (`military_forces`+`military_memories`); quân đội gắn với từng chính phủ NPC; 7 endpoints (GET/establish/recruit/train/supply/tick/ai-decision); tuyển quân từ NPC đủ điều kiện (tuổi≥18/năng lượng≥50/không đói>70/không giữ chức đặc biệt); chính sách "Mở Rộng Quân Sự" tăng tỷ lệ tuyển; huấn luyện tốn ngân sách; tiếp tế ảnh hưởng morale+supply; AI Gemini đưa 3 quyết định chiến lược; trang `/military` (6 nút hành động, stat cards, ký ức chiến trường); nút Dashboard "QUÂN ĐỘI NPC". FIX: routes phải dùng `/military/...` không phải `/api/military/...` (router mount tại `/api`).

> **Cập nhật trước:** 18/06/2026 — NGOẠI GIAO CHÍNH PHỦ NPC hoàn tất: 3 bảng DB (`diplomatic_relations`/`diplomatic_treaties`/`diplomatic_memories`); 6 loại quan hệ (điểm -100..+100); 6 hành động ngoại giao; AI tự điều chỉnh; auto-treaty; ký ức 2 chiều; trang `/npc-diplomacy` (4 tab); nút Dashboard. Đồng thời FIX BUG đăng ký/đăng nhập: thiếu route `/api/auth/register` + `/api/auth/login` → bổ sung vào `auth.ts`.

> **Cập nhật trước:** 18/06/2026 — VŨ ĐÀI THẦN LỰC hoàn tất: 2 bảng DB (`divine_arena_matches`+`divine_arena_rankings`); 4 rule set (cultivation_duel/cyber_duel/wasteland_survival/cross_world); AI narrative sinh theo lore từng rule set; tier system 6 bậc (Đồng/Bạc/Vàng/Bạch Kim/Kim Cương/Thần); matchmaking NPC ngẫu nhiên cross-world; divinePoints tracking + auto rank recalc; 3 endpoints (GET/match/tournament); trang `/divine-arena` (tạo trận, chọn world/ruleset, giải đấu 5 trận, bảng xếp hạng); nút Dashboard "VŨ ĐÀI THẦN LỰC".

> **Cập nhật trước:** 18/06/2026 — LỄ HỘI THEO MÙA hoàn tất: 2 bảng DB (`seasonal_festivals`+`festival_participations`); 4 mùa auto-detect (Xuân/Hạ/Thu/Đông); lore lễ hội riêng cho 3 thế giới × 4 mùa = 12 templates; 3 quest/lễ hội + phần thưởng cosmetic độc quyền; bảng xếp hạng điểm; 5 endpoints (GET/create/join/complete-task/end); trang `/festival` (mùa hiện tại banner, countdown, tham gia, hoàn thành quest, leaderboard); nút Dashboard "LỄ HỘI THEO MÙA". + CARAVAN LIÊN THẾ GIỚI + THƯ VIỆN CỔ ĐẠI cũng hoàn tất trong session này.

> **Cập nhật trước:** 18/06/2026 — CARAVAN LIÊN THẾ GIỚI + THƯ VIỆN CỔ ĐẠI hoàn tất: Caravan: 2 bảng DB (`caravans`+`caravan_raids`), 4 tuyến đường liên thế giới, AI sinh hành trình, 4 endpoints (GET/dispatch/simulate/auto-dispatch), trang `/caravan` (tạo caravan, mô phỏng, lịch sử cướp bóc), nút Dashboard. Thư Viện: 2 bảng (`knowledge_entries`+`player_research`), 5 category (history/skills/items/monsters/realms), 5 rarity tier, lore seed 3 thế giới, AI generate entry, nghiên cứu nhận bonus, 4 endpoints, trang `/library` (search, filter category, rarity, nghiên cứu), nút Dashboard "THƯ VIỆN CỔ ĐẠI".

> **Cập nhật trước:** 17/06/2026 — HỆ THỐNG BẦU CỬ NPC hoàn tất: 2 bảng DB `elections`+`election_candidates`; 3 loại bầu cử (bầu_thị_trưởng/bầu_thống_đốc/bầu_lãnh_đạo_vương_quốc); điều kiện ứng cử (age≥18, happiness≥50); bỏ phiếu có trọng số (campaign_score + faction + incumbent approval bonus + random); turnout 60-90%; cập nhật lãnh đạo chính phủ sau bầu cử; ký ức NPC (đã bỏ phiếu / thắng / thua); API 4 route (GET/open/vote/resolve/auto-election); trang `/npc-elections` (summary cards / MỞ BẦU CỬ / BỎ PHIẾU / CÔNG BỐ KQ / TỰ ĐỘNG); nút Dashboard "BẦU CỬ NPC".

> **Cập nhật trước:** 17/06/2026 — HỆ THỐNG CHÍNH SÁCH CHÍNH PHỦ hoàn tất: 3 bảng DB mới (`government_policies`+`government_active_policies`+`government_policy_history`); 6 chính sách mặc định (Thuế Thấp/Thuế Cao/Trợ Cấp Lương Thực/Khuyến Khích Thương Mại/Mở Rộng Quân Sự/Đầu Tư Hạ Tầng); tích hợp world tick (áp dụng effects mỗi tick); lãnh đạo tự động quyết định theo điều kiện; API 6 route (seed/catalog/active/activate/deactivate/auto-decide/apply-tick); tab CHÍNH SÁCH trong GovCard (ĐANG HOẠT ĐỘNG / DANH MỤC / LỊCH SỬ); nút "TẠO CHÍNH SÁCH MẶC ĐỊNH" và "LÃNH ĐẠO TỰ QUYẾT ĐỊNH".

> **Cập nhật trước:** 17/06/2026 — HỆ THỐNG CHÍNH PHỦ NPC hoàn tất: 2 bảng DB `npc_governments`+`npc_government_logs`; 4 loại (village_council/city_authority/kingdom/republic); bầu lãnh đạo theo wealth+happiness; thu thuế NPC+thị trường+phe phái; tỷ lệ ủng hộ 0-100 theo thịnh vượng/an ninh/thuế/đói; kỷ niệm chính phủ; API 4 route (GET/establish/collect-taxes/update-approval); trang `/npc-government`; nút Dashboard "CHÍNH PHỦ NPC".

> **Cập nhật trước:** 17/06/2026 — HỆ THỐNG LÃNH THỔ hoàn tất: 3 bảng DB `territories`+`territory_resources`+`territory_logs`; 5 loại (village/district/city/farmland/harbor); faction sở hữu lãnh thổ; thu hoạch tài nguyên theo loại (thực phẩm/cá/vàng/công cụ/gỗ) với hệ số thịnh vượng; nhật ký lãnh thổ; API 4 route (GET/seed/claim/harvest); trang `/territories`; nút Dashboard "LÃNH THỔ".

> **Cập nhật trước:** 17/06/2026 — HỆ THỐNG HỘI NHÓM NPC hoàn tất: bảng DB `npc_factions`+`npc_faction_members`+`npc_faction_memories`; 5 loại hội nhóm (merchant_guild/farming_clan/military_order/criminal_group/noble_house); tự động thành lập từ 3+ NPC cùng nghề quan hệ>70; bầu thủ lĩnh theo wealth+influence; thu phí thành viên 5% tài sản vào quỹ; ký ức gia nhập/bầu lãnh đạo; API 3 route (GET/auto-form/collect-tribute); trang `/npc-factions`; nút Dashboard "HỘI NHÓM NPC".

> **Cập nhật trước:** 17/06/2026 — HỆ THỐNG DÂN SỐ NPC hoàn tất: thêm cột `life_stage` + `tick_count` vào `npc_cores`; bảng `npc_births`; logic già hoá mỗi 5 tick +1 tuổi trong tick route; hệ thống sinh con cho cặp đôi đủ điều kiện (trưởng thành + happiness>60 + quan hệ>75, 15% xác suất/lần); route `GET /api/npc-population/:worldSlug` + `POST /api/npc-population/run-aging/:worldSlug`; trang `/npc-population` — 3 stat card, phân bổ độ tuổi 4 giai đoạn, danh sách dân cư, nút Chạy Già Hóa & Sinh Sản, ký ức chào đời.

> **Cập nhật trước:** 17/06/2026 — HỆ THỐNG GIA ĐÌNH NPC hoàn tất: 2 bảng DB mới (`npc_family`, `npc_family_memories`); điều kiện kết đôi (friendship > 70 + happiness > 50); API CRUD 4 route (GET /api/npc-family/:npcId, POST form-partner, POST set-parent, POST auto-match/:worldSlug); tab GIA ĐÌNH thứ 5 trong NPCSimulationPage — bạn đời/cha/mẹ/con cái, ký ức gia đình, nút ghép đôi tự động.

> **Cập nhật trước:** 17/06/2026 — HỆ THỐNG CHỢ TOÀN CẦU (GLOBAL MARKET) hoàn tất: 2 bảng DB mới (`world_market`, `market_orders`), 4 hàng hóa (thực phẩm/cá/gỗ/công cụ) với giá dao động ±10%/tick dựa supply/demand; NPC đói→mua thực phẩm, thương nhân→mua thấp/bán cao, thợ thủ công→mua gỗ khi thiếu; ký ức giao dịch chợ; API `GET /api/npc-market/:worldSlug`; tab CHỢ (thứ 5) trong dashboard: 4 price card (giá hiện tại, cung/cầu bar, xu hướng ↑↓), danh sách 20 giao dịch gần nhất, mini preview ở sidebar trái; nút "CHỢ" luôn hiển thị ngay cả khi chưa chọn NPC.

> **Cập nhật trước:** 17/06/2026 — HỆ THỐNG QUAN HỆ NPC hoàn tất: bảng DB `npc_relationships` (score -100→100, 6 loại: người lạ/người quen/bạn bè/đồng minh/đối thủ/kẻ thù), logic gặp gỡ ngẫu nhiên trong mỗi tick (đánh giá lòng tốt/tham/dũng/tò mò → delta điểm), ký ức cuộc gặp lưu 2 chiều, API `GET /api/npc-relationships/:npcId`, panel QUAN HỆ 3-tab trong trang `/npc-simulation` (Trạng Thái / Quan Hệ / Bộ Nhớ) với score bar, badge 4 loại ý nghĩa, lịch sử gặp gỡ.

> **Cập nhật trước:** 17/06/2026 — Tích hợp ROADMAP TẠO THẾ GIỚI ẢO vào tầm nhìn cốt lõi + thêm Phases 41–45: [41] FREE WORLD FRAMEWORK (tạo thế giới theo chủ đề hoàn toàn tự do, AI sinh framework), [42] GOD OBSERVER DASHBOARD (Thần quan sát thế giới realtime, autonomous events), [43] LIVING WORLD ENGINE (thế giới sống đúng theo lore, NPC có cuộc đời, văn hóa, kinh tế), [44] MULTI-WORLD MANAGEMENT (nhiều thế giới/user, cổng liên kết, Tinh Vực), [45] COSMIC HIERARCHY (THẾ GIỚI→TINH VỰC→NGÂN HÀ→THIÊN HÀ→VŨ TRỤ, nền tảng VR/AR/XR).
>
> Phase 26 KINH TẾ THẾ GIỚI hoàn tất: DB `world_currencies`+`world_treasury`+`currency_exchanges`, AI sinh tên tiền tệ theo lore, sàn tỷ giá realtime, đổi tiền liên thế giới (phí 1%), tỷ giá dao động theo volume, kho bạc thế giới, thuế quan 0-30%, trang `/world-economy`. Tầm nhìn dự án được cập nhật: thế giới là đơn vị chính, 5 phases mới (Kinh Tế / Ngoại Giao / Chiến Tranh / Đa Chủ Đề / Quản Trị) thay thế phases cũ.
>
> Phase 25: ĐỒNG HÀNH hoàn tất: 9 pet × 3 thế giới, roll rarity (1% Legendary → 50% Common), triệu hồi 200 vàng cooldown 12h, cho ăn 50 vàng cooldown 4h, tiến hóa Tier 1→2→3, passive buff EXP/gold/crit/HP, trang `/pets`. Đồng thời hoàn tất security middleware 12 tầng (helmet + rate-limit + SQL/XSS guard + honeypot + UA block) kích hoạt trong API server, tạo BẢOMẬTVÀCHỐNGHACKHỆTHỐNG.JS và MÃHOÁFILECODEHỆTHỐNG.JS ở root.

---

## 🌐 TỔNG QUAN DỰ ÁN

**Tên:** AI World System

**Tầm nhìn cốt lõi:**
> **Thế giới là đơn vị chính — không phải nhân vật.**
>
> Mỗi user tạo ra **thế giới ảo riêng** với chủ đề tự chọn (Tu Tiên, Cyberpunk, Kiếm Hiệp, Space Opera, Steampunk, Medieval, Underwater, Post-Apocalypse... không giới hạn). Thế giới đó là **lãnh thổ sống** — có dân cư (người chơi khác xin nhập cảnh), kinh tế riêng (tiền tệ, kho bạc, thuế), quân đội, chính quyền, văn hóa, ngoại giao.
>
> **Các thế giới tương tác với nhau ở cấp độ vĩ mô:**
> - 🪙 **Kinh tế liên thế giới** — mỗi thế giới có đồng tiền riêng, tỷ giá dao động theo cung cầu, giao thương xuyên biên giới, thuế quan
> - ⚔️ **Chiến tranh thế giới** — thế giới tuyên chiến thế giới khác, dân của 2 bên đánh nhau, lãnh thổ/tài nguyên bị chiếm
> - 🤝 **Ngoại giao** — ký hiệp ước, liên minh phòng thủ, đại sứ quán, cấm vận
> - 🏛️ **Quản trị** — world owner đặt luật, thu thuế, bầu hội đồng, ban hành sự kiện quốc gia
> - 🎨 **Đa chủ đề** — AI sinh framework hoàn chỉnh từ bất kỳ ý tưởng nào (không bị giới hạn 3 thế giới preset)
>
> Các khái niệm thế giới thực (kinh tế học, chính trị, quân sự, ngoại giao, văn hóa) được **phóng tác theo ngôn ngữ và lore của từng thế giới ảo** — không copy y chang mà biến tấu cho phù hợp. Thế giới tồn tại và vận hành kể cả khi owner offline. Tương lai: 3D, VR, AR, XR.

> ---
> ### 🌌 ROADMAP TẠO THẾ GIỚI ẢO — TẦM NHÌN DÀI HẠN
>
> **Mục tiêu cuối cùng:** Mỗi người dùng xây dựng được **vũ trụ riêng** — từ một thế giới nhỏ phát triển lên thành tinh vực, ngân hà, thiên hà, rồi vũ trụ. Tương lai nâng cấp lên VR/AR/MR/XR.
>
> **4 trụ cột cốt lõi:**
>
> 1. 🌍 **Tự Do Sáng Tạo** — Người dùng tạo thế giới ảo theo CHỦ ĐỀ HOÀN TOÀN TỰ DO. AI tự động sinh toàn bộ framework (lore, kinh tế, ngôn ngữ, hệ thống tu luyện, đơn vị tiền tệ, tầng lớp xã hội, địa lý) theo đúng chủ đề — không bị giới hạn bởi preset.
>
> 2. 🔱 **Người Dùng = Thần** — Sau khi tạo thế giới, creator là THẦN tối cao: quan sát mọi diễn biến theo thời gian thực, thao túng vĩ mô (thiên tai, phúc lành, thần khải), nhưng KHÔNG can thiệp vi mô vào từng sinh linh (NPCs tự sống, tự quyết định). Thế giới vận hành tự động khi Thần offline.
>
> 3. 🔗 **Thế Giới Liên Thông** — Các thế giới của người dùng khác nhau trao đổi hàng hóa, ngoại giao, chiến tranh, kết minh. Mỗi thế giới là một quốc gia trong đa vũ trụ — có biên giới, hộ chiếu, thuế quan, ngôn ngữ riêng.
>
> 4. 🪐 **Phân Cấp Vũ Trụ** — Khi thế giới đủ mạnh (dân số, kinh tế, văn hóa), nó thăng cấp:
>    ```
>    THẾ GIỚI (World) → TINH VỰC (Star Domain) → NGÂN HÀ (Galaxy) → THIÊN HÀ (Universe) → VŨ TRỤ RIÊNG (Personal Cosmos)
>    ```
>    Mỗi cấp mở ra quy mô tương tác lớn hơn, nhiều thế giới con hơn, tài nguyên vũ trụ phong phú hơn.

**Stack thực tế:**
- Frontend: React 19 + Vite 7 + TypeScript + Tailwind CSS v4 + Framer Motion + Wouter + shadcn/ui
- Backend: Express 5 (Node.js 24) — port 8080
- Database: PostgreSQL + Drizzle ORM (`DATABASE_URL` secret, Replit managed)
- Auth: **Replit Auth** (OIDC — `openid-client` + `passport`) — KHÔNG dùng Supabase
- AI: **Gemini 2.0 Flash Lite** (`@google/generative-ai`, key `GEMINI_API_KEY`)
- Session: `express-session` + `connect-pg-simple` (bảng `sessions`)
- Monorepo: pnpm workspaces

**Cấu trúc thư mục:**
```
artifacts/
  ai-world-system/   ← Frontend React (port 5000 / webview)
  api-server/        ← Backend Express (port 8080)
lib/
  db/                ← Schema Drizzle + DB client
  api-spec/          ← OpenAPI spec + Orval codegen
  api-zod/           ← Zod schemas (generated)
  api-client-react/  ← React hooks (generated)
```

---

## 🗺️ MASTER ROADMAP

> Agent: tìm `[ ]` đầu tiên theo thứ tự Phase và build. KHÔNG hỏi user.
>
> **Triết lý roadmap:** Phase 1–25 xây nền tảng nhân vật. Phase 26+ xây hệ thống LIÊN THẾ GIỚI — thế giới là đơn vị chính, mọi tính năng mới phải phản ánh tương tác giữa các thế giới.

### ════════════════════════════════════════
### PHASE 1 — FOUNDATION MVP ✅
### ════════════════════════════════════════

- [x] Login (Replit Auth OIDC)
- [x] Session (PostgreSQL)
- [x] Profile (`/settings`)
- [x] Tạo nhân vật
- [x] Chọn thế giới
- [x] Chỉ số cơ bản (6 stats)
- [x] Level + EXP system
- [x] Inventory (`/inventory`)
- [x] Quest system (`/play`)
- [x] Battle (6 modes, `/battle`)
- [x] Leaderboard (`/leaderboard`)
- [x] Cultivation World (Tu Tiên)
- [x] Cyberpunk World
- [x] Wasteland World (Hoang Phế)

---

### ════════════════════════════════════════
### PHASE 2 — SYSTEM ENGINE ✅
### ════════════════════════════════════════

- [x] Kiếm Thần Hệ Thống
- [x] Luyện Đan Hệ Thống (Alchemy)
- [x] Thương Nhân Hệ Thống (Merchant)
- [x] Triệu Hồi Hệ Thống (Summoner)
- [x] Thần Thú Hệ Thống (Beast Taming)
- [x] Tử Linh Hệ Thống (Necromancer)
- [x] Random khi tạo nhân vật (roulette animation)
- [x] System bonus áp dụng vào battle + narrative
- [x] Level + EXP (100 EXP/level)
- [x] Inventory + Equip
- [x] Skills — bảng DB `character_skills`, mỗi system có skill tree riêng
- [x] Factions — bảng DB `factions`, `character_faction`

---

### ════════════════════════════════════════
### PHASE 3 — MEMORY ENGINE ✅
### ════════════════════════════════════════

- [x] Bảng DB `character_memories`
- [x] Tự động lưu memory sau mỗi AI narrative
- [x] API GET /api/memories/:characterId + DELETE /api/memories/:id
- [x] Bảng DB `npc_memories`
- [x] Bảng DB `world_memories`
- [x] Tự động lưu world event khi story chứa từ khóa lớn
- [x] API GET /api/world-memories/:worldSlug
- [x] Feed top 5 memories vào Gemini prompt
- [x] Trang `/memories` — xem ký ức cá nhân + lịch sử thế giới

---

### ════════════════════════════════════════
### PHASE 4 — PERSISTENT WORLD ✅
### ════════════════════════════════════════

- [x] Bảng DB `world_state` — key-value store
- [x] Boss state: alive/dead, respawn timer 24h
- [x] Bảng DB `world_resources` — regen theo giờ
- [x] API GET /api/world/state/:worldSlug
- [x] API POST /api/world/resources/:worldSlug/harvest
- [x] API POST /api/world/boss/:worldSlug/:bossKey/kill
- [x] Tích hợp vào `/play`
- [x] Trang `/world/:slug/state` — dashboard boss + resource + countdown
- [x] Item price fluctuate — bảng `market_prices`
- [x] Market API

---

### ════════════════════════════════════════
### PHASE 5 — AI NARRATIVE ENGINE ✅
### ════════════════════════════════════════

- [x] AI (Gemini) sinh story node theo context nhân vật + world
- [x] 3 lựa chọn per node, expGain + tag
- [x] Fallback về static tree khi AI lỗi
- [x] Feed character memory + world state vào prompt
- [x] Input text tự do trong `/play`
- [x] AI phản hồi theo freeInput, +25 EXP mỗi lần gửi
- [x] Toggle "Chọn" (3 buttons) và "Tự Do" (textarea)

---

### ════════════════════════════════════════
### PHASE 6 — AI GAME MASTER ✅
### ════════════════════════════════════════

- [x] Bảng DB `world_events`
- [x] AI tự sinh sự kiện định kỳ (Gemini 2.0 Flash Lite)
- [x] Banner sự kiện trên Dashboard
- [x] API POST /api/admin/event/trigger
- [x] World karma score
- [x] `/admin` route — population, avg level, active events, karma per world

---

### ════════════════════════════════════════
### PHASE 7 — MULTI AGENT NPC ✅
### ════════════════════════════════════════

- [x] Bảng DB `npcs`
- [x] Agent loop: admin tick AI chạy 1 turn cho mỗi NPC
- [x] NPC goals: kiếm tiền / bảo vệ làng / cướp bóc / ám sát / hiền giả
- [x] NPC interaction: hội thoại tự do với AI
- [x] 7 loại NPC, seed 3 NPC per world tự động

---

### ════════════════════════════════════════
### PHASE 8 — WORLD CREATOR ✅
### ════════════════════════════════════════

- [x] Form tạo thế giới: tên, thể loại, luật, mô tả
- [x] AI nhận input → sinh lịch sử, NPC gốc, Boss đầu, phe phái
- [x] World được lưu vào DB, người khác có thể vào chơi

---

### ════════════════════════════════════════
### PHASE 9 — AI WORLD GENERATOR ✅
### ════════════════════════════════════════

- [x] AI generate World #XXXXX với lore/NPC/Quest/Boss/Dungeon/Items đầy đủ
- [x] World discovery feed — người chơi browse các AI-generated worlds

---

### ════════════════════════════════════════
### PHASE 10 — MULTIVERSE ✅
### ════════════════════════════════════════

- [x] Cross-world events (World War, Portal Events)
- [x] Nhân vật có thể di chuyển giữa các thế giới
- [x] World merge events

---

### ════════════════════════════════════════
### PHASE 11 — ACHIEVEMENT SYSTEM ✅
### ════════════════════════════════════════

**Mục tiêu:** Người chơi có mục tiêu dài hạn — mở khóa thành tựu, flex với bạn bè.

- [x] Bảng DB `achievements` (key, title, desc, icon, category, xpReward, condition)
- [x] Bảng DB `character_achievements` (characterId, achievementKey, unlockedAt)
- [x] Seed 30 thành tựu theo 5 danh mục: Chiến Đấu / Tu Luyện / Khám Phá / Xã Hội / Bí Ẩn
- [x] API GET /api/achievements/:characterId — trả về tất cả + trạng thái unlocked
- [x] API POST /api/achievements/check/:characterId — auto-check + unlock ngay
- [x] Trigger check sau: battle win, pvp win, quest complete, level up, harvest
- [x] Trang `/achievements` — grid thành tựu, badge đã mở, tiến độ, EXP nhận được
- [x] Nút Dashboard "THÀNH TỰU"

---

### ════════════════════════════════════════
### PHASE 12 — DAILY REWARDS
### ════════════════════════════════════════

**Mục tiêu:** Người chơi quay lại mỗi ngày để nhận thưởng.

- [x] Bảng DB `daily_logins` (userId, loginDate, streak, rewardClaimed)
- [x] Daily reward theo streak: ngày 1=50 EXP, 2=100 EXP, 3=150 EXP, 4=200 EXP, 5=item thường, 6=300 EXP, 7=item hiếm
- [x] API POST /api/daily/claim — nhận thưởng hôm nay, tính streak
- [x] API GET /api/daily/status — xem streak hiện tại + phần thưởng hôm nay
- [x] Trang `/daily` — lịch 7 ngày, xem streak, nút claim
- [x] Nút Dashboard "ĐIỂM DANH"

---

### ════════════════════════════════════════
### PHASE 13 — DUNGEON SYSTEM
### ════════════════════════════════════════

**Mục tiêu:** Thách thức nhiều tầng liên tiếp, HP không hồi giữa các tầng.

- [x] Bảng DB `dungeons` (id, worldSlug, name, floors, minLevel, description)
- [x] Bảng DB `dungeon_runs` (id, characterId, dungeonId, floor, status, loot, createdAt)
- [x] Seed 9 dungeon (3 per world: dễ/vừa/khó, 5–10 tầng)
- [x] API POST /api/dungeon/start/:dungeonId — bắt đầu run, lưu HP hiện tại
- [x] API POST /api/dungeon/advance — chiến tầng tiếp, HP giảm tích lũy
- [x] Loot system: mỗi tầng drop item ngẫu nhiên theo tier (common→epic)
- [x] API GET /api/dungeon/list/:worldSlug + /api/dungeon/active + /api/dungeon/history/:characterId
- [x] Trang `/dungeon` — chọn dungeon, xem tầng, chiến đấu multi-floor, lịch sử
- [x] Nút Dashboard "NGỤC TỐI"

---

### ════════════════════════════════════════
### PHASE 14 — CRAFTING SYSTEM
### ════════════════════════════════════════

**Mục tiêu:** Người chơi kết hợp vật phẩm để tạo đồ mạnh hơn.

- [x] Bảng DB `recipes` (id, name, worldSlug, materials jsonb, resultItem, resultRarity, requiredLevel)
- [x] Seed 7–8 recipe per world (weapon/armor/accessory/consumable/special × basic/mid/high)
- [x] API GET /api/craft/recipes/:worldSlug — trả về availability dựa trên inventory
- [x] API POST /api/craft/make — kiểm tra materials trong inventory, tạo item mới, +EXP
- [x] Trang `/craft` — xem recipes theo category, filter, nút craft
- [x] Nút Dashboard "CHẾ TẠO"

---

### ════════════════════════════════════════
### PHASE 15 — CLAN WAR ✅
### ════════════════════════════════════════

**Mục tiêu:** Bang hội thách đấu bang hội khác, điểm từ PvP thành viên.

- [x] Bảng DB `clan_wars` (id, guildId1, guildId2, startAt, endAt, score1, score2, active, winnerId)
- [x] API POST /api/guild-war/declare/:targetGuildId — guild leader khai chiến
- [x] API GET /api/guild-war/status — xem chiến tranh đang diễn ra + lịch sử + danh sách bang
- [x] Auto-end sau 24h, tính tổng điểm, xác định kẻ thắng (trigger khi GET status)
- [x] PvP thành viên 2 bang tự động cộng điểm qua `addPvpScoreToWar()`
- [x] Trang `/guild-war` — tuyên chiến, bảng điểm realtime, lịch sử
- [x] Reward: bang thắng nhận +50 uy tín phe phái cho tất cả thành viên
- [x] Nút Dashboard "CHIẾN TRANH BANG"

---

### ════════════════════════════════════════
### PHASE 16 — SOCIAL FEED (DÒNG THỜI GIAN) ✅
### ════════════════════════════════════════

**Mục tiêu:** Người chơi chia sẻ khoảnh khắc hành trình — toàn server thấy, like, react.

- [x] Bảng DB `story_posts` (id, characterId, userId, worldSlug, authorName, authorSystem, authorLevel, content, postType, metadata, likes, createdAt)
- [x] Bảng DB `post_likes` (id, postId, userId, createdAt)
- [x] API GET /api/feed — lấy tất cả posts, filter theo world, phân trang
- [x] API POST /api/feed — đăng bài thủ công (manual)
- [x] API POST /api/feed/auto — auto-post từ sự kiện game (battle/quest/achievement/dungeon/levelup)
- [x] API POST /api/feed/:postId/like — like / unlike toggle
- [x] API DELETE /api/feed/:postId — xoá bài của mình
- [x] 8 loại postType: manual/battle/quest/achievement/dungeon/levelup/pvp/craft
- [x] Trang `/feed` — compose box, filter theo world, timeline, like, xoá, load more
- [x] Nút Dashboard "DÒNG THỜI GIAN"

---

### ════════════════════════════════════════
### PHASE 17 — GOD MODE (THẦN CHỦ HỆ THỐNG) ✅
### ════════════════════════════════════════

**Mục tiêu:** User là Thần của thế giới họ tạo — can thiệp trực tiếp, NPC thờ phụng creator.

- [x] Bảng DB `divine_actions` (id, worldSlug, creatorUserId, actionType, targetNpcId, content, aiEffect, createdAt)
- [x] Bảng DB `npc_prayers` (id, npcId, worldSlug, prayerContent, answered, answerContent, answeredAt, createdAt)
- [x] API GET /api/god/my-worlds — danh sách thế giới user đã tạo
- [x] API GET /api/god/world/:worldSlug — NPC + prayers + recentActions
- [x] API POST /api/god/prayers/generate/:worldSlug — AI sinh prayers từ NPC
- [x] API POST /api/god/intervene/:worldSlug — Thần gửi thần khải (AI sinh hiệu ứng + tạo world event)
- [x] API POST /api/god/bless/:npcId — ban phước cho NPC (buff stats 24h)
- [x] API POST /api/god/smite/:npcId — trừng phạt NPC (debuff 12h hoặc khai trừ vĩnh viễn)
- [x] API POST /api/god/answer-prayer/:prayerId — Thần đáp lại lời cầu nguyện
- [x] Trang `/god` — chọn thế giới; `/god/:worldSlug` — bảng điều khiển Thần (3 tab: NPC / Cầu Nguyện / Thần Sử)
- [x] Nút Dashboard "CHẾ ĐỘ THẦN"

---

### ════════════════════════════════════════
### PHASE 18 — INTER-WORLD TRADE (GIAO THƯƠNG LIÊN THẾ GIỚI) ✅
### ════════════════════════════════════════

**Mục tiêu:** Các thế giới của các user khác nhau trao đổi item qua "Cổng Thương Mại".

- [x] Bảng DB `world_trade_listings` (id, sellerCharacterId, fromWorldSlug, toWorldSlug, itemId, quantity, priceGold, expiresAt, status)
- [x] Bảng DB `world_trade_history` (id, listingId, buyerCharacterId, renamedItemName, soldAt, priceGold)
- [x] API GET /api/world-trade — danh sách listing active, filter theo world
- [x] API GET /api/world-trade/my-chars — nhân vật + gold + inventory của user
- [x] API GET /api/world-trade/history — lịch sử giao dịch toàn server
- [x] API POST /api/world-trade/list — đăng bán item (trừ inventory, hết hạn 48h)
- [x] API POST /api/world-trade/:listingId/buy — mua item cross-world (phí cổng 5%)
- [x] API DELETE /api/world-trade/:listingId/cancel — huỷ listing + hoàn item
- [x] Hiệu ứng Rào Cản Thế Giới — AI rename item khi mua cross-world
- [x] Trang `/world-trade` — CHỢ (filter + mua), ĐĂng BÁN (chọn char/item/qty/price), LỊCH SỬ
- [x] Nút Dashboard "GIAO THƯƠNG LIÊN THẾ GIỚI"

---

### ════════════════════════════════════════
### PHASE 19 — WORLD PASSPORT (HỘ CHIẾU DU HÀNH) ✅
### ════════════════════════════════════════

**Mục tiêu:** Nhân vật có "hộ chiếu" du hành — vào thế giới người khác với identity riêng, creator kiểm soát ai được vào.

- [x] Bảng DB `world_passports` (id, characterId, worldSlug, status, requestNote, creatorNote, entryCount, bannedAt, approvedAt, createdAt)
- [x] Bảng DB `world_entry_log` (id, characterId, worldSlug, enteredAt, leftAt, reason)
- [x] API GET /api/passport/worlds — danh sách custom worlds public (không phải của mình)
- [x] API GET /api/passport/my — tất cả hộ chiếu của user (enriched với world + char)
- [x] API GET /api/passport/visitors/:worldSlug — creator xem khách trong thế giới
- [x] API POST /api/passport/request/:worldSlug — xin nhập cảnh + lời xin tuỳ chọn
- [x] API POST /api/passport/approve/:passportId — creator phê duyệt
- [x] API POST /api/passport/ban/:passportId — creator ban/kick + ghi lý do
- [x] API GET /api/passport/visit/:worldSlug — xem thế giới qua mắt khách (AI welcome narrative, readonly)
- [x] Trang `/passport` — KHÁM PHÁ, HỘ CHIẾU CỦA TÔI, QUẢN LÝ KHÁCH (3 tab)
- [x] Nút Dashboard "HỘ CHIẾU DU HÀNH"

---

### ════════════════════════════════════════
### PHASE 22 — FATE SYSTEM (MỆNH SỐ & VẬN MỆNH) ✅
### ════════════════════════════════════════

**Mục tiêu:** Mỗi nhân vật có Mệnh Số riêng (1-9) do hệ thống tính từ tên + level + ngày tạo. Mệnh Số quyết định xác suất Cát/Hung khi kích hoạt Mệnh Cục. AI sinh mô tả sự kiện + giải quẻ Thiên Cơ.

- [x] Bảng DB `fate_events` (id, characterId, fateNumber, eventType: cat/hung/trung_binh, title, description, effect jsonb, duration, active, expiresAt)
- [x] Bảng DB `fate_readings` (id, characterId, fateNumber, hexagram, hexagramName, reading, advice, luckyElement)
- [x] Tính Mệnh Số từ tên + level + ngày tạo (1–9, loại số học)
- [x] 8 quẻ Bát Quái (☰☱☲☳☴☵☶☷) gắn với Mệnh Số + Ngũ Hành
- [x] Weights Cát/Hung khác nhau theo từng Mệnh Số (Mệnh 3 phúc nhiều, Mệnh 7 hung nhiều)
- [x] 13 template event Cát (5), Hung (5), Bình (3) với effect thực tế (EXP bonus/penalty, gold, crit%, drop%)
- [x] Apply immediate effect ngay khi trigger (EXP/gold cộng/trừ thực sự)
- [x] API GET /api/fate/char/:characterId — Mệnh Số + active events + last reading + history
- [x] API GET /api/fate/my-chars — nhân vật của user
- [x] API POST /api/fate/trigger/:characterId — kích hoạt Mệnh Cục (cooldown 1h, AI sinh description)
- [x] API POST /api/fate/consult/:characterId — giải quẻ AI Thiên Cơ Tiên (cooldown 2h)
- [x] Trang `/fate` — hexagram visual xoay, Mệnh Số card, active events, lịch sử
- [x] Nút Dashboard "MỆNH SỐ & VẬN MỆNH"

---

### PHASE 21 — ISEKAI PORTAL (CỔNG XUYÊN KHÔNG) ✅
### ════════════════════════════════════════

**Mục tiêu:** Người chơi kích hoạt cổng xuyên không — bị cuốn ngẫu nhiên vào thế giới khác, AI sinh tên mới + cảnh mở đầu cinematic + System grant thiên phú đặc biệt.

- [x] Bảng DB `isekai_records` (id, userId, fromCharacterId, fromWorldSlug, toWorldSlug, isekaiName, isekaiClass, openingNarrative, systemGrant, systemAbility, worldReaction, metadata jsonb)
- [x] API GET /api/isekai/worlds — nhân vật của user (nguồn xuyên không)
- [x] API GET /api/isekai/my — lịch sử xuyên không
- [x] API GET /api/isekai/record/:id — chi tiết 1 record
- [x] API POST /api/isekai/enter — kích hoạt cổng: random thế giới đích (builtin + custom public), AI sinh identity mới + narrative + system grant + thiên phú
- [x] Pool đích: 3 builtin worlds + tất cả customWorlds public của người khác (loại trừ world hiện tại)
- [x] AI sinh isekaiName phù hợp văn hóa thế giới đích
- [x] AI sinh openingNarrative 4-5 câu cinematic (cảnh bị hút vào cổng, tỉnh dậy, phản ứng xung quanh)
- [x] AI sinh systemGrant (thông báo System kiểu isekai anime) + systemAbility (1 thiên phú đặc biệt)
- [x] Tạo world_event "⚡ Dị Khách Xuyên Không" ở thế giới đích khi có người isekai đến
- [x] Trang `/isekai` — portal visual xoay 360°, chọn nhân vật, kích hoạt, hiển thị result card + history accordion
- [x] Nút Dashboard "CỔNG XUYÊN KHÔNG" tag "ISEKAI"

---

### PHASE 20 — DIVINE PROPHECY & ORACLE (THẦN KHẢI & TIÊN TRI) ✅
### ════════════════════════════════════════

**Mục tiêu:** AI sinh ra "thần khải" định kỳ cho từng thế giới — dự báo sự kiện lớn, người chơi giải mã lời tiên tri để nhận thưởng.

- [x] Bảng DB `prophecies` (id, worldSlug, content, hiddenCondition, clue, reward jsonb, isActive, fulfilledAt, fulfilledBy, generatedAt)
- [x] Bảng DB `prophecy_claims` (id, prophecyId, characterId, proof, score, status, judgedAt, claimedAt)
- [x] AI (Gemini) sinh prophecy dạng thơ/ẩn dụ + hiddenCondition + clue khi creator trigger
- [x] API GET /api/prophecy/:worldSlug — active tiên tri + lịch sử đã ứng nghiệm
- [x] API POST /api/prophecy/generate/:worldSlug — creator (hoặc bất kỳ user) triệu Oracle
- [x] API POST /api/prophecy/claim/:prophecyId — submit claim + AI chấm 0-100
- [x] Auto-approve ≥80 → trao reward ngay (EXP, gold, title) + mark fulfilled
- [x] API GET /api/prophecy/claims/:prophecyId — creator xem tất cả claims
- [x] API POST /api/prophecy/judge/:claimId — creator approve/reject thủ công
- [x] Reward: +800 EXP, +300 vàng, title "Kẻ Giải Mã Tiên Tri"
- [x] Trang `/prophecy` — sidebar world list, panel tiên tri active, clue, submit claim, lịch sử fulfilled
- [x] Nút Dashboard "THẦN KHẢI & TIÊN TRI"

---

### ════════════════════════════════════════
### PHASE 23 — NHÀ ĐẤU GIÁ ✅
### ════════════════════════════════════════

**Mục tiêu:** Người chơi đưa vật phẩm hiếm lên đấu giá — ai trả cao nhất sau X giờ thắng. Tạo nền kinh tế sôi động, vật phẩm epic có giá trị thật.

- [x] Bảng DB `auction_listings` (sellerCharId, itemId, itemName, itemIcon, itemRarity, worldSlug, startBid, currentBid, currentBidderId, buyoutPrice, quantity, status, expiresAt)
- [x] Bảng DB `auction_bids` (auctionId, bidderCharId, bidAmount, bidAt)
- [x] API GET /api/auction/list — danh sách active, auto-settle expired khi GET
- [x] API GET /api/auction/my — listings + bids của tôi
- [x] API GET /api/auction/my-chars — nhân vật + inventory
- [x] API POST /api/auction/list-item — đăng vật phẩm, trừ inventory ngay
- [x] API POST /api/auction/:id/bid — đặt giá (trừ vàng, hoàn vàng người thua trước)
- [x] API POST /api/auction/:id/buyout — mua ngay theo giá cố định
- [x] API DELETE /api/auction/:id/cancel — huỷ nếu chưa có bid
- [x] Auto-settle: hết hạn → chuyển item cho người thắng + trả item về seller nếu không có bid
- [x] Trang `/auction` — CHỢ ĐẤU GIÁ (đặt giá/mua ngay), ĐĂNG BÁN, CỦA TÔI (3 tab)
- [x] Nút Dashboard "NHÀ ĐẤU GIÁ" tag "NEW"

---

### ════════════════════════════════════════
### PHASE 24 — HỆ THỐNG DANH HIỆU ✅
### ════════════════════════════════════════

**Mục tiêu:** Nhân vật tích lũy danh hiệu từ thành tựu/sự kiện/boss kill. Danh hiệu hiển thị trên profile + leaderboard — flex với cộng đồng.

- [x] Bảng DB `character_titles` (characterId, titleKey, equipped, unlockedAt)
- [x] 17 danh hiệu hardcoded theo 5 tier: Máu Đầu Tiên / Chiến Thần / Bá Chủ Ngục Tối / Tiên Tri Ứng Nghiệm / Huyền Thoại (legendary) / ...
- [x] API GET /api/titles/:characterId — auto-check điều kiện + auto-grant danh hiệu mới + trả danh hiệu đã có
- [x] API POST /api/titles/equip/:characterId — trang bị danh hiệu (unequip all others)
- [x] API POST /api/titles/unequip/:characterId — gỡ danh hiệu đang đeo
- [x] Auto-unlock dựa trên: battle wins, dungeon clears (hard), level, gold, prophecy claims, isekai, auction listings, guild leadership, world trades, fate readings, world passport
- [x] Toast notification khi nhận danh hiệu mới
- [x] Trang `/titles` — grid 2 col, filter all/unlocked/locked, banner danh hiệu đang trang bị, rarity color
- [x] Nút Dashboard "DANH HIỆU" tag "NEW"

---

### ════════════════════════════════════════
### PHASE 25 — ĐỒNG HÀNH (PET SYSTEM) ✅
### ════════════════════════════════════════

**Mục tiêu:** Nhân vật có thú cưỡi/linh thú/robot đồng hành — passive buff chiến đấu, có thể tiến hóa qua EXP pet.

- [x] Bảng DB `pets` (characterId, name, species, icon, worldSlug, rarity, tier, level, exp, bondLevel, skills jsonb, isActive, lastFedAt, lastSummonedAt)
- [x] 9 loại pet × 3 thế giới: Tu Tiên (Linh Hổ🐯/Rồng Con🐲/Phượng Hoàng🦅), Cyberpunk (Combat Drone🚁/Mech Dog🤖/Nano Spider🕷️), Hoang Phế (Mutant Wolf🐺/Scavenger Bird🦜/Toxic Slug🐛)
- [x] Roll rarity: 1% Legendary / 4% Epic / 15% Rare / 30% Uncommon / 50% Common (tỷ lệ có thật)
- [x] API POST /api/pets/summon — 200 vàng, cooldown 12h, roll rarity + species ngẫu nhiên
- [x] API GET /api/pets/my/:characterId — pets của nhân vật
- [x] API POST /api/pets/:id/feed — 50 vàng/lần, cooldown 4h, +bond +exp, tiến hóa tier 1→2→3
- [x] API POST /api/pets/:id/equip — kích hoạt 1 pet duy nhất (deactivate all others)
- [x] API POST /api/pets/:id/unequip — tắt pet active
- [x] Passive buff khi có pet active: +expBonus% EXP, +goldBonus% Vàng, +critBonus% Crit, +hpBonus% HP (scale theo rarity × tier)
- [x] Pet tiến hóa tại level 20 (Tier 2) và 30 (Tier 3) — tăng buff đáng kể
- [x] Trang `/pets` — 2 tab: ĐỒNG HÀNH (grid, bond bar, kích hoạt/cho ăn) + TRIỆU HỒI (bảng tỷ lệ, preview)
- [x] Nút Dashboard "ĐỒNG HÀNH" tag "NEW"

---

### ════════════════════════════════════════
### PHASE 26 — KINH TẾ THẾ GIỚI (WORLD ECONOMY) ✅
### ════════════════════════════════════════

**Mục tiêu:** Mỗi thế giới có **đồng tiền riêng** do AI đặt tên theo lore (VD: Tu Tiên → "Linh Thạch", Cyberpunk → "NeuroCoin"). World owner quản lý kho bạc, đặt thuế suất. Dân có thể đổi tiền qua sàn liên thế giới — tỷ giá dao động theo khối lượng giao dịch thực.

- [x] Bảng DB `world_currencies` (worldSlug, currencyName, currencySymbol, exchangeRateToGold, totalSupply, reserveGold, createdAt)
- [x] Bảng DB `world_treasury` (worldSlug, balance, taxRate, totalRevenue, totalExpenditure, lastUpdated)
- [x] Bảng DB `currency_exchanges` (fromWorld, toWorld, fromAmount, toAmount, rate, executedByCharId, executedAt)
- [x] AI sinh tên tiền tệ + biểu tượng theo lore thế giới khi world được tạo (hoặc retroactive)
- [x] Tỷ giá tự động dao động: mỗi giao dịch lớn tác động ±2-5% tỷ giá
- [x] API GET /api/world-economy/rates — bảng tỷ giá tất cả thế giới
- [x] API GET /api/world-economy/:worldSlug — kinh tế 1 thế giới (currency, treasury, volume 24h)
- [x] API POST /api/world-economy/setup — creator setup tiền tệ cho thế giới (AI đặt tên)
- [x] API POST /api/world-economy/exchange — đổi tiền giữa 2 thế giới (phí 1%)
- [x] API POST /api/world-economy/tax/:worldSlug — owner set thuế suất (0-30%)
- [x] Thuế tự động thu % từ mỗi giao dịch trong thế giới → chuyển vào world treasury
- [x] Trang `/world-economy` — sàn tỷ giá realtime, đổi tiền, bảng GDP thế giới, kho bạc
- [x] Nút Dashboard "KINH TẾ THẾ GIỚI"

---

### ════════════════════════════════════════
### PHASE 27 — NGOẠI GIAO LIÊN THẾ GIỚI (DIPLOMACY)
### ════════════════════════════════════════

**Mục tiêu:** Thế giới ký kết hiệp ước với nhau — liên minh phòng thủ, hiệp định thương mại, đại sứ quán. Quan hệ ngoại giao ảnh hưởng đến tỷ giá, thuế, và khả năng tuyên chiến.

- [x] Bảng DB `world_relations` (worldSlugA, worldSlugB, status: neutral/ally/trade_partner/enemy/war, treatiesthDetails jsonb, establishedAt, updatedAt)
- [x] Bảng DB `diplomacy_events` (id, fromWorldSlug, toWorldSlug, eventType: proposal/accept/reject/cancel/declare_war/peace, content, createdAt)
- [x] Bảng DB `world_embassies` (id, homeWorldSlug, hostWorldSlug, ambassadorCharId, establishedAt, status)
- [x] API GET /api/diplomacy/world/:worldSlug — quan hệ của 1 thế giới với các thế giới khác
- [x] API GET /api/diplomacy/map — bản đồ quan hệ toàn bộ thế giới (nodes + edges)
- [x] API POST /api/diplomacy/propose — đề xuất hiệp ước (trade / alliance / non-aggression)
- [x] API POST /api/diplomacy/respond/:eventId — chấp nhận / từ chối đề xuất
- [x] API POST /api/diplomacy/establish-embassy — cử đại sứ sang thế giới khác
- [x] API POST /api/diplomacy/sanction/:worldSlug — cấm vận kinh tế (giảm 50% trade volume)
- [x] Hiệu ứng thực: liên minh → giảm thuế giao thương 50%, trade_partner → tăng tỷ giá 10%, enemy → phí giao dịch ×2
- [x] Trang `/diplomacy` — bản đồ quan hệ thế giới (graph), gửi đề xuất, quản lý hiệp ước, đại sứ quán
- [x] Nút Dashboard "NGOẠI GIAO"

---

### ════════════════════════════════════════
### PHASE 28 — CHIẾN TRANH THẾ GIỚI (WORLD WAR)
### ════════════════════════════════════════

**Mục tiêu:** Thế giới tuyên chiến thế giới khác. Dân của 2 bên PvP để tích điểm chiến tranh. Thế giới thắng chiếm tài nguyên/kho bạc đối phương. AI sinh tường thuật chiến sự mỗi ngày.

- [x] Bảng DB `world_wars` (id, attackerWorldSlug, defenderWorldSlug, declaredAt, endsAt, attackerScore, defenderScore, status: active/ended, winnerId, warReason, territory jsonb)
- [x] Bảng DB `war_contributions` (warId, characterId, worldSlug, pvpKills, pvpDeaths, contribution, recordedAt)
- [x] Điều kiện tuyên chiến: 2 thế giới phải ở trạng thái neutral hoặc enemy (không phải ally)
- [x] API POST /api/world-war/declare/:targetWorldSlug — tuyên chiến (chỉ world owner)
- [x] API GET /api/world-war/active — tất cả chiến tranh đang diễn ra
- [x] API GET /api/world-war/:warId — chi tiết chiến tranh + bảng xếp hạng đóng góp
- [x] API POST /api/world-war/contribute — PvP kill tự động cộng điểm vào chiến tranh đang active
- [x] API POST /api/world-war/:warId/surrender — đầu hàng sớm (mất 30% kho bạc thay vì 50%)
- [x] Auto-end sau 72h: tính tổng điểm, thế giới thắng nhận 20% kho bạc đối phương
- [x] AI sinh "Tường Thuật Chiến Sự" mỗi 12h — tin tức chiến tranh theo phong cách lore thế giới
- [x] Trang `/world-war` — bản đồ chiến tranh, điểm số realtime, tường thuật, lịch sử chiến tranh
- [x] Nút Dashboard "CHIẾN TRANH THẾ GIỚI"

---

### ════════════════════════════════════════
### PHASE 29 — ĐA CHỦ ĐỀ THẾ GIỚI (MULTI-THEME ENGINE)
### ════════════════════════════════════════

**Mục tiêu:** Không còn giới hạn 3 thế giới preset. Người dùng nhập bất kỳ ý tưởng nào → AI sinh framework hoàn chỉnh: lịch sử, kinh tế, quân đội, văn hóa, địa lý, 10 NPC, 5 Boss, 20 item đặc trưng, tiền tệ riêng, 8 quest template — tất cả theo phong cách chủ đề đó.

- [x] Bảng DB `world_themes` (worldSlug, themeInput, themeName, themeStyle, geography jsonb, history, economy jsonb, military jsonb, culture jsonb, uniqueItems jsonb, uniqueQuests jsonb, generatedAt)
- [x] AI pipeline: input → generate theme → generate economy → generate military → generate culture → generate items → generate quests (6 bước, parallel khi có thể)
- [x] 15+ preset theme templates: Steampunk / Space Opera / Medieval / Underwater / Post-Apocalypse / Wuxia / Viking / Ancient Egypt / Feudal Japan / Wild West / Dinosaur Era / Underwater Civilization / Demon Realm / Celestial Heaven / Ant Colony
- [x] Preset áp dụng ngay không cần AI (fast path) — AI dùng khi custom input
- [x] API POST /api/world-theme/generate — input chủ đề → AI sinh full framework (5-10s)
- [x] API POST /api/world-theme/apply/:worldSlug — áp dụng theme vào thế giới đã tạo
- [x] API GET /api/world-theme/presets — 15 preset có sẵn
- [x] API GET /api/world-theme/:worldSlug — theme hiện tại của thế giới
- [x] Tích hợp vào World Creator: bước 2 chọn theme (preset hoặc custom AI)
- [x] Theme ảnh hưởng: tên tiền tệ, item names, NPC titles, quest flavor text, enemy types
- [x] Trang `/world-theme` — gallery 15 presets + ô nhập custom → preview → áp dụng
- [x] Nút Dashboard "THEME THẾ GIỚI"

---

### ════════════════════════════════════════
### PHASE 30 — QUẢN TRỊ THẾ GIỚI (WORLD GOVERNANCE)
### ════════════════════════════════════════

**Mục tiêu:** World owner không cai trị một mình — có thể lập Hội Đồng từ top dân cư, ban hành luật, thu thuế có mục tiêu, tổ chức bầu cử. Công dân có tiếng nói. Thế giới có "chỉ số ổn định" dao động theo quyết định quản trị.

- [x] Bảng DB `world_constitution` (worldSlug, laws jsonb, taxPolicy jsonb, entryPolicy, tradePolicy, warPolicy, stability, lastAmended, amendedBy)
- [x] Bảng DB `world_council` (worldSlug, characterId, role: owner/minister/ambassador/citizen_rep, votingPower, appointedAt)
- [x] Bảng DB `world_votes` (id, worldSlug, proposedBy, proposalType, proposalContent, votesFor, votesAgainst, status, expiresAt, executedAt)
- [x] Bảng DB `world_decrees` (id, worldSlug, issuedBy, decreeName, decreeContent, effect jsonb, issuedAt, expiresAt)
- [x] Chỉ số ổn định (0-100): tax quá cao → -10/ngày, war liên tục → -5/ngày, prosperity event → +5
- [x] API GET /api/governance/:worldSlug — constitution, council, active votes, stability
- [x] API POST /api/governance/appoint/:worldSlug — bổ nhiệm vào hội đồng
- [x] API POST /api/governance/propose/:worldSlug — đề xuất luật/nghị quyết
- [x] API POST /api/governance/vote/:voteId — hội đồng bỏ phiếu
- [x] API POST /api/governance/decree/:worldSlug — owner ban hành sắc lệnh trực tiếp (không cần vote)
- [x] Auto-execute: vote pass → luật có hiệu lực ngay, stability thay đổi
- [x] AI sinh mô tả "Sắc Lệnh" theo phong cách lore thế giới (VD: Tu Tiên → dùng từ ngữ đạo môn)
- [x] Trang `/governance` — hiến pháp thế giới, hội đồng, vote đang mở, lịch sử sắc lệnh
- [x] Nút Dashboard "QUẢN TRỊ THẾ GIỚI"

---

### ════════════════════════════════════════
### PHASE 31 — THIÊN TAI & PHÚC LỘC (WORLD DISASTERS & BLESSINGS)
### ════════════════════════════════════════

**Mục tiêu:** AI ngẫu nhiên kích hoạt thiên tai (thiên thạch, dịch bệnh, hạn hán) hoặc phúc lành (mưa kho báu, làn sóng giác ngộ, phúc khí) cho thế giới. Người chơi có thể cầu nguyện tập thể để giảm thiên tai. Ảnh hưởng đến EXP, tài nguyên, và kinh tế.

- [x] Bảng DB `world_disasters` (id, worldSlug, eventType: disaster/blessing, eventName, severity: minor/major/catastrophic, description, aiNarrative, effect jsonb, startedAt, endsAt, prayerCount, status: active/ended, resolvedBy: expired/prayer/override)
- [x] Bảng DB `disaster_prayers` (disasterId, characterId, prayerText, prayerPower, prayedAt)
- [x] AI sinh sự kiện ngẫu nhiên mỗi 24h per world — random disaster hoặc blessing (30% blessing, 70% disaster)
- [x] Hiệu ứng thực: disaster → EXP giảm 20-50%, tài nguyên giảm 30-80% / blessing → EXP tăng 50%, drop item tốt hơn
- [x] Cơ chế cầu nguyện tập thể: tổng prayerPower ≥ 1000 → thiên tai giảm 1 cấp severity hoặc kết thúc sớm
- [x] API GET /api/disasters/:worldSlug — thiên tai/phúc lành đang active
- [x] API POST /api/disasters/trigger/:worldSlug — admin/AI trigger event thủ công
- [x] API POST /api/disasters/:disasterId/pray — cầu nguyện đẩy lùi thiên tai
- [x] API GET /api/disasters/history/:worldSlug — lịch sử sự kiện (20 gần nhất)
- [x] Trang `/disasters` — bản đồ thiên tai toàn cầu, cầu nguyện tập thể, lịch sử
- [x] Thông báo push khi thiên tai mới xuất hiện (notification bell)
- [x] Nút Dashboard "THIÊN TAI & PHÚC LỘC"

---

### ════════════════════════════════════════
### PHASE 32 — NGÂN HÀNG LIÊN THẾ GIỚI (CROSS-WORLD BANK)
### ════════════════════════════════════════

**Mục tiêu:** Ngân hàng trung lập nằm giữa các thế giới. Người chơi gửi tiết kiệm nhận lãi 2%/ngày, vay vốn với lãi suất, chuyển khoản cross-world, đổi ngoại tệ. Tạo hệ thống tài chính độc lập với chợ thông thường.

- [x] Bảng DB `bank_accounts` (id, characterId, worldSlug, balance, totalDeposited, totalWithdrawn, openedAt, lastInterestAt)
- [x] Bảng DB `bank_loans` (id, characterId, worldSlug, principal, interestRate, totalOwed, dueAt, status: active/paid/defaulted, takenAt)
- [x] Bảng DB `bank_transfers` (id, fromCharId, toCharId, amount, fromCurrency, toCurrency, exchangeRate, fee, note, transferredAt)
- [x] Lãi suất tiết kiệm: 2%/ngày auto-compound — tính khi user đăng nhập (lazy evaluation)
- [x] Phí chuyển khoản cross-world: 5% + phí cố định 10 gold
- [x] Tỷ giá: thay đổi theo quan hệ ngoại giao (ally → tỷ giá tốt hơn, enemy → tệ hơn)
- [x] Vay tối đa 500% số dư tài khoản, lãi 5%/ngày, auto-deduct từ tài khoản khi đến hạn
- [x] API GET /api/bank/account — tài khoản của user
- [x] API POST /api/bank/deposit — gửi tiết kiệm
- [x] API POST /api/bank/withdraw — rút tiền
- [x] API POST /api/bank/loan — vay vốn
- [x] API POST /api/bank/repay/:loanId — trả nợ
- [x] API POST /api/bank/transfer — chuyển khoản cross-world
- [x] API GET /api/bank/rates — tỷ giá hối đoái hiện tại
- [x] Trang `/bank` — tài khoản ngân hàng, vay nợ, chuyển khoản, tỷ giá
- [x] Nút Dashboard "NGÂN HÀNG"

---

### ════════════════════════════════════════
### PHASE 33 — BẢNG TRUY NÃ (BOUNTY BOARD)
### ════════════════════════════════════════

**Mục tiêu:** Người chơi đặt tiền truy nã nhân vật khác (PvP bounty) hoặc boss đặc biệt. Ai hạ được mục tiêu nhận thưởng. Tạo hệ sinh thái thợ săn tiền thưởng (bounty hunter) và tội phạm trong thế giới.

- [x] Bảng DB `bounties` (id, postedBy, targetCharId, targetCharName, targetWorldSlug, reward, reason, status: active/claimed/expired, claimedBy, postedAt, expiresAt)
- [x] Bảng DB `bounty_claims` (bountyId, claimerCharId, battleProof jsonb, claimedAt, approvedAt, status)
- [x] Giới hạn: max 3 bounty active per character, minimum reward 100 gold, expire sau 7 ngày
- [x] Hạ target trong PvP → auto-detect + create claim → admin/AI approve trong 10 phút
- [x] "Danh sách truy nã" công khai — ai có bounty cao nhất được gọi là Kẻ Thù Thiên Hạ
- [x] API GET /api/bounties/active — danh sách bounty đang active
- [x] API GET /api/bounties/my — bounty của mình (đặt + bị đặt)
- [x] API POST /api/bounties/post — đặt tiền truy nã
- [x] API POST /api/bounties/claim/:bountyId — claim khi hạ xong
- [x] API DELETE /api/bounties/:bountyId — hủy bounty (mất 50% tiền)
- [x] Trang `/bounties` — bảng truy nã, top bounty, lịch sử, đặt truy nã
- [x] Nút Dashboard "TRUY NÃ"

---

### ════════════════════════════════════════
### PHASE 34 — ĐẠI HỘI VÕ LÂM (GRAND TOURNAMENT)
### ════════════════════════════════════════

**Mục tiêu:** Giải đấu PvP toàn server mỗi tuần — bracket 16 người, 4 vòng đấu. AI sinh commentary cho từng trận. Nhà vô địch nhận danh hiệu "Thiên Hạ Đệ Nhất" + phần thưởng đặc biệt + 1 tháng.

- [x] Bảng DB `tournaments` (id, season, status: registration/active/ended, bracket jsonb, startAt, endAt, winnerId, prizePool, participantCount)
- [x] Bảng DB `tournament_matches` (id, tournamentId, round, matchIndex, char1Id, char2Id, winnerId, battleLog jsonb, aiCommentary, foughtAt)
- [x] Đăng ký tự do 3 ngày trước giải, chọn 16 người đầu tiên (nếu > 16 → ranked by power)
- [x] Bracket tự động khi đủ 16 người — AI simulate trận đấu dựa trên stats thật
- [x] AI sinh commentary kịch tính cho từng trận theo lore thế giới
- [x] Auto-advance bracket, semi-final, final — mỗi vòng cách nhau 6h
- [x] API GET /api/tournament/current — giải đang diễn ra hoặc đăng ký
- [x] API POST /api/tournament/register — đăng ký tham gia
- [x] API GET /api/tournament/:tournamentId/bracket — bracket hiện tại
- [x] API POST /api/tournament/:tournamentId/simulate — admin/AI simulate vòng đấu
- [x] Trang `/tournament` — đăng ký, bracket tree, commentary, lịch sử vô địch
- [x] Nút Dashboard "ĐẠI HỘI VÕ LÂM"

---

### ════════════════════════════════════════
### PHASE 35 — BẤT ĐỘNG SẢN THẾ GIỚI (REAL ESTATE)
### ════════════════════════════════════════

**Mục tiêu:** Người chơi mua đất/cửa hàng trong thế giới để kiếm thu nhập thụ động. Đất có thể nâng cấp, cho thuê, bán lại. Tạo economy layer thứ 2 bên cạnh chiến đấu.

- [x] Bảng DB `land_plots` (id, worldSlug, plotName, plotType: farmland/shop/mine/residence, tier: 1-5, ownerId, ownerCharId, price, rentalIncome, lastCollectedAt, purchasedAt, upgradeLevel, isForSale, salePrice)
- [x] Bảng DB `land_transactions` (id, plotId, fromCharId, toCharId, transactionType: purchase/rent/upgrade/income, amount, notes, transactionAt)
- [x] Mỗi thế giới có 30 plots sẵn (10 farmland, 10 shop, 5 mine, 5 residence) — seeded khi world tạo
- [x] Thu nhập thụ động: farmland 5 gold/h, shop 15 gold/h, mine 25 gold/h, residence 8 gold/h (nhân tier)
- [x] Nâng cấp plot tăng income 50% per level, max tier 5
- [x] API GET /api/realestate/:worldSlug — tất cả plots của thế giới
- [x] API GET /api/realestate/my-plots — plots của nhân vật hiện tại
- [x] API POST /api/realestate/buy/:plotId — mua đất
- [x] API POST /api/realestate/sell/:plotId — đăng bán đất
- [x] API POST /api/realestate/upgrade/:plotId — nâng cấp plot
- [x] API POST /api/realestate/collect/:plotId — thu nhập thụ động
- [x] API POST /api/realestate/collect-all — thu tất cả cùng lúc
- [x] Trang `/realestate` — bản đồ đất đai, mua bán, thu nhập, nâng cấp
- [x] Nút Dashboard "BẤT ĐỘNG SẢN"

---

### ════════════════════════════════════════
### PHASE 36 — HỘI CHỢ THẾ GIỚI (WORLD FAIR) ✅
### ════════════════════════════════════════

**Mục tiêu:** Định kỳ 3 ngày/lần, hội chợ liên thế giới mở ra. Mỗi thế giới có gian hàng riêng — người chơi bỏ 50 gold tham quan, nhận EXP, bình chọn thế giới yêu thích. Thế giới nhiều phiếu nhất mùa đó được xướng danh Quán Quân.

- [x] Bảng DB `world_fairs` (id, season, status, theme, startAt, endsAt, totalVisits, winnerWorldSlug)
- [x] Bảng DB `fair_booths` (id, fairId, worldSlug, worldName, boothName, aiNarrative, entryFee, votes, visits, featured, ownerId)
- [x] Bảng DB `fair_visits` (id, fairId, boothId, characterId, userId, goldSpent, voted, visitedAt)
- [x] AI sinh tên gian hàng + narrative mô tả gian hàng theo lore thế giới (lazy — sinh lúc tham quan lần đầu)
- [x] 3 gian hàng builtin (Tu Tiên/Cyberpunk/Hoang Phế) + up to 5 gian hàng custom worlds
- [x] Hội chợ tự động tạo mùa mới khi hết hạn (getOrCreateActiveFair)
- [x] API GET /api/fair/current — hội chợ đang diễn ra + booths
- [x] API GET /api/fair/history — lịch sử các mùa đã kết thúc
- [x] API POST /api/fair/visit/:boothId — tham quan (-50 gold, +30 EXP, sinh AI narrative)
- [x] API POST /api/fair/vote/:boothId — bình chọn (chỉ sau khi đã tham quan)
- [x] API POST /api/fair/register — creator đăng ký gian hàng cho thế giới công khai của mình
- [x] API GET /api/fair/my-visits — lịch sử tham quan của user
- [x] Trang `/fair` — banner thông tin mùa, grid gian hàng, visit/vote, tab lịch sử
- [x] Nút Dashboard "HỘI CHỢ THẾ GIỚI" tag "NEW"

---

### ════════════════════════════════════════
### PHASE 37 — HỆ THỐNG DI DÂN (CITIZENSHIP) ✅
### ════════════════════════════════════════

**Mục tiêu:** Nhân vật có thể xin nhập quốc tịch vào thế giới người khác — không chỉ du lịch mà là định cư. Công dân được giảm thuế giao dịch, nhận thông báo sự kiện thế giới, tham gia bầu cử, đóng thuế thường niên. World owner phê duyệt hoặc từ chối.

- [x] Bảng DB `citizenships` (id, characterId, worldSlug, status: pending/approved/revoked, applicationNote, approvalNote, appliedAt, approvedAt, taxPaidAt, annualTax)
- [x] Bảng DB `citizenship_benefits` (worldSlug, tradeTaxDiscount, voteEligible, eventNotify, maxCitizens, annualTaxAmount)
- [x] API GET /api/citizenship/worlds — thế giới đang nhận công dân
- [x] API GET /api/citizenship/my — quốc tịch của nhân vật hiện tại
- [x] API POST /api/citizenship/apply/:worldSlug — nộp đơn nhập quốc tịch
- [x] API GET /api/citizenship/applications/:worldSlug — creator xem đơn xin
- [x] API POST /api/citizenship/approve/:id — phê duyệt + thiết lập quyền lợi
- [x] API POST /api/citizenship/revoke/:id — thu hồi quốc tịch
- [x] API POST /api/citizenship/pay-tax/:worldSlug — nộp thuế thường niên (tránh mất quốc tịch)
- [x] Quyền lợi công dân: giảm 20% thuế giao dịch, bình chọn governance, thông báo sự kiện
- [x] Trang `/citizenship` — thế giới nhận cư dân, đơn của tôi, quản lý công dân (creator)
- [x] Nút Dashboard "DI DÂN & QUỐC TỊCH"

---

### ════════════════════════════════════════
### PHASE 38 — THÁM HIỂM NHÓM (GROUP EXPEDITION) ✅
### ════════════════════════════════════════

**Mục tiêu:** 2–4 nhân vật lập đội thám hiểm vùng đất chưa khám phá. AI sinh bản đồ ngẫu nhiên + chuỗi sự kiện. Loot chia đều. Thất bại → mất HP + gold. Thành công → loot hiếm + EXP nhân đôi.

- [x] Bảng DB `expeditions` (id, worldSlug, leaderId, status: recruiting/active/ended, members jsonb, mapData jsonb, currentStep, totalSteps, loot jsonb, createdAt, endedAt)
- [x] Bảng DB `expedition_events` (id, expeditionId, step, eventType: combat/trap/treasure/npc/rest, description, outcome jsonb, resolvedAt)
- [x] Tối đa 4 thành viên, leader mời, leader tự khởi động khi muốn
- [x] AI sinh sự kiện ngẫu nhiên (combat, treasure, trap, npc, rest) + narrative theo lore
- [x] API POST /api/expedition/create — tạo đội thám hiểm
- [x] API POST /api/expedition/join/:id — gia nhập đội
- [x] API POST /api/expedition/start/:id — leader khởi động
- [x] API POST /api/expedition/advance/:id — tiến bước tiếp (cooldown 5 phút/bước)
- [x] API GET /api/expedition/active — thám hiểm đang diễn ra của user
- [x] API GET /api/expedition/events/:id — lịch sử sự kiện
- [x] API GET /api/expedition/history — lịch sử đã kết thúc
- [x] Reward chia đều: gold/EXP/HP thay đổi theo từng sự kiện + bonus khi hoàn thành
- [x] Trang `/expedition` — tạo đội, tìm đội, bản đồ tiến trình, sự kiện realtime
- [x] Nút Dashboard "THÁM HIỂM NHÓM"

---

### ════════════════════════════════════════
### PHASE 39 — KỸ NĂNG QUỐC GIA (WORLD SKILLS) ✅
### ════════════════════════════════════════

**Mục tiêu:** Mỗi thế giới có 3 kỹ năng đặc trưng chỉ công dân/cư dân thế giới đó mới học được. AI sinh tên + mô tả theo lore. Kỹ năng tăng passive buff khi ở trong thế giới đó.

- [x] Bảng DB `world_unique_skills` (id, worldSlug, skillName, skillDesc, buffType, buffValue, requiredLevel, learnCost, learners: int)
- [x] Bảng DB `character_world_skills` (characterId, worldSlug, skillId, learnedAt, level)
- [x] AI sinh 3 kỹ năng/world lazy — sinh lần đầu ai truy cập, fallback nếu AI lỗi
- [x] Builtin worlds không cần quốc tịch; custom worlds cần quốc tịch được duyệt
- [x] API GET /api/world-skills/:worldSlug — kỹ năng + mySkills + hasCitizenship
- [x] API POST /api/world-skills/learn — học kỹ năng (-gold, -level check)
- [x] API GET /api/world-skills/my — tất cả kỹ năng đã học
- [x] Passive buff: exp_bonus/gold_find/crit_chance/defense_bonus/hp_regen/attack_bonus
- [x] Trang `/world-skills` — chọn thế giới, gallery kỹ năng, tab kỹ năng đã học
- [x] Nút Dashboard "KỸ NĂNG QUỐC GIA"

---

### ════════════════════════════════════════
### PHASE 40 — TRUYỀN THUYẾT ANH HÙNG (LEGEND HALL) ✅
### ════════════════════════════════════════

**Mục tiêu:** Nhân vật đạt thành tựu đặc biệt (lv50+, 1000 battle wins, vô địch tournament, v.v.) được AI phong "Huyền Thoại" — sinh ra câu chuyện sử thi lưu vĩnh viễn vào "Điện Truyền Thuyết". Người chơi mới đọc lịch sử anh hùng. Huyền Thoại được cộng đồng tôn vinh.

- [x] Bảng DB `legends` (id, characterId, characterName, worldSlug, system, level, legendTitle, epicStory, achievements jsonb, stats jsonb, inducedAt, votes, viewed)
- [x] Bảng DB `legend_votes` (id, legendId, userId, votedAt)
- [x] Điều kiện phong huyền thoại (OR): level ≥ 50, hoặc battle_wins ≥ 1000, hoặc ≥20 thành tựu
- [x] AI (Gemini) sinh câu chuyện sử thi 6-8 câu theo lore thế giới + danh hiệu huyền thoại
- [x] API GET /api/legends — điện truyền thuyết (sort by votes, limit 50)
- [x] API POST /api/legends/induct — tự kiểm tra + phong huyền thoại nếu đủ điều kiện
- [x] API POST /api/legends/vote/:legendId — cộng đồng tôn vinh anh hùng (1 vote/người)
- [x] API GET /api/legends/check — kiểm tra điều kiện nhân vật của user
- [x] API GET /api/legends/:legendId — chi tiết + đếm viewed
- [x] Trang `/legends` — điện thờ huyền thoại, bảng vinh danh top 50, câu chuyện sử thi, phong huyền thoại
- [x] Nút Dashboard "ĐIỆN TRUYỀN THUYẾT"

---

### ════════════════════════════════════════
### 🌌 ROADMAP TẠO THẾ GIỚI ẢO (PHASES 41–45)
### ════════════════════════════════════════

> **Triết lý:** Phase 41–45 hiện thực hóa tầm nhìn dài hạn — mỗi user là Thần sáng tạo, thế giới ảo sống thật theo chủ đề, cuối cùng hình thành vũ trụ phân tầng. Đây là nền tảng cho VR/AR/MR/XR sau này.

---

### ════════════════════════════════════════
### PHASE 41 — THẾ GIỚI TỰ DO (FREE WORLD FRAMEWORK) ✅
### ════════════════════════════════════════

**Mục tiêu:** Người dùng tạo thế giới ảo theo BẤT KỲ chủ đề nào — không giới hạn preset. AI tự động xây dựng toàn bộ framework thế giới: hệ thống tu luyện/tiến hóa riêng, đơn vị tiền tệ riêng, tầng lớp xã hội riêng, địa lý + sinh thái riêng, ngôn ngữ/thuật ngữ riêng theo lore. Ví dụ: "Thế giới Tiên Hiệp" → AI sinh cảnh giới (Luyện Khí → Trúc Cơ → Kim Đan...), linh thạch, môn phái, tiên thú, tiên dược.

- [x] Bảng DB `world_frameworks` (id, worldSlug, theme, progressionSystem jsonb, currency jsonb, socialClasses jsonb, geography jsonb, terminology jsonb, loreRules text, atmosphereColor, tagline, generatedAt)
- [x] Bảng DB `world_lore_entries` (id, worldSlug, category: history/faction/geography/creature/item/law, title, content, aiGenerated, createdAt)
- [x] Form tạo thế giới mới: nhập tên + mô tả ý tưởng tự do (không bị giới hạn dropdown preset)
- [x] AI (Gemini) nhận mô tả → sinh framework hoàn chỉnh: progressionSystem (tên cảnh giới/cấp độ), currency (tên tiền tệ theo lore), socialClasses (tầng lớp từ thấp→cao), geography (vùng đất), terminology (từ ngữ đặc trưng)
- [x] AI sinh ít nhất 5 lore entries tự động sau khi tạo (history/creature/item/faction/geography)
- [x] Trang `/world-creator` nâng cấp — 2 tab: SÁNG TẠO TỰ DO (textarea) + CHỌN THỂ LOẠI (dropdown preset); preview framework sau khi tạo
- [x] API POST /api/world/create-free — nhận mô tả tự do → AI sinh framework → lưu world + framework + 5 lore entries
- [x] API GET /api/world/framework/:worldSlug — trả framework + lore entries
- [x] API POST /api/world/lore/:worldSlug — thêm lore entry thủ công (creator only)
- [x] View Framework: trang xem đầy đủ progressionSystem tiers, kinh tế, tầng lớp, địa lý, thuật ngữ, luật lệ, lore entries
- [x] Nút 📖 BookOpen trên card thế giới → mở framework view trực tiếp

---

### ════════════════════════════════════════
### PHASE 42 — THẦN QUAN SÁT (GOD OBSERVER DASHBOARD) ✅
### ════════════════════════════════════════

**Mục tiêu:** Creator là Thần tối cao — có bảng quan sát thế giới thời gian thực.

- [x] Bảng DB `world_population_log` (worldSlug, npcCount, playerCount, totalGold, avgLevel, activeEvents, karmaScore, timestamp)
- [x] Bảng DB `world_auto_events` (worldSlug, eventType, title, description, triggeredBy, effect jsonb, startedAt, endsAt)
- [x] API GET /api/god/observe/:worldSlug — snapshot: NPC/player counts, gold, level, karma, npcMoodMap, autoEvents
- [x] API GET /api/god/population-history/:worldSlug — lịch sử 24 điểm gần nhất (7 ngày)
- [x] API POST /api/god/macro-intervene/:worldSlug — 5 loại can thiệp vĩ mô (bless_all/golden_age/mystery/curse_all/catastrophe)
- [x] API GET /api/god/auto-events/:worldSlug — sự kiện tự phát sinh
- [x] Tab "QUAN SÁT" mới trong GodModePage — stats grid 6 chỉ số, NPC mood map (màu sắc theo trạng thái), macro intervene panel, auto events feed
- [x] Population log ghi tự động mỗi lần Thần observe
- [x] Nút Dashboard "QUAN SÁT THẾ GIỚI" (trong God Mode)


---

### ════════════════════════════════════════
### PHASE 43 — THẾ GIỚI SỐNG (LIVING WORLD ENGINE) ✅
### ════════════════════════════════════════

**Mục tiêu:** Thế giới ảo phải GIỐNG thế giới thực theo chủ đề — mọi thứ trong thế giới đều phải nhất quán với lore.

- [x] Bảng DB `npc_lives` (id, npcId, worldSlug, occupation, familyMembers, dailyRoutine, currentGoal, mood, wealthLevel)
- [x] Bảng DB `world_culture` (id, worldSlug, festivals, taboos, traditions, myths, commonPhrases, generatedAt)
- [x] Bảng DB `world_economy_state` (id, worldSlug, snapshot, inflationRate, unemploymentRate, timestamp)
- [x] API GET /api/world/living/:worldSlug — full living world snapshot: npc lives, culture, economy state, framework
- [x] API GET /api/world/culture/:worldSlug — văn hóa thế giới
- [x] API POST /api/world/culture/generate/:worldSlug — AI sinh văn hóa (festivals, taboos, traditions, myths, phrases)
- [x] Trang `/world-profile/:worldSlug` — hồ sơ thế giới: 4 tab (TỔNG QUAN / VĂN HÓA / NPC / KINH TẾ)
- [x] Nút 🌍 trong WorldCreatorPage → điều hướng đến hồ sơ thế giới

---

### ════════════════════════════════════════
### PHASE 44 — ĐA THẾ GIỚI PER USER (MULTI-WORLD MANAGEMENT) ✅
### ════════════════════════════════════════

**Mục tiêu:** Quản lý nhiều thế giới, cổng truyền tống, và Tinh Vực.

- [x] Bảng DB `user_world_slots` (userId, maxWorlds, unlockedAt)
- [x] Bảng DB `world_portals` (id, fromWorldSlug, toWorldSlug, portalName, portalType, travelCost, aiNarrative, isActive, createdBy)
- [x] Bảng DB `star_domains` (id, ownerUserId, domainName, worldSlugs, domainLevel, totalPopulation, totalWealth)
- [x] API GET /api/multiworld/my-worlds — tất cả thế giới + stats + portals + domain
- [x] API POST /api/multiworld/portal/create — AI sinh narrative + tạo cổng
- [x] API POST /api/multiworld/portal/travel/:portalId — di chuyển nhân vật qua cổng
- [x] API POST /api/multiworld/domain/create — gộp ≥3 thế giới thành Tinh Vực
- [x] API GET /api/multiworld/domain/my — Tinh Vực của user
- [x] Trang `/my-worlds` — quản lý thế giới, tạo cổng, thành lập Tinh Vực

---

### ════════════════════════════════════════
### PHASE 45 — VŨ TRỤ PHÂN TẦNG (COSMIC HIERARCHY) ✅
### ════════════════════════════════════════

**Mục tiêu:** Hệ thống phân cấp vũ trụ hoàn chỉnh — Thế Giới → Tinh Vực → Ngân Hà → Thiên Hà → Vũ Trụ.

- [x] Bảng DB `cosmic_entities` (id, ownerUserId, entityType, entityName, tier, powerScore, population, wealth, influenceRadius, ascendedAt, lastActivityAt)
- [x] Bảng DB `cosmic_events` (id, entityId, eventType: ascension/invasion/alliance/collapse/wonder, title, description, aiNarrative, participants, outcome)
- [x] Bảng DB `cosmic_rankings` (entityId, entityType, rank, powerScore, updatedAt)
- [x] Điều kiện thăng cấp: tier 1→2 (pop≥50/wealth≥1000/score≥200), tier 2→3 (pop≥200...), ...
- [x] API GET /api/cosmos/map — bản đồ toàn vũ trụ (50 entities mạnh nhất)
- [x] API GET /api/cosmos/my — thực thể của user + lịch sử sự kiện (auto-create nếu chưa có)
- [x] API POST /api/cosmos/ascend/:entityId — kiểm tra điều kiện + thăng cấp + AI narrative sử thi
- [x] API GET /api/cosmos/rankings — bảng xếp hạng theo từng tier
- [x] API POST /api/cosmos/event/trigger — AI sinh cosmic event ngẫu nhiên
- [x] Trang `/cosmos` — 3 tab: CỦA TÔI (thăng cấp + progress bars) / BẢN ĐỒ / BẢNG XẾP HẠNG

---

## 📦 TRẠNG THÁI BẢNG DB

| Bảng | Trạng thái | Phase | Mô tả |
|---|---|---|---|
| `users` | ✅ | P1 | Profile Replit user |
| `sessions` | ✅ | P1 | Server-side sessions |
| `worlds` | ✅ | P1 | 3 thế giới |
| `characters` | ✅ | P1 | Nhân vật người chơi |
| `quests` | ✅ | P1 | Nhiệm vụ |
| `battles` | ✅ | P1 | Lịch sử chiến đấu |
| `items` | ✅ | P1 | Vật phẩm (24 templates × 3 worlds) |
| `inventory` | ✅ | P1 | Túi đồ nhân vật |
| `guilds` | ✅ | P1+ | Bang hội |
| `guild_members` | ✅ | P1+ | Thành viên bang hội |
| `character_memories` | ✅ | P3 | Ký ức nhân vật |
| `npc_memories` | ✅ | P3 | NPC nhớ người chơi |
| `world_memories` | ✅ | P3 | Lịch sử thế giới |
| `world_state` | ✅ | P4 | Boss alive/dead + respawn timer |
| `world_resources` | ✅ | P4 | Tài nguyên thế giới + regen tự động |
| `market_prices` | ✅ | P4 | Giá item dao động theo supply/demand |
| `world_events` | ✅ | P6 | Sự kiện AI sinh — 7 loại, karma tracking |
| `npcs` | ✅ | P7 | NPC agents — 7 vai trò, AI tick + interact |
| `character_skills` | ✅ | P2 | Skill tree per system (6 hệ thống × 5 kỹ năng) |
| `factions` | ✅ | P2 | 4 phe phái × 3 thế giới (seeded tự động) |
| `character_faction` | ✅ | P2 | Tư cách thành viên + điểm uy tín |
| `custom_worlds` | ✅ | P8 | Thế giới do người chơi/AI tạo |
| `cross_world_events` | ✅ | P10 | Sự kiện xuyên thế giới (portal/war/merge) |
| `character_world_travel` | ✅ | P10 | Lịch sử di chuyển nhân vật giữa thế giới |
| `pvp_rankings` | ✅ | P1+ | PvP ranking: RP Elo, tier, streak |
| `achievements` | ✅ | P11 | 30 thành tựu theo 5 danh mục |
| `character_achievements` | ✅ | P11 | Thành tựu đã mở khóa của nhân vật |
| `daily_logins` | ✅ | P12 | Daily login streak + reward |
| `dungeons` | ✅ | P13 | 9 dungeon (3 per world: easy/normal/hard) |
| `dungeon_runs` | ✅ | P13 | Lịch sử run dungeon (loot jsonb) |
| `recipes` | ✅ | P14 | Công thức chế tạo — 7–8 per world |
| `clan_wars` | ✅ | P15 | Chiến tranh bang hội 24h, auto-end |
| `story_posts` | ✅ | P16 | Bài đăng hành trình — 8 loại postType, likes |
| `post_likes` | ✅ | P16 | Like toggle per user per post |
| `divine_actions` | ✅ | P17 | Thần can thiệp thế giới: intervene/bless/smite/answer |
| `npc_prayers` | ✅ | P17 | Lời cầu nguyện NPC gửi lên creator — AI sinh tự động |
| `world_trade_listings` | ✅ | P18 | Cross-world item listings (48h expire, phí cổng 5%) |
| `world_trade_history` | ✅ | P18 | Lịch sử giao dịch + tên item sau khi qua Rào Cản |
| `world_passports` | ✅ | P19 | Hộ chiếu du hành — pending/approved/banned |
| `world_entry_log` | ✅ | P19 | Log mỗi lần nhân vật enter/exit thế giới |
| `prophecies` | ✅ | P20 | Lời tiên tri AI sinh — thơ/ẩn dụ + hiddenCondition |
| `prophecy_claims` | ✅ | P20 | Claim + AI scoring 0-100 + auto-approve ≥80 |
| `isekai_records` | ✅ | P21 | Lịch sử xuyên không — identity mới + narrative + system grant |
| `fate_events` | ✅ | P22 | Mệnh Cục Cát/Hung — effect thực tế, cooldown 1h |
| `fate_readings` | ✅ | P22 | Giải quẻ Bát Quái AI — Thiên Cơ Tiên phán, cooldown 2h |
| `auction_listings` | ✅ | P23 | Phiên đấu giá — startBid, currentBid, buyoutPrice, expiresAt, status |
| `auction_bids` | ✅ | P23 | Lịch sử đặt giá — bidderCharId, bidAmount, bidAt |
| `character_titles` | ✅ | P24 | Danh hiệu nhân vật — titleKey, equipped, unlockedAt |
| `pets` | ✅ | P25 | Đồng hành — species, rarity, tier, level, bondLevel, skills jsonb, isActive |
| `world_currencies` | ✅ | P26 | Tiền tệ thế giới — AI sinh tên theo lore, exchangeRateToGold, totalSupply |
| `world_treasury` | ✅ | P26 | Kho bạc thế giới — balance, taxRate, totalRevenue, totalExpenditure |
| `currency_exchanges` | ✅ | P26 | Lịch sử đổi tiền cross-world — rate dao động ±2-5% theo volume |
| `world_relations` | ✅ | P27 | Quan hệ ngoại giao giữa 2 thế giới — ally/trade_partner/neutral/enemy |
| `diplomacy_events` | ✅ | P27 | Sự kiện ngoại giao — proposal/accept/reject/cancel/declare_war |
| `world_embassies` | ✅ | P27 | Đại sứ quán — ambassadorCharId, homeWorld, hostWorld |
| `world_wars` | ✅ | P28 | Chiến tranh thế giới — 72h, attackerScore/defenderScore, warBulletin AI |
| `war_contributions` | ✅ | P28 | Đóng góp chiến tranh per character — pvpKills, contribution points |
| `world_themes` | ✅ | P29 | Theme thế giới — 15 preset + custom AI, geography/economy/military/culture |
| `world_constitution` | ✅ | P30 | Hiến pháp thế giới — laws, taxPolicy, stability 0-100 |
| `world_council` | ✅ | P30 | Hội đồng — minister/ambassador/citizen_rep, votingPower |
| `world_votes` | ✅ | P30 | Bỏ phiếu — proposalType, 48h expire, auto-execute khi pass |
| `world_decrees` | ✅ | P30 | Sắc lệnh owner — AI sinh lore text, stabilityDelta |
| `world_disasters` | ✅ | P31 | Thiên tai/phúc lành AI — severity, prayerPower, effect jsonb |
| `disaster_prayers` | ✅ | P31 | Cầu nguyện tập thể — prayerPower theo level nhân vật |
| `bank_accounts` | ✅ | P32 | Tài khoản ngân hàng — lãi 2%/ngày auto-compound |
| `bank_loans` | ✅ | P32 | Vay vốn — 5%/ngày, max 500% số dư, 7 ngày |
| `bank_transfers` | ✅ | P32 | Chuyển khoản cross-world — phí 5% + 10 gold |
| `bounties` | ✅ | P33 | Truy nã — reward, target, expire 7 ngày |
| `bounty_claims` | ✅ | P33 | Claim tiền thưởng — auto-approve |
| `tournaments` | ✅ | P34 | Giải đấu võ lâm — bracket 16 người, prize pool |
| `tournament_participants` | ✅ | P34 | Người tham gia — seed, isEliminated |
| `tournament_matches` | ✅ | P34 | Trận đấu — AI commentary, battleLog |
| `land_plots` | ✅ | P35 | Bất động sản — 30 plots/world, thu nhập thụ động |
| `land_transactions` | ✅ | P35 | Lịch sử giao dịch đất |
| `world_fairs` | ✅ | P36 | Hội chợ thế giới — season, theme, endsAt, totalVisits |
| `fair_booths` | ✅ | P36 | Gian hàng hội chợ — AI tên+narrative, votes, visits |
| `fair_visits` | ✅ | P36 | Lịch sử tham quan — goldSpent, voted |
| `citizenships` | ✅ | P37 | Quốc tịch — pending/approved/revoked, annualTax |
| `citizenship_benefits` | ✅ | P37 | Quyền lợi công dân — tradeTaxDiscount, maxCitizens |
| `expeditions` | ✅ | P38 | Thám hiểm nhóm — members jsonb, mapData, currentStep |
| `expedition_events` | ✅ | P38 | Sự kiện thám hiểm — combat/treasure/trap/npc/rest |
| `world_unique_skills` | ✅ | P39 | Kỹ năng quốc gia — AI sinh 3 kỹ năng/world lazy |
| `character_world_skills` | ✅ | P39 | Kỹ năng đã học — buffType, buffValue |
| `legends` | ✅ | P40 | Điện truyền thuyết — AI epicStory, votes, viewed |
| `legend_votes` | ✅ | P40 | Phiếu tôn vinh anh hùng |
| `world_frameworks` | ✅ | P41 | Framework thế giới tự do — progressionSystem/currency/socialClasses/geography/terminology jsonb |
| `world_lore_entries` | ✅ | P41 | Lore entries — 6 category, aiGenerated flag |
| `world_population_log` | ✅ | P42 | Lịch sử dân số thế giới |
| `world_auto_events` | ✅ | P42 | Sự kiện tự phát sinh |
| `npc_lives` | ✅ | P43 | Cuộc sống NPC: nghề, gia đình, mục tiêu |
| `world_culture` | ✅ | P43 | Văn hóa: lễ hội, phong tục, huyền thoại |
| `world_economy_state` | ✅ | P43 | Trạng thái kinh tế thế giới |
| `user_world_slots` | ✅ | P44 | Slot thế giới mỗi user |
| `world_portals` | ✅ | P44 | Cổng truyền tống giữa các thế giới |
| `star_domains` | ✅ | P44 | Tinh Vực — gộp ≥3 thế giới |
| `cosmic_entities` | ✅ | P45 | Thực thể vũ trụ: tier 1–5 |
| `cosmic_events` | ✅ | P45 | Sự kiện vũ trụ (ascension/invasion…) |
| `cosmic_rankings` | ✅ | P45 | Bảng xếp hạng cosmic |

---

## 🗺️ TRẠNG THÁI ROUTE

| Route | Trang | Phase | Trạng thái |
|---|---|---|---|
| `/` | Landing Page | P1 | ✅ |
| `/login` | Đăng nhập (Replit Auth) | P1 | ✅ |
| `/worlds` | Chọn thế giới | P1 | ✅ |
| `/create-character/:worldId` | Tạo nhân vật | P1 | ✅ |
| `/dashboard` | Dashboard nhân vật | P1 | ✅ |
| `/play` | AI Narrative + Khám phá | P5 | ✅ |
| `/character/:id` | Hồ sơ nhân vật | P1 | ✅ |
| `/leaderboard` | Bảng xếp hạng | P1 | ✅ |
| `/battle` | Chiến trường (6 mode) | P1 | ✅ |
| `/battle/history` | Lịch sử chiến đấu | P1 | ✅ |
| `/inventory` | Túi đồ / Trang bị | P1 | ✅ |
| `/settings` | Cài đặt tài khoản | P1 | ✅ |
| `/cultivate` | Tu Luyện chỉ số | P2 | ✅ |
| `/guilds` | Danh sách bang hội | P1+ | ✅ |
| `/guilds/:id` | Chi tiết bang hội | P1+ | ✅ |
| `/memories` | Ký ức hành trình | P3 | ✅ |
| `/skills` | Cây kỹ năng hệ thống | P2 | ✅ |
| `/factions` | Phe phái thế giới | P2 | ✅ |
| `/market` | Chợ đen — mua/bán | P4 | ✅ |
| `/world/:slug/state` | Trạng thái thế giới | P4 | ✅ |
| `/world-creator` | Tạo thế giới (AI) | P8 | ✅ |
| `/world-discover` | Khám phá thế giới AI + cộng đồng | P9 | ✅ |
| `/multiverse` | Đa vũ trụ — du hành, sự kiện xuyên TG | P10 | ✅ |
| `/pvp` | PvP thách đấu + ranking | P1+ | ✅ |
| `/admin` | World Monitor | P6 | ✅ |
| `/achievements` | Thành tựu | P11 | ✅ |
| `/daily` | Daily Login Rewards | P12 | ✅ |
| `/dungeon` | Ngục Tối — multi-floor | P13 | ✅ |
| `/craft` | Chế Tạo vật phẩm | P14 | ✅ |
| `/guild-war` | Chiến Tranh Bang Hội | P15 | ✅ |
| `/feed` | Dòng Thời Gian (Social Feed) | P16 | ✅ |
| `/god` | Chế Độ Thần — chọn thế giới | P17 | ✅ |
| `/god/:worldSlug` | Bảng điều khiển Thần | P17 | ✅ |
| `/world-trade` | Giao Thương Liên Thế Giới | P18 | ✅ |
| `/passport` | Hộ Chiếu Du Hành | P19 | ✅ |
| `/prophecy` | Thần Khải & Tiên Tri | P20 | ✅ |
| `/isekai` | Cổng Xuyên Không | P21 | ✅ |
| `/fate` | Mệnh Số & Vận Mệnh | P22 | ✅ |
| `/auction` | Nhà Đấu Giá | P23 | ✅ |
| `/titles` | Hệ Thống Danh Hiệu | P24 | ✅ |
| `/pets` | Đồng Hành (Pet System) | P25 | ✅ |
| `/world-economy` | Kinh Tế Thế Giới | P26 | ✅ |
| `/diplomacy` | Ngoại Giao Liên Thế Giới | P27 | ✅ |
| `/world-war` | Chiến Tranh Thế Giới | P28 | ✅ |
| `/world-theme` | Theme Thế Giới (15 preset + AI) | P29 | ✅ |
| `/governance` | Quản Trị Thế Giới | P30 | ✅ |
| `/disasters` | Thiên Tai & Phúc Lộc | P31 | ✅ |
| `/bank` | Ngân Hàng Liên Thế Giới | P32 | ✅ |
| `/bounties` | Bảng Truy Nã | P33 | ✅ |
| `/tournament` | Đại Hội Võ Lâm | P34 | ✅ |
| `/realestate` | Bất Động Sản Thế Giới | P35 | ✅ |
| `/fair` | Hội Chợ Thế Giới | P36 | ✅ |
| `/citizenship` | Di Dân & Quốc Tịch | P37 | ✅ |
| `/expedition` | Thám Hiểm Nhóm | P38 | ✅ |
| `/world-skills` | Kỹ Năng Quốc Gia | P39 | ✅ |
| `/legends` | Điện Truyền Thuyết | P40 | ✅ |

---

## 📝 GHI CHÚ KỸ THUẬT

- **Auth:** Replit Auth OIDC — KHÔNG dùng Supabase. Cookie session qua `express-session`.
- **DB:** Drizzle ORM + PostgreSQL. Schema thay đổi → `pnpm --filter @workspace/db run push`
- **AI:** Gemini 2.0 Flash Lite — model `gemini-2.0-flash-lite`, key `GEMINI_API_KEY`
- **Backend rebuild:** Không hot-reload — restart workflow "API Server" sau mỗi lần sửa
- **EXP formula:** `level = floor(totalExp / 100) + 1`
- **Battle EXP:** win = `enemyLevel × 10`, draw = `×3`, lose = `0`
- **World constants:** `artifacts/ai-world-system/src/lib/worlds.ts`
- **Enemy templates:** `artifacts/ai-world-system/src/lib/enemies.ts`
- **Narrative data:** `artifacts/ai-world-system/src/lib/narrative.ts`

---

## ⚡ HƯỚNG DẪN CHI TIẾT CHO AGENT

### Bước 1 — Khởi động môi trường
```
configureWorkflow("API Server", "PORT=8080 pnpm --filter @workspace/api-server run dev", port 8080)
configureWorkflow("Frontend", "pnpm --filter @workspace/ai-world-system run dev", port 5000, webview)
```

### Bước 2 — Xác định task tiếp theo
```
- Quét ROADMAP từ Phase 1 xuống, tìm [ ] đầu tiên chưa làm
- Nếu task thuộc loại "Bảng DB mới" → phải chạy:
    pnpm --filter @workspace/db run push
  sau khi thêm schema
- Nếu task thuộc loại "API mới" → thêm route + đăng ký vào routes/index.ts + restart API Server
- Nếu task thuộc loại "Trang FE mới" → tạo page + thêm vào App.tsx + thêm nút Dashboard
- Nếu KHÔNG CÒN task [ ] nào:
    1. Phân tích hệ thống: đọc routes, DB schema, trang FE đã có
    2. Đề xuất ≥5 tính năng mới phù hợp vision (ví dụ: cơ chế mới, cải thiện AI, social, economy...)
    3. Thêm vào ROADMAP thành Phase mới với task [ ] chi tiết
    4. BUILD NGAY phase đó — không hỏi user
```

### Bước 3 — Build
```
- Đọc các file liên quan trước khi viết code (match pattern hiện tại)
- Chạy song song các file không phụ thuộc nhau
- Không tạo mock data — build chức năng thật
- Toàn bộ UI bằng tiếng Việt, aesthetic: cyber cultivation tối tăm (cyan/red/purple trên nền đen)
```

### Bước 4 — Hoàn thành
```
- Đánh [x] task vừa xong trong file này
- Cập nhật bảng "TRẠNG THÁI BẢNG DB" nếu có bảng mới
- Cập nhật bảng "TRẠNG THÁI ROUTE" nếu có route mới
- Cập nhật dòng "Cập nhật lần cuối" ở đầu file
- Tiếp tục task tiếp theo NGAY (không dừng lại hỏi user)
```

### Quy tắc bất biến
```
✅ Auto-build tất cả task [ ] khi mở project — không hỏi user
✅ Schema thay đổi → pnpm --filter @workspace/db run push NGAY
✅ Backend sửa → restart workflow "API Server" NGAY
✅ Frontend Vite hot-reload tự động — không cần restart
✅ Dùng Replit Auth, KHÔNG dùng Supabase
✅ AI dùng Gemini 2.0 Flash Lite (GEMINI_API_KEY)
❌ KHÔNG tạo file README mới, KHÔNG thêm comment thừa
❌ KHÔNG hỏi user trước khi build task đã rõ ràng trong roadmap
```

*Cập nhật file này ngay sau khi hoàn thành mỗi tính năng.*

---

## ════════════════════════════════════════════════════════
## 🌦️ ROADMAP MỞ RỘNG VŨ TRỤ (PHASES 46–50)
## ════════════════════════════════════════════════════════

> **Triết lý:** Các phase 46–50 mở rộng chiều sâu của thế giới sống — thời tiết động, kinh tế caravan, kho tàng tri thức, lễ hội mùa vụ, và đấu trường thần lực liên thế giới. Mỗi feature làm cho "thế giới" thực sự sống như một thực thể.

---

### ════════════════════════════════════════
### PHASE 46 — THỜI TIẾT ĐỘNG (DYNAMIC WORLD WEATHER) ✅
### ════════════════════════════════════════

**Mục tiêu:** Mỗi thế giới có thời tiết riêng thay đổi mỗi 8–12 giờ. AI sinh narrative theo lore thế giới. Thời tiết ảnh hưởng trực tiếp đến EXP, vàng, thu hoạch và sức chiến đấu. Người chơi phải theo dõi thời tiết để tối ưu chiến lược.

- [x] Bảng DB `world_weather` (id, worldSlug, weatherType, weatherName, intensity, description, aiNarrative, effects jsonb, isActive, startsAt, endsAt, generatedAt)
- [x] 10 loại thời tiết: clear/rain/storm/fog/blizzard/heatwave/thunderstorm/aurora/sandstorm/blessing_sky
- [x] AI (Gemini) sinh tên thời tiết theo lore + narrative 2 câu
- [x] Effects: expMult/goldMult/harvestMult/battleMult (0.3 – 5.0x)
- [x] Auto-expire weather khi endsAt qua
- [x] API GET /api/weather/:worldSlug — thời tiết hiện tại + lịch sử 10 gần nhất
- [x] API GET /api/weather/all/active — tất cả thế giới weather active
- [x] API POST /api/weather/generate/:worldSlug — tạo thời tiết mới (force hoặc auto)
- [x] Trang `/weather` — bản đồ thời tiết 3 thế giới, multiplier badge, lịch sử, bảng ý nghĩa
- [x] Nút Dashboard "THỜI TIẾT THẾ GIỚI"

---

### ════════════════════════════════════════
### ════════════════════════════════════════
### PHASE 46.5 — WORLD SIMULATION ENGINE (THẾ GIỚI TỰ SỐNG) ✅
### ════════════════════════════════════════

**Mục tiêu:** Simulation engine chạy nền — thế giới tự vận hành mà không cần user trigger. Mỗi 60 phút: dân số biến động, kinh tế fluctuate, tâm trạng NPC thay đổi, 28% cơ hội sự kiện ngẫu nhiên (15 loại). AI sinh biên niên sử cho mỗi sự kiện. Đây là nền tảng để thế giới thực sự "sống".

- [x] Bảng DB `world_sim_state` (worldSlug, worldName, theme, population, economyScore, avgMood, stability, totalTicks, lastTickAt, isActive)
- [x] Bảng DB `world_sim_log` (worldSlug, tickNumber, eventType, eventName, summary, aiNarrative, deltaPopulation, deltaEconomy, deltaMood, deltaStability, happenedAt)
- [x] 15 loại sự kiện: economic_boom/recession, political_crisis, rebellion, natural_wonder, plague, harvest_festival, mysterious_arrival, ancient_discovery, trade_boom, inter_world_war, hero_born, villain_rises, peace_treaty, migration_wave
- [x] Mean reversion logic — chỉ số kéo về baseline (economyScore→50, avgMood→60, stability→70)
- [x] Disaster + weather modifier — thiên tai/thời tiết ảnh hưởng delta trực tiếp
- [x] AI (Gemini) sinh narrative 2-3 câu mỗi sự kiện theo lore thế giới
- [x] Server heartbeat: `setInterval(tickAllWorlds, 60min)` trong index.ts — tự động sau 15s server start
- [x] API GET /api/simulation/state/:worldSlug — trạng thái hiện tại
- [x] API GET /api/simulation/logs/:worldSlug — lịch sử ticks (limit 20)
- [x] API GET /api/simulation/feed — biên niên sử toàn cầu (60 sự kiện)
- [x] API GET /api/simulation/all — tất cả world states
- [x] API POST /api/simulation/tick/:worldSlug — tick thủ công 1 thế giới
- [x] API POST /api/simulation/tick/all — tick toàn bộ thế giới
- [x] Trang `/simulation` — 3 world cards (stats bars, dân số, ticks), biên niên sử global feed, nút TICK TẤT CẢ
- [x] Nút Dashboard "SIM ENGINE — THẾ GIỚI TỰ SỐNG"

---

### PHASE 47 — CARAVAN LIÊN THẾ GIỚI (INTER-WORLD CARAVAN)
### ════════════════════════════════════════

**Mục tiêu:** Player tổ chức đoàn thương nhân vận chuyển tài nguyên từ thế giới này sang thế giới khác để kiếm lời. Caravan có thể bị cướp bởi player khác trong tuyến đường nguy hiểm. AI sinh câu chuyện hành trình.

- [x] Bảng DB `caravans` (id, leaderId, leaderName, fromWorld, toWorld, cargo jsonb, guards, status, route, aiNarrative, departedAt, arrivesAt, goldReward)
- [x] Bảng DB `caravan_raids` (id, caravanId, raiderId, raiderName, success, loot jsonb, battleLog, raidedAt)
- [x] 4 tuyến đường: Tu Tiên↔Cyberpunk, Cyberpunk↔Hoang Phế, Tu Tiên↔Hoang Phế, vòng 3 thế giới
- [x] AI sinh hành trình caravan — rủi ro ngẫu nhiên (bandits/disasters/weather)
- [x] API CRUD caravans + raid endpoint
- [x] Trang `/caravan` — tạo caravan, theo dõi hành trình, lịch sử
- [x] Nút Dashboard "CARAVAN LIÊN THẾ GIỚI"

---

### ════════════════════════════════════════
### PHASE 48 — THƯ VIỆN CỔ ĐẠI (ANCIENT KNOWLEDGE LIBRARY)
### ════════════════════════════════════════

**Mục tiêu:** Mỗi thế giới tích lũy "lore entries" từ player khám phá, battle, và AI sinh. Player nghiên cứu để mở kỹ năng ẩn/vật phẩm bí ẩn/cảnh giới đặc biệt. Thư viện là "trí nhớ sống" của thế giới.

- [x] Bảng DB `knowledge_entries` (id, worldSlug, title, category, content, aiGenerated, discoveredBy, rarity, unlockCost, timesStudied, createdAt)
- [x] Bảng DB `player_research` (id, characterId, entryId, studiedAt, bonusUnlocked)
- [x] AI sinh lore entry từ battle history + world events
- [x] 5 category: history/skills/items/monsters/realms
- [x] API CRUD + research endpoint
- [x] Trang `/library` — thư viện thế giới, browse/search entries, nghiên cứu
- [x] Nút Dashboard "THƯ VIỆN CỔ ĐẠI"

---

### ════════════════════════════════════════
### PHASE 49 — LỄ HỘI THEO MÙA (SEASONAL FESTIVALS)
### ════════════════════════════════════════

**Mục tiêu:** Mỗi mùa (3 tháng thực) thế giới có lễ hội riêng — event đặc biệt, quest giới hạn thời gian, boss mùa, phần thưởng cosmetic độc quyền. AI sinh lore lễ hội theo chủ đề thế giới.

- [x] Bảng DB `seasonal_festivals` (id, worldSlug, season, festivalName, theme, startDate, endDate, rewards jsonb, aiNarrative, participantCount, isActive)
- [x] Bảng DB `festival_participations` (id, festivalId, characterId, tasksCompleted, rewardsClaimed, joinedAt)
- [x] 4 mùa: Xuân/Hạ/Thu/Đông (auto-rotate theo calendar)
- [x] AI sinh tên lễ hội + narrative + 3 quest đặc biệt
- [x] Phần thưởng cosmetic (title/pet skin/avatar frame) độc quyền theo mùa
- [x] API CRUD festivals + participation
- [x] Trang `/festival` — lễ hội hiện tại, task list, đếm ngược, leaderboard mùa
- [x] Nút Dashboard "LỄ HỘI THEO MÙA"

---

### ════════════════════════════════════════
### PHASE 52 — LÃNH THỔ (TERRITORY SYSTEM)
### ════════════════════════════════════════

**Mục tiêu:** Hội nhóm NPC sở hữu lãnh thổ, thu hoạch tài nguyên, nhật ký lịch sử.

- [x] Bảng DB `territories` (id, worldSlug, name, type, ownerFactionId, population, prosperity, security, lastHarvestAt)
- [x] Bảng DB `territory_resources` (id, territoryId, resourceType, amount)
- [x] Bảng DB `territory_logs` (id, territoryId, event, createdAt)
- [x] 5 loại: village / district / city / farmland / harbor
- [x] Faction claim lãnh thổ
- [x] Thu hoạch: farmland→thực phẩm+gỗ; harbor→cá+vàng; city→vàng+công cụ; district→vàng; village→thực phẩm+dân công
- [x] Prosperity multiplier ảnh hưởng sản lượng thu hoạch
- [x] API: GET /api/territories/:worldSlug, POST seed/:worldSlug, POST /:id/claim, POST harvest/:worldSlug
- [x] Trang `/territories` — 4 stat cards, khởi tạo/thu hoạch, expandable card (tài nguyên/chủ/nhật ký)
- [x] Nút Dashboard "LÃNH THỔ"

### ════════════════════════════════════════
### PHASE 51 — HỘI NHÓM NPC (NPC FACTION SYSTEM)
### ════════════════════════════════════════

**Mục tiêu:** NPC tự thành lập hội nhóm dựa trên quan hệ và nghề nghiệp. Hội nhóm có thủ lĩnh, quỹ, ký ức.

- [x] Bảng DB `npc_factions` (id, worldSlug, name, type, leaderNpcId, treasury, reputation, createdAt, updatedAt)
- [x] Bảng DB `npc_faction_members` (id, factionId, npcId, role, joinedAt)
- [x] Bảng DB `npc_faction_memories` (id, npcId, factionId, content, createdAt)
- [x] 5 loại faction: merchant_guild / farming_clan / military_order / criminal_group / noble_house
- [x] Formation rule: 3+ NPC quan hệ >70 cùng nghề → tự thành lập
- [x] Bầu lãnh đạo theo wealth + số kết nối quan hệ
- [x] Thu phí 5% tài sản thành viên vào quỹ hội
- [x] Ký ức: "Gia nhập Hội Thương Nhân", "Được bầu làm thủ lĩnh"
- [x] API: GET /api/npc-factions/:worldSlug, POST auto-form/:worldSlug, POST collect-tribute/:worldSlug
- [x] Trang `/npc-factions` — stat cards, danh sách faction, expand chi tiết (thủ lĩnh/thành viên/ký ức)
- [x] Nút Dashboard "HỘI NHÓM NPC"

### ════════════════════════════════════════
### PHASE 50 — VŨ ĐÀI THẦN LỰC (DIVINE ARENA)
### ════════════════════════════════════════

**Mục tiêu:** Đấu trường liên thế giới — player từ các thế giới khác nhau chiến đấu trong arena thần thánh. Mỗi trận có rule set riêng theo lore (Tu Tiên: kiếm khí; Cyberpunk: mech; Hoang Phế: survival). AI sinh narrative trận đấu sử thi. Top player được phong "Thần Đấu".

- [x] Bảng DB `divine_arena_matches` (id, challenger, challengerWorld, defender, defenderWorld, ruleSet, winnerId, aiNarrative, expReward, goldReward, matchedAt, completedAt)
- [x] Bảng DB `divine_arena_rankings` (id, characterId, characterName, worldSlug, wins, losses, divinePoints, tier, rank, updatedAt)
- [x] 3 rule set theo thế giới: cultivation_duel/cyber_duel/wasteland_survival
- [x] AI sinh narrative trận đấu 4-6 câu theo lore thế giới đối kháng
- [x] Matchmaking: ghép cặp ngẫu nhiên cross-world, có thể challenge cụ thể
- [x] Tier system: Đồng/Bạc/Vàng/Bạch Kim/Kim Cương/Thần
- [x] API CRUD arena + matchmaking + rankings
- [x] Trang `/divine-arena` — matchmaking, trận đấu, bảng xếp hạng thần lực
- [x] Nút Dashboard "VŨ ĐÀI THẦN LỰC"

### ════════════════════════════════════════
### PHASE 51 — NGOẠI GIAO CHÍNH PHỦ NPC
### ════════════════════════════════════════

**Mục tiêu:** Hệ thống ngoại giao giữa các chính phủ NPC — liên minh, hiệp ước, tuyên chiến, ký ức ngoại giao, AI tự điều chỉnh quan hệ.

- [x] Bảng DB `diplomatic_relations` (id, governmentAId, governmentBId, relationScore -100..+100, relationType, createdAt, updatedAt)
- [x] Bảng DB `diplomatic_treaties` (id, governmentAId, governmentBId, treatyType, startDate, endDate, status)
- [x] Bảng DB `diplomatic_memories` (id, governmentId, targetGovId, event, scoreChange, createdAt)
- [x] 6 loại quan hệ: đồng_minh/thân_thiện/trung_lập/căng_thẳng/thù_địch/chiến_tranh
- [x] 5 loại hiệp ước: liên_minh/thương_mại/viện_trợ/phòng_thủ_chung/đình_chiến
- [x] 6 hành động ngoại giao: gửi_viện_trợ/đề_nghị_liên_minh/ký_thương_mại/áp_đặt_cấm_vận/nhượng_lãnh_thổ/tuyên_chiến
- [x] AI tự điều chỉnh quan hệ: thương mại/tranh chấp lãnh thổ/khác biệt phe phái
- [x] Ký ức ngoại giao tự động cho cả 2 bên sau mỗi hành động
- [x] Auto-treaty: đề nghị liên minh/thương mại/đình chiến → tạo treaty 30 ngày
- [x] Tuyên chiến → hủy tất cả treaty đang hoạt động
- [x] Fix bug: thiếu `/api/auth/register` + `/api/auth/login` → "Không thể kết nối máy chủ"
- [x] API: GET /api/npc-diplomacy, POST init/action/ai-tick, GET memory/:govId
- [x] Trang `/npc-diplomacy` (4 tab: QUAN HỆ/HIỆP ƯỚC/KÝ ỨC/HÀNH ĐỘNG)
- [x] Nút Dashboard "NGOẠI GIAO NPC"

### ════════════════════════════════════════
### PHASE 52.5 — HỆ THỐNG BẢN ĐỒ THẾ GIỚI
### ════════════════════════════════════════

**Mục tiêu:** Bản đồ SVG tương tác — hiển thị lãnh thổ, phe phái, chiến tranh, player agent di chuyển.

- [x] Schema: thêm cột `x`, `y`, `terrain` vào `territories`
- [x] Schema: thêm cột `current_territory_id` vào `player_agents`
- [x] Schema mới: `army_movements` (warId, fromTerritoryId, toTerritoryId, armySize, status, progress)
- [x] DB push thành công (`pnpm --filter @workspace/db run push`)
- [x] API: `GET /world-map/:worldSlug` — territories + factions + governments + wars + players
- [x] API: `POST /world-map/:worldSlug/seed` — tạo x,y,terrain ngẫu nhiên cho lãnh thổ
- [x] API: `GET /world-map/territory/:id` — chi tiết 1 lãnh thổ
- [x] API: `POST /world-map/player/move` — player agent di chuyển tới lãnh thổ
- [x] API: `GET /world-map/player/me` — lấy danh sách agent của user hiện tại
- [x] API: `GET /world-map/:worldSlug/armies` — army movements đang hoạt động
- [x] Trang `/world-map`: SVG bản đồ hex 1000×620 — pan/zoom chuột, tooltip hover, sidebar chi tiết
- [x] Hiển thị màu địa hình (Đồng Bằng/Núi Cao/Rừng Sâu/Sa Mạc/Biển Cả/Đầm Lầy/Núi Lửa)
- [x] Hiển thị màu phe phái sở hữu (palette 12 màu từ faction.id hash)
- [x] Icon loại lãnh thổ: 🏙 thành phố / 🏘 làng / 🌾 nông trại / ⚓ cảng / 🏰 pháo đài
- [x] Hiển thị dân số/thịnh vượng/an ninh: statbars trong panel + mini bars trên map
- [x] Chiến tranh: đường dashed đỏ có animation giữa 2 thủ đô, badge cảnh báo
- [x] Player marker: icon 👤 glowing cyan trên lãnh thổ hiện tại
- [x] Di chuyển player: click lãnh thổ → "Di Chuyển Đến Đây" → POST /world-map/player/move
- [x] Panel chi tiết: faction, chính phủ, thuế suất, ngân khố, tọa độ, số player đang ở

### ════════════════════════════════════════
### PHASE 52 — HỆ THỐNG QUÂN ĐỘI NPC
### ════════════════════════════════════════

**Mục tiêu:** Mỗi chính phủ NPC có quân đội riêng — tuyển quân, huấn luyện, tiếp tế, AI chiến lược. Sức mạnh quân sự ảnh hưởng ngoại giao và kinh tế.

- [x] Bảng DB `military_forces` (id, governmentId, territoryId, armyName, totalSoldiers, morale, trainingLevel, supplyLevel, militaryPower, createdAt, updatedAt)
- [x] Bảng DB `military_memories` (id, npcId, armyId, content, createdAt)
- [x] Schema export từ `lib/db/src/schema/index.ts`
- [x] DB push thành công (`pnpm --filter @workspace/db run push`)
- [x] Thành lập quân đội: mỗi chính phủ 1 đội, 20–80 chiến binh ban đầu, tên theo lore
- [x] Tuyển quân: NPC đủ điều kiện (tuổi≥18/năng lượng≥50/không đói>70), chính sách "Mở Rộng Quân Sự" tăng tỷ lệ
- [x] Huấn luyện: tăng trainingLevel (+0.1–0.2/tick), tốn ngân sách
- [x] Tiếp tế: tiêu thực phẩm+ngân sách, đủ tiếp tế → morale+supply tăng, thiếu → giảm mạnh
- [x] Full Tick: tuyển + huấn luyện + tiếp tế cùng lúc
- [x] AI chiến lược: Gemini 2.0 Flash Lite phân tích tình hình → 3 quyết định chiến lược tiếng Việt
- [x] Sức mạnh = soldiers × morale × training × supply / 10 (công thức cân bằng)
- [x] API: GET `/military/:worldSlug`, POST establish/recruit/train/supply/tick/ai-decision
- [x] Trang `/military` (selector 3 thế giới, 6 action cards, stat summary, bảng quân đội, ký ức chiến trường, quy tắc hệ thống)
- [x] Nút Dashboard "QUÂN ĐỘI NPC" (Sword icon)
- [x] FIX: routes dùng `/military/...` không phải `/api/military/...` (app mount `/api` rồi)
