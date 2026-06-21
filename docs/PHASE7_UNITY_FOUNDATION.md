# PHASE 7.1 — Unity Foundation
> Integration plan, C# architecture, DTO models, and event subscription design  
> for connecting Unity client to the AI World System backend.
>
> **Status:** Documentation only — no production code modified.  
> **Date:** June 2026 | **Author:** Phase 7.1 Audit

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Backend API Audit](#2-backend-api-audit)
3. [WebSocket Event Stream Audit](#3-websocket-event-stream-audit)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
5. [Unity Folder Structure](#5-unity-folder-structure)
6. [C# DTO Models](#6-c-dto-models)
7. [C# Script Architecture](#7-c-script-architecture)
8. [Event Subscription Architecture](#8-event-subscription-architecture)
9. [Update Loop Architecture](#9-update-loop-architecture)
10. [Class Diagrams](#10-class-diagrams)
11. [WebSocket Flow](#11-websocket-flow)
12. [Implementation Phases](#12-implementation-phases)
13. [Known Constraints & Gotchas](#13-known-constraints--gotchas)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI WORLD SYSTEM                               │
│                                                                     │
│  ┌──────────────┐     REST/HTTP      ┌──────────────────────────┐   │
│  │   Unity 3D   │ ◄────────────────► │  Express API (port 8080) │   │
│  │   Client     │                    │  88+ route files          │   │
│  │              │ ◄── WebSocket ───► │  /api/ws/unity           │   │
│  └──────────────┘   ws://host/       └──────────┬───────────────┘   │
│                     api/ws/unity                │                   │
│                                                 │ Drizzle ORM        │
│  ┌──────────────┐                    ┌──────────▼───────────────┐   │
│  │  React/Vite  │ ◄────────────────► │  PostgreSQL              │   │
│  │  Frontend    │     REST + WS      │  (Replit managed)        │   │
│  │  (port 5000) │                    │  ~120 tables             │   │
│  └──────────────┘                    └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Architecture Facts
- Backend runs on **port 8080**; all routes prefixed `/api/`
- WebSocket server lives at `ws://host/api/ws/unity` (same HTTP server, different path)
- Auth is **Replit OIDC** (session cookie); Unity must either use a service account session cookie or call un-authenticated endpoints only
- **World simulation ticks** are triggered by `POST /api/simulation/tick/:worldSlug` (requires auth) — Unity observes but does not drive ticks
- Event log is capped at **100,000 events per world** (pruned automatically)
- Delta cursor is **in-memory on the server** — if server restarts, Unity must resync from `lastTick=0` or use the HTTP event-stream endpoint

---

## 2. Backend API Audit

### 2.1 Unity-Specific Endpoints

All endpoints live in `artifacts/api-server/src/routes/unityIntegration.ts` and `unityDelta.ts`.

---

#### `GET /api/unity/world-state/:worldSlug`
**Purpose:** Full world snapshot for Unity scene initialization.  
**Auth:** None required  
**Response:**
```json
{
  "worldSlug": "cultivation",
  "ts": 1719000000000,
  "npcs": [ NpcDTO[] ],
  "territories": [ TerritoryDTO[] ],
  "govs": [ GovDTO[] ],
  "wars": [ WarDTO[] ],
  "armies": [ ArmyDTO[] ],
  "players": [ PlayerDTO[] ]
}
```
**Limits:** NPCs capped at 500. Use on scene load only — expensive (6 JOIN queries).  
**Recommended cadence:** Once on connect, then switch to delta stream.

---

#### `GET /api/unity/map-state/:worldSlug`
**Purpose:** Lighter political-map snapshot — territories + factions + armies + recent history.  
**Auth:** None required  
**Response:**
```json
{
  "worldSlug": "cultivation",
  "ts": 1719000000000,
  "territories": [ TerritoryMapDTO[] ],
  "factions": [ FactionDTO[] ],
  "armies": [ ArmyMapDTO[] ],
  "npcs": [ NpcMapDTO[] ],
  "recentHistory": [ HistoryItemDTO[] ]
}
```
**Limits:** NPCs capped at 300.  
**Recommended cadence:** Poll every 10–15 seconds for map view only. Prefer delta for live state.

---

#### `GET /api/unity/world-events/:worldSlug`
**Purpose:** Aggregated recent events from 4 sources: `world_events`, `npc_births`, `elections`, `diplomatic_memories`.  
**Auth:** None required  
**Query params:**
- `limit` — default 50, max 200
- `since` — ISO 8601 timestamp filter

**Response:**
```json
{
  "worldSlug": "cultivation",
  "ts": 1719000000000,
  "count": 42,
  "events": [ WorldEventDTO[] ]
}
```

---

#### `GET /api/unity/ws-info`
**Purpose:** WebSocket connection documentation + event schema reference.  
**Auth:** None required  
**Static response** — use for integration verification.

---

#### `GET /api/unity/event-stream/:worldSlug`
**Purpose:** Replay-safe event log query. Used for catch-up after reconnect.  
**Auth:** None required  
**Query params:**
- `sinceTick` — default 0 (return events with tick ≥ N)
- `sinceTs` — Unix ms (overrides sinceTick if set)
- `limit` — default 200, max 500
- `event` — filter to one event type (e.g. `territory_capture`)

**Response:**
```json
{
  "worldSlug": "cultivation",
  "count": 38,
  "sinceTick": 100,
  "events": [ WorldEventLogRow[] ]
}
```
**Note:** Reads from `world_event_log` table (up to 100k rows per world).

---

#### `GET /api/unity/event-stream/:worldSlug/latest`
**Purpose:** Last N events — initial WS catch-up on page load.  
**Auth:** None required  
**Query params:** `limit` — default 50, max 200  

---

#### `GET /api/unity/delta/:worldSlug` ⭐ *Primary polling endpoint*
**Purpose:** Delta-only events since last cursor. Server remembers cursor per `clientId`.  
**Auth:** None required  
**Query params:**
- `clientId` — persistent client identifier (server stores cursor in memory)
- `lastTick` — fallback explicit cursor if no clientId
- `limit` — default 200, max 1000

**Response:**
```json
{
  "worldSlug": "cultivation",
  "lastTickSent": 142,
  "previousCursor": 100,
  "count": 38,
  "events": [ DeltaEvent[] ]
}
```

---

#### `GET /api/unity/delta/:worldSlug/snapshot-size`
**Purpose:** Returns byte size of full-state snapshot for bandwidth diagnostics.  
**Auth:** None required

---

#### `POST /api/unity/delta/:worldSlug/benchmark`
**Purpose:** Compare full-state vs delta bandwidth for N ticks.  
**Auth:** Required (Replit session)  
**Body:** `{ "ticks": 1000 }`

---

### 2.2 Simulation Endpoints (Read-only for Unity)

From `artifacts/api-server/src/routes/worldSimulation.ts`:

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/simulation/state/:worldSlug` | ✅ | Current sim: population, economyScore, mood, stability, totalTicks |
| `GET /api/simulation/logs/:worldSlug` | ✅ | Sim event log (world_sim_log table) |
| `GET /api/simulation/history/:worldSlug` | ❌ | World history events (collapse/capture/recolonize) |
| `GET /api/simulation/history/:worldSlug/timeline` | ❌ | Compact timeline array — ideal for Unity timeline bar |
| `GET /api/simulation/snapshots/:worldSlug` | ❌ | List of snapshot ticks available |
| `GET /api/simulation/snapshot/:worldSlug/:tick` | ❌ | Full snapshot JSON at or before a tick |
| `GET /api/simulation/analytics/:worldSlug` | ❌ | Time-series from snapshots (population, prosperity, armies) |
| `GET /api/simulation/territory-detail/:worldSlug/:id` | ❌ | Full territory detail + army + history |
| `GET /api/simulation/faction-timeline/:worldSlug/:factionId` | ❌ | Faction history from snapshots |

### 2.3 Territory & Military Endpoints (Read + Write)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/territories/:worldSlug` | ✅ | All territories with resources |
| `GET /api/military/:worldSlug` | ✅ | Military overview: armies, movements, wars |
| `POST /api/military/attack/:worldSlug` | ✅ | Launch attack (player-driven) |
| `POST /api/military/move-order/:worldSlug` | ✅ | Issue movement order |

---

## 3. WebSocket Event Stream Audit

### 3.1 Connection

```
WebSocket URL:  ws://[replit-dev-domain]/api/ws/unity
```

> In Replit environment: domain is `$REPLIT_DEV_DOMAIN`, e.g.  
> `wss://ai-world-system.username.repl.co/api/ws/unity`

### 3.2 Protocol

**Subscribe:**
```json
{ "type": "subscribe", "worlds": ["cultivation", "cyberpunk"] }
```

**Server ACK:**
```json
{ "type": "subscribed", "worlds": ["cultivation"] }
```

**Ping/Pong:**
```json
{ "type": "ping" }  →  { "type": "pong" }
```

**Unsubscribe:**
```json
{ "type": "unsubscribe", "worlds": ["cultivation"] }
```

### 3.3 Canonical Event Format (all broadcasts)

```json
{
  "event":     "territory_capture",
  "worldSlug": "cultivation",
  "tick":      142,
  "ts":        1719000000000,
  "payload":   { "territoryId": "uuid", "capturedBy": "factionId" }
}
```

### 3.4 All Event Types Emitted

| Event Name | Source File | Trigger |
|-----------|-------------|---------|
| `territory_capture` | `military.ts` | Army wins attack |
| `territory_collapse` | `worldSimulation.ts` | Pop < 10 AND security < 15 |
| `territory_recolonized` | `worldSimulation.ts` | Overcrowded territory sends settlers to ruins |
| `army_move` | `military.ts` | Army movement tick completes |
| `army_arrived` | `military.ts` | Army reaches destination |
| `army_siege_started` | *(event name in schema)* | Siege begins |
| `army_siege_ended` | *(event name in schema)* | Siege resolves |
| `npc_migrate` | via eventBus | NPC changes territory |
| `npc_goal_changed` | via eventBus | NPC goal updates |
| `npc_birth` | `npcPopulation.ts` | NPC born |
| `npc_death` | via eventBus | NPC dies |
| `faction_created` | via eventBus | Faction created |
| `faction_leader_changed` | via eventBus | Faction leader changes |
| `election_result` | `npcElections.ts` | Election resolves |
| `diplomacy_action` | `npcDiplomacy.ts` | Diplomatic event |
| `world_war_start` | `worldWar.ts` | World war declared |
| `world_war_end` | `worldWar.ts` | World war concludes |
| `battle_result` | `battle.ts` | Player battle finishes |
| `world_tick` | via eventBus | Simulation tick fires |

### 3.5 Delta Event Format (HTTP polling fallback)

```json
{
  "type":     "territory_capture",
  "tick":     142,
  "entityId": "uuid-of-territory",
  "changes":  { "capturedBy": "factionId", "previousOwner": "factionId2" }
}
```

**Delta type mapping:**

| Delta type | Canonical events |
|-----------|-----------------|
| `npc_move` | npc_migrate, npc_goal_changed, npc_birth, npc_death |
| `territory_capture` | territory_capture |
| `territory_collapse` | territory_collapse |
| `territory_recolonized` | territory_recolonized |
| `army_move` | army_move |
| `army_arrived` | army_arrived |
| `army_siege` | army_siege_started, army_siege_ended |
| `faction_changed` | faction_leader_changed, election_result, diplomacy_action, world_war_start/end, battle_result |
| `world_tick` | world_tick, route_disrupted, route_restored |

---

## 4. Data Flow Diagrams

### 4.1 Initial Scene Load Flow

```
Unity Boot
│
├─► [1] GET /api/unity/world-state/:worldSlug
│        ↓ WorldSnapshotDTO
│        → Spawn all Territory GameObjects (pos from x,y)
│        → Spawn visible NPC dots (territory-level, not per-NPC)
│        → Build FactionRegistry (id → color, name)
│        → Build ArmyRegistry (id → position, size)
│        → Store lastTick = 0
│
├─► [2] GET /api/unity/event-stream/:worldSlug/latest?limit=50
│        ↓ Last 50 events from world_event_log
│        → Apply catch-up events to scene state
│        → Update lastTick = max(event.tick)
│
└─► [3] CONNECT ws://host/api/ws/unity
         → Send { "type": "subscribe", "worlds": [worldSlug] }
         → Begin real-time event processing
         → Scene is now live
```

### 4.2 Real-Time Update Flow (WebSocket active)

```
Server Simulation Tick
│
├─► emitEvent() / emitEventSync()
│     ├─ Writes to world_event_log (DB)
│     └─ broadcastEvent() → WebSocket → Unity
│
Unity Receives WS Message
│
├─ Parse WorldEvent { event, worldSlug, tick, ts, payload }
├─ Route to EventDispatcher
│   ├─ "territory_capture"  → TerritoryController.OnCapture(payload)
│   ├─ "territory_collapse" → TerritoryController.OnCollapse(payload)
│   ├─ "army_move"          → ArmyController.OnMove(payload)
│   ├─ "npc_migrate"        → NpcController.OnMigrate(payload)
│   └─ "world_tick"         → WorldTickController.OnTick(payload)
│
└─ Update lastTick = Math.max(lastTick, event.tick)
```

### 4.3 Reconnect / Catch-Up Flow

```
WebSocket Disconnects
│
├─ Store lastTick locally (PlayerPrefs or memory)
│
On Reconnect
│
├─► GET /api/unity/delta/:worldSlug?clientId=unity-1&lastTick={stored}
│     ↓ DeltaEvent[] since stored tick
│     → Apply all missed deltas in tick order
│     → Update lastTick = response.lastTickSent
│
└─► Reconnect WebSocket → re-subscribe
```

### 4.4 Hybrid Polling Fallback (WebSocket unavailable)

```
Every 2 seconds:
│
└─► GET /api/unity/delta/:worldSlug?clientId=unity-1
      ↓ DeltaEvent[] since server's stored cursor for this clientId
      → Apply changes
      → Server auto-advances cursor per clientId
```

---

## 5. Unity Folder Structure

```
Assets/
└── AIWorldSystem/
    ├── Core/
    │   ├── WorldManager.cs            — entry point, scene lifecycle
    │   ├── ApiClient.cs               — HTTP REST client (UnityWebRequest)
    │   ├── WsClient.cs                — WebSocket client (NativeWebSocket or best-ssl)
    │   ├── EventDispatcher.cs         — routes WorldEvent to domain handlers
    │   └── DeltaCursor.cs             — tracks lastTick, clientId per world
    │
    ├── Models/                        — C# DTO classes (auto-matches backend JSON)
    │   ├── WorldSnapshotDto.cs
    │   ├── TerritoryDto.cs
    │   ├── NpcDto.cs
    │   ├── GovDto.cs
    │   ├── WarDto.cs
    │   ├── ArmyDto.cs
    │   ├── PlayerDto.cs
    │   ├── WorldEventDto.cs
    │   ├── DeltaEventDto.cs
    │   ├── MapStateDto.cs
    │   └── SimulationStateDto.cs
    │
    ├── Controllers/
    │   ├── TerritoryController.cs     — owns all Territory GameObjects
    │   ├── FactionController.cs       — faction registry + color map
    │   ├── ArmyController.cs          — army movement animations
    │   ├── NpcController.cs           — NPC crowd simulation layer
    │   └── WorldTickController.cs     — tick counter, economy overlay
    │
    ├── UI/
    │   ├── MapOverlay.cs              — political map mode
    │   ├── InfoPanel.cs               — click → territory/faction detail
    │   ├── EventFeedUI.cs             — scrolling world events sidebar
    │   ├── TimelineBar.cs             — tick timeline with event markers
    │   └── ConnectionStatusUI.cs      — WS status indicator
    │
    ├── Prefabs/
    │   ├── Territory.prefab
    │   ├── Army.prefab
    │   ├── NpcDot.prefab
    │   └── EventMarker.prefab
    │
    ├── ScriptableObjects/
    │   ├── WorldConfig.asset          — worldSlug, server URL, poll interval
    │   ├── TerrainColorMap.asset      — terrain type → material
    │   └── FactionColorPalette.asset  — deterministic color from faction id
    │
    └── Scenes/
        ├── WorldMap.unity             — top-down political map
        ├── TerritoryDetail.unity      — zoomed territory view
        └── Loading.unity              — boot/connect scene
```

---

## 6. C# DTO Models

All models use `[JsonProperty]` from Newtonsoft.Json (or `[JsonPropertyName]` from System.Text.Json). Field names match backend JSON exactly.

### 6.1 WorldSnapshotDto.cs
```csharp
[Serializable]
public class WorldSnapshotDto
{
    [JsonProperty("worldSlug")]  public string WorldSlug;
    [JsonProperty("ts")]         public long   Ts;
    [JsonProperty("npcs")]       public NpcDto[]       Npcs;
    [JsonProperty("territories")] public TerritoryDto[] Territories;
    [JsonProperty("govs")]       public GovDto[]       Govs;
    [JsonProperty("wars")]       public WarDto[]        Wars;
    [JsonProperty("armies")]     public ArmyDto[]       Armies;
    [JsonProperty("players")]    public PlayerDto[]     Players;
}
```

### 6.2 TerritoryDto.cs
```csharp
[Serializable]
public class TerritoryDto
{
    [JsonProperty("id")]      public string Id;
    [JsonProperty("name")]    public string Name;
    [JsonProperty("type")]    public string Type;      // village/city/fortress/ruin
    [JsonProperty("pos")]     public PosDto  Pos;
    [JsonProperty("terrain")] public string Terrain;  // plains/forest/mountain/coast
    [JsonProperty("owner")]   public string Owner;    // faction name, null if unowned
    [JsonProperty("pop")]     public int    Pop;
    [JsonProperty("pros")]    public int    Pros;     // prosperity 0-100
    [JsonProperty("sec")]     public int    Sec;      // security 0-100
}

[Serializable]
public class PosDto
{
    [JsonProperty("x")] public float X;
    [JsonProperty("y")] public float Y;
}
```

### 6.3 NpcDto.cs
```csharp
[Serializable]
public class NpcDto
{
    [JsonProperty("id")]          public string Id;
    [JsonProperty("name")]        public string Name;
    [JsonProperty("pos")]         public PosDto  Pos;         // may be null
    [JsonProperty("territoryId")] public string TerritoryId; // null if homeless
    [JsonProperty("state")]       public string State;       // idle/working/moving/fighting/hungry/dead
    [JsonProperty("action")]      public string Action;      // currentGoal text
    [JsonProperty("emotion")]     public string Emotion;     // happy/angry/afraid/sad/confident/stressed/neutral
    [JsonProperty("occupation")]  public string Occupation;
    [JsonProperty("age")]         public int    Age;
}
```

### 6.4 GovDto.cs
```csharp
[Serializable]
public class GovDto
{
    [JsonProperty("id")]       public string  Id;
    [JsonProperty("name")]     public string  Name;      // territory name
    [JsonProperty("type")]     public string  Type;      // autocracy/democracy/theocracy/...
    [JsonProperty("treasury")] public int     Treasury;
    [JsonProperty("approval")] public float   Approval;  // 0-100
    [JsonProperty("taxRate")]  public float   TaxRate;
    [JsonProperty("leader")]   public string  Leader;    // NPC name, null if none
    [JsonProperty("army")]     public ArmyStatDto Army;  // null if no army
}

[Serializable]
public class ArmyStatDto
{
    [JsonProperty("soldiers")] public int   Soldiers;
    [JsonProperty("power")]    public float Power;
}
```

### 6.5 WarDto.cs
```csharp
[Serializable]
public class WarDto
{
    [JsonProperty("id")]         public string Id;
    [JsonProperty("attacker")]   public string Attacker;   // world name
    [JsonProperty("defender")]   public string Defender;   // world name
    [JsonProperty("status")]     public string Status;     // active/ended
    [JsonProperty("scoreA")]     public int    ScoreA;
    [JsonProperty("scoreD")]     public int    ScoreD;
    [JsonProperty("startedAt")]  public string StartedAt;  // ISO 8601
}
```

### 6.6 ArmyDto.cs
```csharp
[Serializable]
public class ArmyDto
{
    [JsonProperty("id")]       public string Id;
    [JsonProperty("name")]     public string Name;
    [JsonProperty("fromId")]   public string FromId;   // source territory UUID
    [JsonProperty("toId")]     public string ToId;     // destination territory UUID
    [JsonProperty("size")]     public int    Size;
    [JsonProperty("progress")] public float  Progress; // 0.0 – 1.0
    [JsonProperty("status")]   public string Status;   // moving/arrived/sieging
}
```

### 6.7 WorldEvent (WebSocket canonical)
```csharp
[Serializable]
public class WorldEvent
{
    [JsonProperty("event")]     public string Event;      // event type name
    [JsonProperty("worldSlug")] public string WorldSlug;
    [JsonProperty("tick")]      public int    Tick;
    [JsonProperty("ts")]        public long   Ts;         // Unix ms
    [JsonProperty("payload")]   public JObject Payload;  // dynamic payload
}
```

### 6.8 DeltaEvent (HTTP delta polling)
```csharp
[Serializable]
public class DeltaEvent
{
    [JsonProperty("type")]     public string  Type;      // delta type (npc_move, etc.)
    [JsonProperty("tick")]     public int     Tick;
    [JsonProperty("entityId")] public string  EntityId;  // UUID of affected entity
    [JsonProperty("changes")]  public JObject Changes;   // what changed
}

[Serializable]
public class DeltaResponse
{
    [JsonProperty("worldSlug")]      public string       WorldSlug;
    [JsonProperty("lastTickSent")]   public int          LastTickSent;
    [JsonProperty("previousCursor")] public int          PreviousCursor;
    [JsonProperty("count")]          public int          Count;
    [JsonProperty("events")]         public DeltaEvent[] Events;
}
```

### 6.9 MapStateDto.cs (for map-state endpoint)
```csharp
[Serializable]
public class MapStateDto
{
    [JsonProperty("worldSlug")]     public string              WorldSlug;
    [JsonProperty("ts")]            public long                Ts;
    [JsonProperty("territories")]   public TerritoryMapDto[]   Territories;
    [JsonProperty("factions")]      public FactionDto[]        Factions;
    [JsonProperty("armies")]        public ArmyMapDto[]        Armies;
    [JsonProperty("npcs")]          public NpcMapDto[]         Npcs;
    [JsonProperty("recentHistory")] public HistoryItemDto[]    RecentHistory;
}

[Serializable]
public class TerritoryMapDto
{
    [JsonProperty("id")]         public string Id;
    [JsonProperty("name")]       public string Name;
    [JsonProperty("type")]       public string Type;
    [JsonProperty("x")]          public float  X;
    [JsonProperty("y")]          public float  Y;
    [JsonProperty("terrain")]    public string Terrain;
    [JsonProperty("status")]     public string Status;     // active/ruins
    [JsonProperty("population")] public int    Population;
    [JsonProperty("prosperity")] public int    Prosperity;
    [JsonProperty("security")]   public int    Security;
    [JsonProperty("owner")]      public string Owner;      // faction name, may be null
    [JsonProperty("ownerId")]    public string OwnerId;    // faction UUID, may be null
}

[Serializable]
public class FactionDto
{
    [JsonProperty("id")]        public string Id;
    [JsonProperty("name")]      public string Name;
    [JsonProperty("type")]      public string Type;
    [JsonProperty("influence")] public int    Influence;
    [JsonProperty("treasury")]  public int    Treasury;
}
```

### 6.10 SimulationStateDto.cs
```csharp
[Serializable]
public class SimulationStateDto
{
    [JsonProperty("worldSlug")]    public string WorldSlug;
    [JsonProperty("population")]   public int    Population;
    [JsonProperty("economyScore")] public float  EconomyScore;  // 0-100
    [JsonProperty("avgMood")]      public float  AvgMood;       // 0-100
    [JsonProperty("stability")]    public float  Stability;     // 0-100
    [JsonProperty("totalTicks")]   public int    TotalTicks;
    [JsonProperty("isActive")]     public bool   IsActive;
}
```

---

## 7. C# Script Architecture

### 7.1 `WorldManager.cs` — Scene Lifecycle Controller

```csharp
// Singleton. Orchestrates boot sequence and holds global state.
public class WorldManager : MonoBehaviour
{
    public static WorldManager Instance { get; private set; }

    [Header("Config")]
    public WorldConfig Config;           // ScriptableObject: worldSlug, serverUrl

    [Header("Controllers")]
    public TerritoryController Territories;
    public FactionController   Factions;
    public ArmyController      Armies;
    public NpcController       Npcs;
    public WorldTickController Tick;

    [Header("Network")]
    public ApiClient  Api;
    public WsClient   Ws;
    public DeltaCursor Cursor;

    // Boot sequence
    private async void Start();          // calls InitAsync()
    private async Task InitAsync();      // [1] world-state → [2] event-stream/latest → [3] WS connect
    private void OnDestroy();            // disconnect WS
}
```

### 7.2 `ApiClient.cs` — HTTP REST

```csharp
public class ApiClient : MonoBehaviour
{
    private string _baseUrl;   // e.g. "https://host.repl.co/api"

    // Generic GET → deserialize to T
    public async Task<T> Get<T>(string path, Dictionary<string,string> query = null);

    // Generic POST with JSON body
    public async Task<T> Post<T>(string path, object body);

    // Convenience wrappers
    public Task<WorldSnapshotDto>   GetWorldState(string worldSlug);
    public Task<MapStateDto>        GetMapState(string worldSlug);
    public Task<DeltaResponse>      GetDelta(string worldSlug, string clientId, int lastTick = 0);
    public Task<EventStreamDto>     GetEventStreamLatest(string worldSlug, int limit = 50);
    public Task<SimulationStateDto> GetSimulationState(string worldSlug);
    public Task<TerritoryDetailDto> GetTerritoryDetail(string worldSlug, string territoryId);
    public Task<List<TimelineItem>> GetTimeline(string worldSlug);
}
```

### 7.3 `WsClient.cs` — WebSocket

```csharp
public class WsClient : MonoBehaviour
{
    public event Action<WorldEvent> OnEvent;
    public event Action            OnConnected;
    public event Action<string>    OnDisconnected;

    private WebSocket _ws;
    private string    _worldSlug;

    public async Task Connect(string wsUrl, string worldSlug);
    public void Subscribe(string worldSlug);
    public void Disconnect();
    public bool IsConnected { get; }

    private void OnMessage(byte[] data);    // parses WorldEvent, fires OnEvent
    private void OnClose(WebSocketCloseCode code);   // triggers reconnect logic
    private async Task ReconnectLoop();     // exponential backoff: 1s, 2s, 4s, max 30s
}
```

### 7.4 `EventDispatcher.cs` — Event Router

```csharp
public class EventDispatcher : MonoBehaviour
{
    [SerializeField] private TerritoryController _territories;
    [SerializeField] private ArmyController      _armies;
    [SerializeField] private NpcController       _npcs;
    [SerializeField] private WorldTickController _tick;
    [SerializeField] private EventFeedUI         _feed;
    [SerializeField] private DeltaCursor         _cursor;

    // Called by WsClient.OnEvent
    public void Dispatch(WorldEvent evt)
    {
        _cursor.Update(evt.Tick);

        switch (evt.Event)
        {
            case "territory_capture":    _territories.OnCapture(evt.Payload);    break;
            case "territory_collapse":   _territories.OnCollapse(evt.Payload);   break;
            case "territory_recolonized":_territories.OnRecolonize(evt.Payload); break;
            case "army_move":            _armies.OnMove(evt.Payload);            break;
            case "army_arrived":         _armies.OnArrived(evt.Payload);         break;
            case "army_siege_started":   _armies.OnSiegeStart(evt.Payload);      break;
            case "army_siege_ended":     _armies.OnSiegeEnd(evt.Payload);        break;
            case "npc_migrate":          _npcs.OnMigrate(evt.Payload);           break;
            case "npc_birth":            _npcs.OnBirth(evt.Payload);             break;
            case "npc_death":            _npcs.OnDeath(evt.Payload);             break;
            case "election_result":      _territories.OnElection(evt.Payload);   break;
            case "world_tick":           _tick.OnTick(evt.Payload);              break;
            case "world_war_start":      _territories.OnWarStart(evt.Payload);   break;
            case "world_war_end":        _territories.OnWarEnd(evt.Payload);     break;
            case "battle_result":        _feed.OnBattle(evt.Payload);            break;
        }

        _feed.Push(evt);  // all events appear in sidebar
    }

    // Called by polling loop when WS unavailable
    public void DispatchDelta(DeltaEvent delta)
    {
        // map delta.type → same handlers as above
    }
}
```

### 7.5 `TerritoryController.cs`

```csharp
public class TerritoryController : MonoBehaviour
{
    private Dictionary<string, TerritoryView> _views = new();

    public void LoadAll(TerritoryDto[] data);           // called on init
    public void OnCapture(JObject payload);             // change color to new faction
    public void OnCollapse(JObject payload);            // switch to ruins prefab, particle FX
    public void OnRecolonize(JObject payload);          // restore from ruins
    public void OnElection(JObject payload);            // update leader name in tooltip
    public void OnWarStart(JObject payload);            // highlight borders, war icon
    public void OnWarEnd(JObject payload);              // remove war indicators
    public void UpdateFromMapState(TerritoryMapDto dto); // called on periodic refresh
    public TerritoryView GetView(string territoryId);
}
```

### 7.6 `ArmyController.cs`

```csharp
public class ArmyController : MonoBehaviour
{
    private Dictionary<string, ArmyView> _armies = new();

    public void LoadAll(ArmyDto[] data);
    public void OnMove(JObject payload);     // spawn army token, begin path animation
    public void OnArrived(JObject payload);  // stop movement, anchor to territory
    public void OnSiegeStart(JObject payload); // siege animation
    public void OnSiegeEnd(JObject payload);   // outcome particle FX
}
```

### 7.7 `DeltaCursor.cs` — Cursor Management

```csharp
public class DeltaCursor : MonoBehaviour
{
    public string ClientId { get; private set; }  // stable GUID, stored in PlayerPrefs
    public int    LastTick  { get; private set; }

    private void Awake()
    {
        // Generate or load stable clientId
        if (!PlayerPrefs.HasKey("unity_client_id"))
            PlayerPrefs.SetString("unity_client_id", Guid.NewGuid().ToString());
        ClientId = PlayerPrefs.GetString("unity_client_id");
        LastTick = PlayerPrefs.GetInt("last_tick_" + GetWorldSlug(), 0);
    }

    public void Update(int newTick)
    {
        if (newTick > LastTick)
        {
            LastTick = newTick;
            PlayerPrefs.SetInt("last_tick_" + GetWorldSlug(), LastTick);
        }
    }

    private string GetWorldSlug() => WorldManager.Instance.Config.WorldSlug;
}
```

---

## 8. Event Subscription Architecture

### 8.1 Observer Pattern for Domain Events

Unity scripts subscribe to typed C# events rather than string-matching directly:

```csharp
// Strongly-typed events fired by EventDispatcher
public static class WorldEvents
{
    public static event Action<string, string> OnTerritoryCapture;    // (territoryId, newFactionId)
    public static event Action<string>         OnTerritoryCollapse;   // (territoryId)
    public static event Action<string>         OnTerritoryRecolonize; // (territoryId)
    public static event Action<string, string, float> OnArmyMove;    // (armyId, toTerritoryId, progress)
    public static event Action<string>         OnArmyArrived;         // (armyId)
    public static event Action<string, string> OnSiegeStart;          // (armyId, targetTerritoryId)
    public static event Action<string, bool>   OnSiegeEnd;            // (armyId, captured)
    public static event Action<string, string> OnNpcMigrate;          // (npcId, toTerritoryId)
    public static event Action<string>         OnNpcBirth;            // (npcId)
    public static event Action<string, string> OnNpcDeath;            // (npcId, reason)
    public static event Action<int>            OnWorldTick;           // (tickNumber)
    public static event Action<string, string> OnWarDeclared;         // (attackerSlug, defenderSlug)
    public static event Action<string, string> OnWarEnded;            // (warId, winnerSlug)
}

// Example subscriber (MapOverlay.cs)
private void OnEnable()
{
    WorldEvents.OnTerritoryCapture   += HandleCapture;
    WorldEvents.OnTerritoryCollapse  += HandleCollapse;
}

private void OnDisable()
{
    WorldEvents.OnTerritoryCapture   -= HandleCapture;
    WorldEvents.OnTerritoryCollapse  -= HandleCollapse;
}
```

### 8.2 Event Retention / Replay

When reconnecting, Unity must replay missed events to stay consistent:

```csharp
// In WorldManager.InitAsync() after reconnect:
var catchUp = await Api.GetDelta(Config.WorldSlug, Cursor.ClientId, Cursor.LastTick);
foreach (var delta in catchUp.Events.OrderBy(e => e.Tick))
    EventDispatcher.DispatchDelta(delta);
```

If `catchUp.count == 1000` (limit hit), call again with `lastTick = catchUp.lastTickSent` until `count < limit`.

### 8.3 Polling Fallback Strategy

```
Priority 1: WebSocket (real-time, ~0ms latency)
Priority 2: Delta polling every 2s (if WS unavailable)
Priority 3: map-state polling every 15s (if no delta endpoint reachable)
```

```csharp
private IEnumerator PollDeltaFallback()
{
    while (!Ws.IsConnected)
    {
        var result = await Api.GetDelta(Config.WorldSlug, Cursor.ClientId);
        foreach (var delta in result.Events)
            EventDispatcher.DispatchDelta(delta);
        yield return new WaitForSeconds(Config.PollIntervalSeconds); // default 2.0f
    }
}
```

---

## 9. Update Loop Architecture

### 9.1 Frame Update Categories

| Update Type | Method | Frequency | Purpose |
|-------------|--------|-----------|---------|
| WebSocket messages | `WsClient.Update()` | Every frame | Process incoming WS queue |
| Animation | `ArmyController.Update()` | Every frame | Lerp army tokens along paths |
| UI | `EventFeedUI.Update()` | Every frame | Scroll, fade-in new events |
| Delta poll | Coroutine | Every 2s (fallback only) | HTTP delta when WS down |
| Map refresh | Coroutine | Every 30s | Full map-state sync (drift correction) |
| Simulation state | Coroutine | Every 60s | Economy/stability HUD overlay |

### 9.2 Threading Model

- All Unity API calls must happen on the main thread
- `WsClient` receives messages on a background thread → enqueues to `ConcurrentQueue<WorldEvent>`
- `WsClient.Update()` (main thread) dequeues and dispatches
- HTTP requests use `async/await` with `UnityWebRequest` (returns to main thread via `SynchronizationContext`)

### 9.3 State Consistency

```
Ground Truth:  world_event_log (PostgreSQL)
Unity Cache:   in-memory Dictionary<string, TerritoryView> etc.
Reconciliation: every 30s full map-state sync overwrites cached state
```

**Handling tick gaps:** If `delta.previousCursor < Cursor.LastTick - 1`, a gap exists. Trigger full resync:
```csharp
if (response.PreviousCursor < _cursor.LastTick - 1)
    await FullResync();  // call world-state + event-stream/latest
```

---

## 10. Class Diagrams

### 10.1 Core Classes

```
┌─────────────────────────────────────────────────────────────────┐
│ WorldManager (Singleton MonoBehaviour)                          │
│                                                                 │
│  + Config: WorldConfig                                          │
│  + Api: ApiClient                                               │
│  + Ws: WsClient                                                 │
│  + Cursor: DeltaCursor                                          │
│  + Territories: TerritoryController                             │
│  + Armies: ArmyController                                       │
│  + Npcs: NpcController                                          │
│  + Tick: WorldTickController                                    │
│  + Dispatcher: EventDispatcher                                  │
│                                                                 │
│  # InitAsync(): Task                                            │
│  # FullResync(): Task                                           │
└───────────────────┬─────────────────────────────────────────────┘
                    │ owns
        ┌───────────┼────────────────────────────┐
        ▼           ▼                            ▼
┌─────────────┐ ┌───────────┐           ┌─────────────────┐
│ ApiClient   │ │ WsClient  │           │ EventDispatcher │
│             │ │           │           │                 │
│ +Get<T>()   │ │ +Connect()│ ──fires──►│ +Dispatch()     │
│ +Post<T>()  │ │ +OnEvent  │           │ +DispatchDelta()│
└─────────────┘ └───────────┘           └────────┬────────┘
                                                  │ routes to
              ┌───────────────────────────────────┼────────────────┐
              ▼                   ▼               ▼                ▼
  ┌───────────────────┐  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐
  │ TerritoryController│  │ArmyController│ │NpcController │ │WorldTickControl│
  │                   │  │              │ │              │ │                │
  │ _views: Dict<>    │  │ _armies:Dict │ │ _npcs: Dict  │ │ CurrentTick    │
  │ OnCapture()       │  │ OnMove()     │ │ OnMigrate()  │ │ OnTick()       │
  │ OnCollapse()      │  │ OnArrived()  │ │ OnBirth()    │ └────────────────┘
  │ OnRecolonize()    │  │ OnSiegeStart │ │ OnDeath()    │
  └───────────────────┘  └──────────────┘ └──────────────┘
```

### 10.2 DTO Hierarchy

```
WorldSnapshotDto
├── NpcDto[]
│     └── PosDto
├── TerritoryDto[]
│     └── PosDto
├── GovDto[]
│     └── ArmyStatDto
├── WarDto[]
├── ArmyDto[]
└── PlayerDto[]
     └── PosDto

MapStateDto
├── TerritoryMapDto[]
├── FactionDto[]
├── ArmyMapDto[]
├── NpcMapDto[]
└── HistoryItemDto[]

DeltaResponse
└── DeltaEvent[]
     └── JObject (changes — dynamic per event type)

WorldEvent (WebSocket)
└── JObject (payload — dynamic per event type)
```

---

## 11. WebSocket Flow

### 11.1 Full Lifecycle

```
Unity                                         Server (/api/ws/unity)
  │                                                │
  ├──── TCP Upgrade (HTTP → WS) ─────────────────►│
  │◄─── 101 Switching Protocols ──────────────────┤
  │                                                │
  ├──── { type: "subscribe",                       │
  │       worlds: ["cultivation"] } ──────────────►│
  │◄─── { type: "subscribed",                      │
  │       worlds: ["cultivation"] } ───────────────┤
  │                                                │
  │        [Simulation tick fires]                 │
  │◄─── { event: "world_tick",                     │
  │       worldSlug: "cultivation",                │
  │       tick: 142, ts: 1719...,                  │
  │       payload: { population: 4823 } } ─────────┤
  │                                                │
  │        [Territory captured]                    │
  │◄─── { event: "territory_capture",              │
  │       worldSlug: "cultivation",                │
  │       tick: 143, ts: 1719...,                  │
  │       payload: {                               │
  │         territoryId: "uuid",                   │
  │         capturedBy: "factionId",               │
  │         previousOwner: "factionId2" } } ───────┤
  │                                                │
  ├──── { type: "ping" } ─────────────────────────►│
  │◄─── { type: "pong" } ──────────────────────────┤
  │                                                │
  │        [Network interruption]                  │
  ├──── [disconnect] ─────────────────────────────►│
  │                                                │
  │  [Unity detects close, begins reconnect loop]  │
  │  [fetches missed events via HTTP delta]        │
  │                                                │
  ├──── TCP Upgrade (reconnect) ──────────────────►│
  │◄─── 101 ──────────────────────────────────────┤
  ├──── { type: "subscribe", ... } ───────────────►│
  │◄─── { type: "subscribed" } ────────────────────┤
  │  [resume real-time stream]                     │
```

### 11.2 WS Message Handler (C# pseudocode)

```csharp
private void OnMessage(byte[] data)
{
    string json = Encoding.UTF8.GetString(data);
    var msg = JObject.Parse(json);
    string type = msg["type"]?.ToString();

    if (type == "pong") return;
    if (type == "subscribed") return;

    // Canonical WorldEvent (no "type" field — has "event" field)
    if (msg.ContainsKey("event"))
    {
        var worldEvent = msg.ToObject<WorldEvent>();
        _incomingQueue.Enqueue(worldEvent);  // ConcurrentQueue — thread safe
        return;
    }
}

// In Update() — main thread
private void Update()
{
    while (_incomingQueue.TryDequeue(out var evt))
        OnEvent?.Invoke(evt);
}
```

---

## 12. Implementation Phases

### Phase 7.1 — Foundation (this document)
- [x] Backend audit complete
- [x] DTO models defined
- [x] C# architecture designed
- [ ] `WorldConfig.asset` — fill in serverUrl, worldSlug, pollInterval
- [ ] Implement `ApiClient.cs` — UnityWebRequest wrappers
- [ ] Implement `WsClient.cs` — WebSocket connection + queue
- [ ] Implement `DeltaCursor.cs` — PlayerPrefs persistence

### Phase 7.2 — Scene Bootstrap
- [ ] `WorldManager.InitAsync()` — 3-step boot sequence
- [ ] `TerritoryController.LoadAll()` — spawn territory prefabs from DTO positions
- [ ] `FactionController` — build id→color map (deterministic hash from UUID)
- [ ] `EventDispatcher` — route events to controllers
- [ ] `ConnectionStatusUI` — show WS status: Connected / Reconnecting / Offline

### Phase 7.3 — Live Map
- [ ] `ArmyController` — spawn army tokens, lerp movement (progress 0.0→1.0)
- [ ] `MapOverlay` — political coloring by faction ownerId
- [ ] `InfoPanel` — click territory → call `GET /api/simulation/territory-detail/:worldSlug/:id`
- [ ] `EventFeedUI` — scrolling sidebar fed by all WebSocket events

### Phase 7.4 — Timeline & Analytics
- [ ] `TimelineBar` — tick bar with collapse/capture/war markers from `GET /api/simulation/history/:worldSlug/timeline`
- [ ] Analytics overlay from `GET /api/simulation/analytics/:worldSlug`
- [ ] Faction-specific history from `GET /api/simulation/faction-timeline/:worldSlug/:factionId`

### Phase 7.5 — Player Interaction
- [ ] Auth flow (Replit OAuth in Unity WebView for session cookie)
- [ ] `POST /api/military/attack/:worldSlug` from Unity UI
- [ ] `POST /api/military/move-order/:worldSlug` drag-to-move on map

---

## 13. Known Constraints & Gotchas

| # | Constraint | Impact | Mitigation |
|---|-----------|--------|-----------|
| 1 | **WS cursor is in-memory on server** | If API server restarts, all clientId cursors are lost | On reconnect always include `lastTick` from PlayerPrefs as explicit fallback |
| 2 | **Most write endpoints require auth** (Replit session cookie) | Unity cannot POST military/attack without auth | Phase 7.5 implements OAuth WebView for session cookie |
| 3 | **NPC cap at 500** in world-state | Dense worlds truncate NPC list | Use territory-level NPC counts (from map-state) for rendering, not individual NPCs |
| 4 | **world_event_log pruned at 100,000 rows** | Very old events not available for replay | Unity cursor must stay within ~24h of current tick; after long offline, trigger full resync |
| 5 | **`emitEventSync` does not await DB write** | Race condition: WS delivers event before DB write completes | If delta fetch returns 0 events but WS delivered some, retry after 500ms |
| 6 | **No Unity-specific auth endpoint** | Unity needs session cookie from Replit OIDC | Use `GET /auth/user` to verify session; implement WebView OAuth for login flow |
| 7 | **`pos` field (x,y) is a 0-100 integer grid** | Not world-space coordinates | Map to Unity world-space: `Vector3 = new(pos.x * scale, 0, pos.y * scale)` |
| 8 | **Some events emitted with `tick: 0`** | Events from `military.ts` and `npcPopulation.ts` pass tick=0 | Trust `ts` (Unix ms) as ordering field when tick=0 |
| 9 | **WebSocket path includes `/api/` prefix** | Path must be `/api/ws/unity`, not `/ws/unity` | Vite proxy adds `ws:true` — in production point directly at backend port 8080 |
| 10 | **`broadcastUnity` (legacy)** wraps events with `tick: 0` | Legacy emitters in battle.ts, worldWar.ts | Filter or tolerate tick=0 in delta cursor logic |

---

## Appendix A — Quick Reference: All Unity-Relevant Endpoints

```
# No auth required
GET  /api/unity/world-state/:worldSlug                    — full snapshot (init)
GET  /api/unity/map-state/:worldSlug                      — lighter map snapshot
GET  /api/unity/world-events/:worldSlug                   — recent events feed
GET  /api/unity/ws-info                                   — WS schema reference
GET  /api/unity/event-stream/:worldSlug                   — replay log (sinceTick/sinceTs)
GET  /api/unity/event-stream/:worldSlug/latest            — last N events
GET  /api/unity/delta/:worldSlug                          — delta events (per-client cursor)
GET  /api/unity/delta/:worldSlug/snapshot-size            — bandwidth diagnostic
GET  /api/simulation/history/:worldSlug                   — world history events
GET  /api/simulation/history/:worldSlug/timeline          — compact timeline
GET  /api/simulation/snapshots/:worldSlug                 — list snapshot ticks
GET  /api/simulation/snapshot/:worldSlug/:tick            — snapshot at tick
GET  /api/simulation/analytics/:worldSlug                 — time-series charts
GET  /api/simulation/territory-detail/:worldSlug/:id      — territory + army + history
GET  /api/simulation/faction-timeline/:worldSlug/:id      — faction history

# Auth required (Replit session cookie)
GET  /api/simulation/state/:worldSlug                     — sim state (economy, mood)
GET  /api/simulation/logs/:worldSlug                      — sim log entries
GET  /api/territories/:worldSlug                          — all territories + resources
GET  /api/military/:worldSlug                             — military overview
POST /api/military/attack/:worldSlug                      — launch attack
POST /api/military/move-order/:worldSlug                  — issue movement order
POST /api/unity/delta/:worldSlug/benchmark                — bandwidth benchmark

# WebSocket
WS   /api/ws/unity                                        — real-time event stream
```

## Appendix B — World Slugs Available

| Slug | World Name |
|------|-----------|
| `cultivation` | Tu Tiên (Cyber Cultivation) |
| `cyberpunk` | Cyberpunk |
| `wasteland` / `hoang-phe` | Vùng Hoang Phế |

## Appendix C — Event Payload Reference

| Event | Key Payload Fields |
|-------|-------------------|
| `territory_capture` | territoryId, capturedBy (factionId), previousOwner (factionId) |
| `territory_collapse` | territoryId, reason, population, security |
| `territory_recolonized` | territoryId, colonizedBy (factionId), settlers, newProsperity |
| `army_move` | armyMovementId, fromId (territory), toId (territory), size |
| `army_arrived` | armyMovementId, atTerritoryId |
| `army_siege_started` | armyMovementId, targetTerritoryId, attackerFactionId |
| `army_siege_ended` | armyMovementId, outcome ("captured" \| "repelled") |
| `npc_migrate` | npcId, fromTerritoryId, toTerritoryId, reason |
| `npc_birth` | npcId, parentId, territoryId |
| `npc_death` | npcId, reason, territoryId |
| `election_result` | govId, winner (npcId), votes |
| `diplomacy_action` | govA, govB, action ("alliance" \| "war" \| "peace") |
| `world_war_start` | warId, attacker (worldSlug), defender (worldSlug) |
| `world_war_end` | warId, winner (worldSlug) |
| `battle_result` | battleId, winner, loser, expGained, territoryChanged |
| `world_tick` | population, economyScore, mood, stability, tick |
