---
name: Phases 46-50 roadmap
description: Phase 46 THỜI TIẾT ĐỘNG complete; phases 47-50 pending with [ ] tasks in TIENTRINHHETHONG.md
---

## Phase 46 — THỜI TIẾT ĐỘNG ✅ (complete 2026-06-17)

- Table: `world_weather` (pushed to DB)
- Schema export: `lib/db/src/schema/worldWeather.ts`
- Route file: `artifacts/api-server/src/routes/worldWeather.ts`
  - GET /api/weather/:worldSlug
  - GET /api/weather/all/active
  - POST /api/weather/generate/:worldSlug
- Page: `artifacts/ai-world-system/src/pages/WeatherPage.tsx` → route `/weather`
- Dashboard button added: CloudLightning icon, label "THỜI TIẾT THẾ GIỚI"
- DashboardPage.tsx needed CloudLightning added to lucide-react imports (was missing)

## Phase 46.5 — WORLD SIMULATION ENGINE ✅ (2026-06-17)

- Tables: `world_sim_state` + `world_sim_log` (pushed to DB)
- Route: `artifacts/api-server/src/routes/worldSimulation.ts` — exports `tickAllWorlds`
- Heartbeat: `artifacts/api-server/src/index.ts` imports `tickAllWorlds`, setInterval 60min after 15s delay
- Page: `/simulation` — WorldSimulationPage.tsx
- Dashboard: Activity icon, "SIM ENGINE — THẾ GIỚI TỰ SỐNG"
- Bug fix: `/api/simulation/all` was ordering by `worldSimLog.happenedAt` instead of `worldSimState.lastTickAt`

## Phase 52 — LÃNH THỔ ✅ (complete 2026-06-17)

- Tables: `territories`, `territory_resources`, `territory_logs` (pushed to DB)
- Schema: `lib/db/src/schema/territories.ts` — references `npcFactions.id` for ownerFactionId
- Route: `artifacts/api-server/src/routes/territories.ts`
  - GET /api/territories/:worldSlug
  - POST /api/territories/seed/:worldSlug (idempotent, 5 territories)
  - POST /api/territories/:id/claim (body: { factionId })
  - POST /api/territories/harvest/:worldSlug (prosperity multiplier)
- Harvest config: farmland→food+wood, harbor→fish+gold, city→gold+tools, district→gold, village→food+labor
- Page: `/territories` — TerritoryPage.tsx, expandable cards with resources/owner/logs
- Dashboard: Map icon, label "LÃNH THỔ"

## Phase 51 — HỘI NHÓM NPC ✅ (complete 2026-06-17)

- Tables: `npc_factions`, `npc_faction_members`, `npc_faction_memories` (pushed to DB)
- Schema: `lib/db/src/schema/npcFactions.ts`, exported from `lib/db/src/schema/index.ts`
- Route: `artifacts/api-server/src/routes/npcFactions.ts`
  - GET /api/npc-factions/:worldSlug
  - POST /api/npc-factions/auto-form/:worldSlug (formation: 3+ NPC same job, rel>70)
  - POST /api/npc-factions/collect-tribute/:worldSlug (5% wealth tithe)
- Leader election: wealth + relationship network size score
- Page: `/npc-factions` — NPCFactionPage.tsx, expandable faction cards
- Dashboard button: Shield icon, label "HỘI NHÓM NPC"

## Phases 47-50 — pending [ ] in TIENTRINHHETHONG.md

- Phase 47: CARAVAN LIÊN THẾ GIỚI — tables: caravans, caravan_raids
- Phase 48: THƯ VIỆN CỔ ĐẠI — tables: knowledge_entries, player_research
- Phase 49: LỄ HỘI THEO MÙA — tables: seasonal_festivals, festival_participations
- Phase 50: VŨ ĐÀI THẦN LỰC — tables: divine_arena_matches, divine_arena_rankings

**Why:** Phases 46-50 added as new roadmap section in TIENTRINHHETHONG.md after all 45 prior phases were complete.
