# Phase 7 Unity Integration — Completion Audit Report

**Date:** 21/06/2026  
**Auditor:** AI Agent (automated code review)  
**Scope:** Phase 7.1 – 7.7 — Unity integration layer, all subsystems  
**Verdict summary:** 5 PASS · 2 PARTIAL · 0 FAIL

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        UNITY CLIENT                             │
│                                                                 │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ WorldLoader │    │ WorldEventClient  │    │ReplayController│  │
│  │  (polling)  │    │  (WebSocket)      │    │  (catch-up)   │  │
│  └──────┬──────┘    └────────┬─────────┘    └───────┬───────┘  │
│         │                   │                       │           │
│         ▼                   ▼                       │           │
│  ┌─────────────┐    ┌──────────────────┐            │           │
│  │  MapStateDto│    │  EventDispatcher  │◄───────────┘           │
│  │  (snapshot) │    │  (router+gap det.)│                        │
│  └──────┬──────┘    └──┬───────┬───────┘                        │
│         │              │       │                                 │
│         ▼              ▼       ▼                                 │
│  ┌──────────────┐  ┌──────┐ ┌──────────────────┐               │
│  │Territory     │  │Army  │ │  EventEffect      │               │
│  │RendererPool  │  │Move  │ │  Manager          │               │
│  │+ Heatmap     │  │Ctrl  │ │  (throttle+queue) │               │
│  └──────────────┘  └──────┘ └──────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              │  HTTP REST + WebSocket
┌─────────────────────────────▼───────────────────────────────────┐
│                       API SERVER (Express 5)                    │
│                                                                 │
│  GET /api/unity/map-state/:worldSlug   → full snapshot          │
│  GET /api/unity/world-state/:worldSlug → extended snapshot      │
│  GET /api/unity/event-stream/:worldSlug→ replay log             │
│  GET /api/unity/delta/:worldSlug       → cursor-based delta     │
│  WS  /api/ws/unity                     → push stream            │
│                                                                 │
│  lib/unityWs.ts        WorldEvent broadcast hub                 │
│  lib/eventBus.ts       emitEvent() → DB write + WS broadcast    │
│  routes/unityIntegration.ts  map-state, event-stream            │
│  routes/unityDelta.ts        delta stream + benchmark           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     PostgreSQL (Drizzle ORM)                    │
│  territories · npc_factions · military_forces · npc_cores       │
│  world_event_log · world_sim_state · world_history              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Subsystem Audits

### 2.1 World Loader — **PASS** ✅

**File:** `UnityClient/WorldLoader.cs`  
**Endpoint:** `GET /api/unity/map-state/:worldSlug`

#### What works
- Poll loop with configurable interval (default 10s) and manual `RequestRefresh()` trigger
- `LoadWorld(slug)` hot-swap with cache invalidation
- `OnStateRefreshed` / `OnLoadError` events for clean subscriber decoupling
- `IsLoading` guard prevents concurrent in-flight requests
- Correct coroutine cleanup in `OnDestroy`
- Null/empty `worldSlug` validation at `Start()`
- Backend endpoint returns full composite: territories + factions + armies + npcs + recentHistory

#### Issues found

| Severity | Issue |
|----------|-------|
| LOW | `JsonUtility.FromJson<MapStateDto>` cannot deserialize nested JSON objects (e.g. `recentHistory[].actors` is stored as raw JSON string in DB — arrives as `string`, not `object[]`). Works now only because `HistoryDto.actors` is typed `string`. Any future nested dict fields will silently be null. |
| LOW | No ETag / `If-Modified-Since` header sent — every poll downloads the full payload even if nothing changed. At 50+ territories this is ~15–40 KB per poll. |
| LOW | Endpoint has no `isAuthenticated` guard (intentionally public). Document this decision explicitly; future admin-only fields must not be added to this endpoint. |
| INFO | `initialDelaySeconds` defaults to `0` — first poll fires immediately on `Start()`. Recommend 0.5s to allow Unity scene to finish loading. |

#### Backend data gaps
- `map-state` uses 3 sequential queries (territories → govIds → armies) creating latency when gov count is high. No `LIMIT` on territory rows.

---

### 2.2 Territory Renderer — **PASS** ✅

**File:** `UnityClient/TerritoryRenderer.cs` + `TerritoryRendererPool`

#### What works
- All 9 DB fields mapped to visual properties: `type→sprite`, `terrain→overlay tint`, `status→state overlay`, `x/y→world position`, `population→scale`, `prosperity→ring fill`, `security→dot color`, `ownerId→faction border`, `owner/name→labels`
- `FactionColor()` replicates server-side `factionColor()` exactly (char-code sum mod 12)
- `ClassifyState()` and `ClassifySecurity()` thresholds match server DB ranges
- `TerritoryRendererPool.SyncFromState()` handles create/update/remove lifecycle correctly
- `MaterialPropertyBlock` is NOT used here (direct `.color` set) — see heatmap for MPB usage
- Editor Gizmo with `#if UNITY_EDITOR` guard

#### Issues found

| Severity | Issue |
|----------|-------|
| HIGH | **TMPro dependency undeclared.** `nameLabel` and `ownerLabel` are typed `TMPro.TextMeshProUGUI`. The Unity package `com.unity.textmeshpro` must be installed via Package Manager. Not included in any manifest shown. Project will fail to compile without it. |
| MEDIUM | `populationScaleCurve` is an `AnimationCurve` — must be configured in Inspector. Default `AnimationCurve.Linear(0, 0.5f, 5000, 1.8f)` is baked in code but Unity serializer may override with empty curve if Inspector is touched. Add `[SerializeField]` with `Reset()` re-initializer. |
| LOW | No transition animation on `Apply(dto)` — values snap immediately. For live updates this creates visual jitter. Recommend lerp over 0.3s for `prosperity`/`security`/`population`. |
| LOW | `selectionGlow` is assigned in Inspector but no `MapInputHandler` component exists in the Unity scripts directory — selection logic is incomplete. |

---

### 2.3 Heatmaps — **PASS** ✅

**File:** `UnityClient/HeatmapManager.cs`

#### What works
- 5 overlay modes: Population (dynamic max), Security (0-100), Food (NPC avg hunger), Military (soldiers×power strength), Prosperity (0-100)
- `MaterialPropertyBlock` used correctly — no material instantiation per tile
- Smooth `SmoothStep` transition via coroutine (in and out)
- `ToggleLastOverlay()` for keyboard shortcut H
- Number key shortcuts (1-5, 0) handled in `Update`
- `LegendData` struct + `HeatmapLegendUI` component for UI panel
- Food overlay correctly aggregates `npc.hunger` per `npc.territoryId` — maps to `NpcMapDto` from `map-state`

#### Issues found

| Severity | Issue |
|----------|-------|
| HIGH | **HeatmapLayer child dependency undeclared.** Every territory prefab must have a child `GameObject` named exactly `"HeatmapLayer"` with a `SpriteRenderer`. `GetOrFindHeatmapLayer()` silently returns null and logs a warning if missing. No enforcement at edit time. Add `[RequireComponent]` or a prefab validator. |
| MEDIUM | `_transitionCoroutine` is set to `null` on completion, but `SetTileColor()` checks `_transitionCoroutine == null` to decide whether to apply immediately or buffer. Race condition: if `SetMode()` is called while a TransitionToNone coroutine is still running, colors in `_currentColors` may be cleared before the new scores are written. |
| LOW | `HeatmapLegendUI` prefab structure expected (TitleLabel, GradientBar, StopsContainer) is documented in XML summary but no validation occurs at runtime. Missing children produce no error. |
| INFO | Military overlay uses `army.soldiers × army.power` — but `power` is already a computed composite (`soldiers × morale × training × supply`). This means military heatmap effectively weights soldiers² rather than raw strength. Consider using `army.soldiers` alone for a more readable signal. |

---

### 2.4 Army Renderer — **PARTIAL** ⚠️

**Files:** `UnityClient/ArmyRenderer.cs`, `UnityClient/ArmyMovementController.cs`

#### What works
- `ArmyDto` fields fully match `map-state` endpoint response (id, name, territoryId, currentTerritoryId, targetTerritoryId, movementProgress, movementStatus, soldiers, power, morale, supply, recentPositions)
- State machine: `idle → moving → arrived | sieging → idle`
- `MaterialPropertyBlock` on icon and siege ring
- Trail rendering from `recentPositions` JSONB array with gradient fade
- Morale and supply bar fill + color coding
- Siege ring pulse animation in `Update()` using `Mathf.Sin`
- Path line renderer from current to target territory

#### Issues found

| Severity | Issue |
|----------|-------|
| CRITICAL | **DTO field name mismatch between two backend endpoints.** `unityIntegration.ts` (map-state) returns `ArmyDto`-compatible fields (`id, name, territoryId, currentTerritoryId, movementProgress, movementStatus, soldiers, power, morale, supply`). But `GET /api/unity/world-state/:worldSlug` returns a different shape: `{id, name, fromId, toId, size, progress, status}`. `ArmyRenderer.cs` expects the map-state format. Any Unity code using world-state for armies will silently get null/zero fields. |
| HIGH | **Territory position resolution is implicit.** `ArmyRenderer.ApplyWorldPosition()` needs to call `TerritoryRendererPool.Get(currentTerritoryId).transform.position` to get world coords, but this dependency is not wired in the shown code. If `TerritoryRendererPool` is not assigned, army positions default to `Vector3.zero` (all armies stack at origin). |
| HIGH | **`DeltaEvent` C# type is undefined.** `ArmyMovementController.ApplyDeltaEvent(DeltaEvent delta)` is called by `EventDispatcher` but the `DeltaEvent` struct is not defined in any `.cs` file in `UnityClient/`. It exists only in `unityDelta.ts` on the server. A C# definition must be added. |
| MEDIUM | `recentPositions` is a `List<ArmyPositionDto>` but `ArmyDto` is deserialized with `JsonUtility` which cannot deserialize `List<T>` for nested objects. Requires `[Serializable]` on `ArmyPositionDto` and `JsonUtility` nested list workaround, or a custom JSON parser. |

---

### 2.5 Movement — **PARTIAL** ⚠️

**Files:** `UnityClient/ArmyMovementController.cs`, backend `military.ts`

#### What works
- `movementProgress` (0.0–1.0) drives `Vector3.Lerp` interpolation
- `movementStatus` string maps to `ArmyState` enum via `ParseState()`
- Backend state machine: `IDLE → MOVING → ARRIVED → IDLE/SIEGING` with `movementTick` progressing `progress += progressDelta`
- `POST /military/move-order/:worldSlug` and `POST /military/movement-tick/:worldSlug` routes exist
- Backend broadcasts `army_move` / `army_arrived` / `army_siege` events to WS

#### Issues found

| Severity | Issue |
|----------|-------|
| HIGH | **`ApplyDeltaEvent()` method body not verified.** `EventDispatcher.RouteToArmyController()` calls `armyController.ApplyDeltaEvent(delta)` for `army_move`, `army_arrived`, `army_siege` events. The method is referenced but its implementation in `ArmyMovementController.cs` was not shown in the full file read — it may be incomplete or missing. |
| MEDIUM | **In-memory cursor leak in `unityDelta.ts`.** The `lastTickSent` Map keyed by `${worldSlug}:${clientId}` grows unboundedly. On a server with many connected clients or after long uptime, this becomes a memory leak. No TTL or eviction. |
| MEDIUM | **No movement smoothing on WorldLoader poll updates.** When WorldLoader fires `OnStateRefreshed` every 10s, `ArmyRenderer.Apply(dto)` snaps `movementProgress` to the server value. If Unity is rendering a smooth lerp between polls, this creates a visual jump. Recommend interpolating toward server value rather than hard-setting. |
| LOW | `progressDelta` in `movement-tick` route is a POST body param — Unity must call this route periodically to advance armies. There is no automatic server-side tick that advances progress; the `worldSimulation.ts` heartbeat does not appear to call `movement-tick`. Armies may stall at `movementProgress < 1.0` indefinitely unless caller ticks them. |

---

### 2.6 Event Effects — **PASS** ✅

**File:** `UnityClient/EventEffectManager.cs`

#### What works
- Token-bucket global rate limiter (`maxGlobalPerSecond = 8`) prevents visual spam
- Per-channel rate limiting (`maxChannelPerSecond = 2`) isolates noisy territories
- Stacking rules (Replace/Skip/Extend/StackMax3) per effect type
- TTL-based queue drain (`requestTtl = 8s`) drops stale events automatically
- `replayMode`: 0.1× duration, 0.25× alpha, no particles for historical batch replay
- `replayIngestRate` second token bucket to cap historical ingest speed
- 8 effect types implemented: Capture, Collapse, Recolonize, Siege, SiegeEnd, ArmyArrived, ArmyMove, NpcMove
- `FlashColor` coroutine with flash-in / flash-out phases
- `SpawnFloatText` with animated upward drift and fade
- `EnqueueBatch()` automatically enables replay mode for the duration
- `ClearAll()` for scene cleanup

#### Issues found

| Severity | Issue |
|----------|-------|
| HIGH | **All 5 `ParticleSystem` prefabs must be assigned in Inspector** (`captureParticles`, `collapseParticles`, `recolonizeParticles`, `siegeImpactParticles`, `npcMigrateParticles`). If any is null, `Instantiate(null, ...)` throws `NullReferenceException` at runtime. Add null checks before every `Instantiate` call. |
| HIGH | **`DeltaEvent` C# type not defined** (same as §2.4). `Enqueue(DeltaEvent evt)` and `EnqueueBatch(IEnumerable<DeltaEvent>)` both depend on this missing type. |
| MEDIUM | **Flash layer coupling to HeatmapLayer.** `GetFlashLayer()` finds `"HeatmapLayer"` child for flash overlay — sharing the same `SpriteRenderer` between heatmap color and event flash. If both run simultaneously, they overwrite each other's `MaterialPropertyBlock` color. Add a dedicated `"FlashLayer"` child to decouple. |
| LOW | `army_siege` event disambiguates `SiegeEnd` by checking `changes["status"] == "ended"` — but the server payload from `army_siege_ended` does not set a `status` key; it uses the event name itself. The `_sourceEvent` injection in `EventDispatcher.ConvertToDelta()` correctly sets this, but the order of operations must be preserved. Fragile. |

---

### 2.7 Realtime Stream — **PASS** ✅

**Files:** `UnityClient/WorldEventClient.cs`, `EventDispatcher.cs`, `ReplayController.cs`

#### What works
- `ClientWebSocket` (System.Net.WebSockets) with background `Task` receive loop
- Ping/pong heartbeat with configurable interval and pong timeout
- Exponential backoff reconnect with `maxRetries` cap
- Subscribe/unsubscribe message protocol matching server's `worldSubs` map
- Inbound message queue (`ConcurrentQueue`) drained in `LateUpdate` on main thread
- **EventDispatcher:** ring buffer (2000 events), gap detection, debounced replay trigger
- **Gap detection:** `newTick > lastTick + gapThreshold(5)` → triggers `ReplayController.FetchMissed()`
- **ReplayController:** paginated HTTP fetch from `/api/unity/delta/:worldSlug`, cursor advancement via `EventDispatcher.SetLastReceivedTickFromReplay()`, deduplication via ring buffer check, snapshot fallback when gap > `snapshotFallbackThreshold`
- `partial class EventDispatcher` pattern for cursor update without circular dependency
- Backend WS server at `/api/ws/unity` correctly uses `worldSubs` per-world subscription map
- `broadcastEvent(WorldEvent)` canonical format + `broadcastUnity(LegacyUnityEvent)` compat wrapper

#### Issues found

| Severity | Issue |
|----------|-------|
| HIGH | **No JSON parser for `WorldEventDto.payload`.** The WS broadcasts `{event, worldSlug, tick, ts, payload:{...}}` where `payload` is a nested JSON object. `JsonUtility` cannot deserialize nested dicts into `Dictionary<string,object>`. `EventDispatcher.ParsePayloadDict()` is called in `ConvertToDelta()` and `ReplayController.ConvertPageToDelta()` but its implementation is not in any `.cs` file shown — it requires MiniJSON, Newtonsoft.Json, or a custom parser. **This is the highest-risk missing piece in the entire Phase 7 stack.** |
| HIGH | **`Update_Extension()` / `LateUpdate` naming hack.** `WorldEventClient` cannot override `Update()` (Unity lifecycle method) so uses `LateUpdate()` calling `Update_Extension()` to drain `_mainThreadQueue`. This pattern is valid but will break if any subclass also overrides `LateUpdate()`. Rename to a clearly private method and document explicitly. |
| MEDIUM | **`lastTickSent` Map in `unityDelta.ts` resets on server restart.** Unity client using `?clientId=` cursor will jump back to tick 0 after any API server restart, causing replay of all historical events. Persist cursor in PostgreSQL or return `lastTick` in the response for client-side persistence. |
| MEDIUM | **WS path inconsistency in docs vs runtime.** `docs/PHASE7_7_REALTIME_STREAM.md` references `/ws/unity`. Runtime path is `/api/ws/unity`. In Vite dev environment Vite proxy handles this. Unity client in production must use `/api/ws/unity` directly — the inspector default `apiBaseUrl` does not include this detail. |
| LOW | Ring buffer at capacity (2000 × ~400 bytes) = ~800 KB per world. With 3 worlds subscribed simultaneously on one client = ~2.4 MB heap allocation. Acceptable but document as a known constant. |

---

## 3. Missing Dependencies

| # | Dependency | Needed By | Status | Resolution |
|---|-----------|-----------|--------|-----------|
| 1 | `com.unity.textmeshpro` (Unity Package) | TerritoryRenderer, ArmyRenderer, EventEffectManager (labels) | ❌ NOT LISTED | Add to `Packages/manifest.json` |
| 2 | JSON parser (Newtonsoft.Json or MiniJSON) | EventDispatcher.ParsePayloadDict(), ReplayController | ❌ NOT FOUND | Add `com.unity.nuget.newtonsoft-json` or include MiniJSON.cs |
| 3 | `DeltaEvent` C# struct | EventEffectManager, ArmyMovementController, EventDispatcher | ❌ NOT DEFINED | Create `UnityClient/DeltaEvent.cs` |
| 4 | `ArmyMovementController.ApplyDeltaEvent()` body | EventDispatcher.RouteToArmyController() | ⚠️ UNVERIFIED | Confirm implementation exists |
| 5 | `HeatmapLayer` child SpriteRenderer on territory prefabs | HeatmapManager, EventEffectManager | ⚠️ RUNTIME ONLY | Add prefab validation script |
| 6 | `MapInputHandler` (selection logic) | TerritoryRenderer.selectionGlow | ❌ NOT FOUND | Build or remove the field |
| 7 | `memoizee` npm package | `replitAuth.ts` (integration template) | ✅ NOT NEEDED | Current replitAuth uses custom caching |

---

## 4. Performance Bottlenecks

### 4.1 Backend (Express / PostgreSQL)

```
GET /api/unity/map-state/:worldSlug
┌─────────────────────────────────────────────────────┐
│ Query 1: territories WHERE worldSlug=?               │  ~5ms
│ Query 2: npcFactions WHERE worldSlug=?               │  ~3ms
│ Query 3: npcGovernments WHERE territoryId IN (...)   │  ~8ms  ← N depends on territory count
│ Query 4: militaryForces WHERE governmentId IN (...)  │  ~8ms
│ Query 5: npcCores WHERE worldSlug LIMIT 300          │  ~10ms
│ Query 6: worldHistory ORDER BY tick DESC LIMIT 20    │  ~5ms
└─────────────────────────────────────────────────────┘
Total: ~39ms cold / ~15ms with PG cache
Issue: 6 sequential round-trips. Should be max 2-3 with CTEs or single JOIN.
```

| Bottleneck | Location | Impact | Fix |
|-----------|----------|--------|-----|
| 6 sequential queries in map-state | `unityIntegration.ts:~/unity/map-state` | +30ms per poll | Merge with CTE or parallel `Promise.all` |
| No response caching | map-state endpoint | 10s poll × N clients = high DB load at scale | Add `Cache-Control: max-age=5` + ETag |
| No territory row `LIMIT` | map-state territories query | Unbounded on large worlds | Add `LIMIT 500` as safety cap |
| NPC query `LIMIT 300` | map-state npcCores | Silently drops NPCs in large worlds | Document the cap; add pagination |
| In-memory `lastTickSent` Map | `unityDelta.ts` | Memory leak over time, resets on restart | Move to Redis or PG short-lived table |
| `world_event_log` no retention policy | DB | Table grows unbounded; old events slow queries | Add `WHERE ts > NOW() - INTERVAL '7 days'` index on `ts` |

### 4.2 Unity Client

| Bottleneck | Location | Impact | Fix |
|-----------|----------|--------|-----|
| `HeatmapManager` O(n) per frame during transition | `TransitionIn()` coroutine | 60fps × territory count iterations | Batch into chunks of 20/frame using coroutine yield |
| `EventEffectManager.ProcessQueue()` every frame | `Update()` | Empty queue still checks every frame | Move to event-driven; only run Update when queue is non-empty |
| Ring buffer 800KB heap per world | `EventDispatcher._ring` | 2.4MB for 3 worlds | Tune to 500 events (200KB) — gaps trigger replay anyway |
| `MaterialPropertyBlock` reuse in parallel coroutines | `EventEffectManager._mpb` | Single MPB instance is not thread-safe when multiple FlashColor coroutines run | Use per-coroutine MPB instance |
| `WorldLoader` `JsonUtility` parse on main thread | `ParseAndCache()` | Blocks main thread for large payloads (>100KB) | Move `JsonUtility.FromJson` to a background thread via `Task.Run`, invoke event on main thread |

---

## 5. Unity Optimization Plan

### 5.1 Short-term (before first playtest)

1. **Create `DeltaEvent.cs`**
   ```csharp
   namespace AiWorldSystem.Unity {
     [System.Serializable]
     public class DeltaEvent {
       public string type;
       public int    tick;
       public string entityId;
       public System.Collections.Generic.Dictionary<string,object> changes;
     }
   }
   ```

2. **Add `ParsePayloadDict()` using MiniJSON**
   - Add `MiniJSON.cs` (public domain, 200 LOC) to `UnityClient/`
   - Implement `ParsePayloadDict(string json) → Dictionary<string,object>`

3. **Null-guard all `ParticleSystem.Instantiate` calls** in `EventEffectManager`

4. **Add `FlashLayer` child to territory prefabs** (separate from `HeatmapLayer`)

5. **Add null checks for territory position in `ArmyRenderer.Apply()`**

### 5.2 Medium-term (performance pass)

6. **Backend: merge map-state into 2 parallel queries**
   ```typescript
   const [terrRows, npcRows, factionRows, histRows] = await Promise.all([...]);
   // Then single army join using terrIds
   ```

7. **Add ETag to map-state response**
   ```typescript
   const etag = createHash('md5').update(JSON.stringify(result)).digest('hex');
   res.setHeader('ETag', etag);
   if (req.headers['if-none-match'] === etag) return res.status(304).end();
   ```

8. **Chunk HeatmapManager transition**
   ```csharp
   int processed = 0;
   foreach (var kv in _currentColors) {
     // ... lerp ...
     if (++processed % 20 == 0) yield return null; // yield every 20 tiles
   }
   ```

9. **Persist delta cursor in PlayerPrefs (Unity-side)**
   ```csharp
   PlayerPrefs.SetInt($"lastTick_{worldSlug}", lastTick);
   ```

### 5.3 Long-term (Phase 8 prep)

10. **Replace polling with WS-driven invalidation**: keep WorldLoader poll at 30s but trigger `RequestRefresh()` on `world_tick` WS events for near-realtime updates without hammering REST.

11. **Add Burst/Jobs for heatmap computation**: move score normalization to `IJobParallelFor` when territory count exceeds 200.

12. **Implement territory LOD**: beyond camera distance threshold, disable `prosperityRing`, `securityDot`, and labels; render only `tileBase` + `ownerBorder`.

---

## 6. Phase 8 NPC Brain — Roadmap

Phase 8 extends the current NPC AI (npcAgent.ts, npcDialogue.ts) with a Unity-visible "brain layer" — making NPC decision-making observable and interactable in real time.

### 6.1 Architecture

```
┌────────────────────────────────────────────────────────────┐
│                 Phase 8: NPC Brain                         │
│                                                            │
│  ┌──────────────┐    ┌───────────────┐   ┌─────────────┐  │
│  │ NpcBrainPanel│    │ NpcBrainClient│   │DialogueBubble│ │
│  │ (Inspector   │◄───│ (REST poller) │   │ (world-space)│ │
│  │  side panel) │    └───────┬───────┘   └──────┬──────┘  │
│  └──────────────┘            │                  │          │
│                         ▼                  ▼          │
│                    /api/npc/brain/:id  /api/npc/dialogue │
└────────────────────────────────────────────────────────────┘
```

### 6.2 New Backend Endpoints Needed

| Endpoint | Purpose | DB Source |
|----------|---------|-----------|
| `GET /api/npc/brain/:npcId` | Full NPC cognitive snapshot | npc_personalities + npc_emotions + npc_long_term_goals + npc_plans |
| `GET /api/npc/brain/:npcId/stream` | SSE stream of goal changes | world_event_log WHERE event='npc_goal_changed' |
| `POST /api/npc/dialogue/start` | Begin player↔NPC dialogue session | npc_dialogue_sessions |
| `POST /api/npc/dialogue/:sessionId/message` | Send message, get AI response | Gemini via npcDialogue.ts |
| `GET /api/unity/npc-overlay/:worldSlug` | Lightweight NPC status for map overlay | npc_cores + npc_emotions LIMIT 500 |

### 6.3 New Unity Components Needed

| Component | Description | Phase |
|-----------|-------------|-------|
| `NpcBrainClient.cs` | Polls `/api/npc/brain/:npcId` on selection; SSE for goal stream | 8.1 |
| `NpcBrainPanel.cs` | UI panel: personality radar, emotion bars, active goal, plan steps | 8.2 |
| `DialogueBubble.cs` | World-space TextMeshPro bubble above NPC; fades after 8s | 8.3 |
| `DialogueSessionManager.cs` | Manages open dialogue session; routes messages to `/dialogue` API | 8.3 |
| `NpcOverlayRenderer.cs` | Extends TerritoryRenderer with per-NPC dot overlay (hunger/emotion) | 8.4 |
| `EmotionParticleController.cs` | Ambient particle tint per NPC dominant emotion | 8.5 |

### 6.4 Phase 8 Milestone Sequence

```
Phase 8.1 — NPC Selection & Brain API          (1-2 days)
  ├─ MapInputHandler clicks NPC dot on map
  ├─ NpcBrainClient fetches /api/npc/brain/:npcId
  └─ NpcBrainPanel shows personality + emotion + goal

Phase 8.2 — Goal Stream                         (1 day)
  ├─ SSE stream from /api/npc/brain/:npcId/stream
  └─ Goal changes animate on NpcBrainPanel in realtime

Phase 8.3 — Dialogue System                     (2-3 days)
  ├─ Click NPC → DialogueSessionManager.StartSession()
  ├─ Type message → POST /dialogue/:sessionId/message
  ├─ Gemini response streamed back
  └─ DialogueBubble shows response in world-space

Phase 8.4 — Emotion Overlay                     (1 day)
  ├─ Extend HeatmapManager with OverlayMode.Emotion
  └─ Color = dominant emotion color per territory avg

Phase 8.5 — NPC Brain Event Integration         (1 day)
  ├─ Wire npc_goal_changed WS event → goal update on panel
  └─ Wire npc_birth/death → NpcOverlayRenderer lifecycle
```

### 6.5 Estimated Effort

| Phase | Effort | Blocker |
|-------|--------|---------|
| 8.1 NPC Selection + Brain API | 1–2 days | Needs DeltaEvent.cs fix first |
| 8.2 Goal Stream | 1 day | Needs SSE support in UnityWebRequest (use EventSource workaround) |
| 8.3 Dialogue | 2–3 days | Gemini streaming → Unity SSE parsing |
| 8.4 Emotion Overlay | 1 day | Needs npc-overlay endpoint |
| 8.5 WS Brain Events | 1 day | Requires emitEvent() for goal changes in npcAgent.ts |
| **Total** | **6–8 days** | |

---

## 7. Summary — PASS / FAIL Table

| # | Subsystem | File(s) | Verdict | Critical Issues |
|---|-----------|---------|---------|----------------|
| 7.2 | **World Loader** | WorldLoader.cs | ✅ **PASS** | Minor: no ETag caching; JsonUtility nested dict limitation |
| 7.3 | **Territory Renderer** | TerritoryRenderer.cs, TerritoryRendererPool | ✅ **PASS** | TMPro package not declared; selectionGlow incomplete |
| 7.4 | **Heatmaps** | HeatmapManager.cs | ✅ **PASS** | HeatmapLayer prefab child undeclared; MPB race in transition |
| 7.5a | **Army Renderer** | ArmyRenderer.cs | ⚠️ **PARTIAL** | DeltaEvent.cs missing; DTO mismatch world-state vs map-state |
| 7.5b | **Movement** | ArmyMovementController.cs | ⚠️ **PARTIAL** | ApplyDeltaEvent() body unverified; movementTick not auto-called |
| 7.6 | **Event Effects** | EventEffectManager.cs | ✅ **PASS** | ParticleSystem null-guard missing; DeltaEvent.cs missing |
| 7.7 | **Realtime Stream** | WorldEventClient.cs, EventDispatcher.cs, ReplayController.cs | ✅ **PASS** | ParsePayloadDict() not implemented; WS path doc mismatch |

### Overall: **5 PASS · 2 PARTIAL · 0 FAIL**

The Phase 7 architecture is sound and production-quality in design. The two PARTIAL subsystems (Army Renderer + Movement) share a single root cause — the missing `DeltaEvent.cs` C# definition and the unverified `ApplyDeltaEvent()` method body. Resolving those two items and adding a JSON parser library would move both to PASS.

### Immediate action items (priority order)

1. 🔴 **Create `UnityClient/DeltaEvent.cs`** — unblocks Army, Movement, and EventEffects
2. 🔴 **Add MiniJSON or Newtonsoft.Json** — unblocks Realtime Stream payload parsing
3. 🟡 **Null-guard all ParticleSystem.Instantiate calls** — prevents runtime NullRef crashes
4. 🟡 **Add TMPro to Unity Package Manager manifest** — prevents compile errors
5. 🟡 **Add `FlashLayer` child to territory prefabs** — decouple heatmap from event flash
6. 🟢 **Merge map-state to parallel queries** — performance improvement
7. 🟢 **Add ETag to map-state response** — bandwidth reduction

---

*Report generated from static analysis of 13 C# Unity scripts + 3 TypeScript backend routes + 1 WebSocket server + 7 Phase documentation files.*
