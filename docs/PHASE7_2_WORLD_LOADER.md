# Phase 7.2 — World Loader

Unity-side architecture for loading, deserializing, caching, and refreshing world map state from the AI World System backend.

---

## Endpoint Audit

### `GET /api/unity/map-state/:worldSlug`

**File:** `artifacts/api-server/src/routes/unityIntegration.ts` (line 529)  
**Auth:** None — publicly accessible (no `isAuthenticated` guard).  
**Poll recommendation:** Every 5–10 seconds from the map renderer.

#### Response shape

```json
{
  "worldSlug": "string",
  "ts":        1234567890000,
  "territories": [ ...TerritoryDto ],
  "factions":    [ ...FactionDto  ],
  "armies":      [ ...ArmyDto     ],
  "npcs":        [ ...NpcMapDto   ],
  "recentHistory": [ ...HistoryDto ]
}
```

#### Error response

```json
{ "error": "Failed to fetch map state" }
```
HTTP 500.

---

## Field Reference (from real DB schema)

### TerritoryDto
Sourced from `territories` table, joined with `npc_factions` for owner name.

| Field        | DB column          | Type    | Notes                                           |
|------------- |--------------------|---------|-------------------------------------------------|
| `id`         | `id`               | uuid    | Stable PK across refreshes                      |
| `name`       | `name`             | string  | Display name                                    |
| `type`       | `type`             | string  | `village` \| `district` \| `city` \| `farmland` \| `harbor` |
| `terrain`    | `terrain`          | string  | `plains` \| `forest` \| `mountain` \| `desert` \| `swamp` \| `sea` |
| `status`     | `status`           | string  | `active` (default); may add `destroyed`         |
| `x`          | `x`                | int     | 5–95 — percentage of map width                  |
| `y`          | `y`                | int     | 5–95 — percentage of map height                 |
| `population` | `population`       | int     | Headcount                                       |
| `prosperity` | `prosperity`       | int     | 0–100; drives harvest multiplier                |
| `security`   | `security`         | int     | 0–100; affects unrest                           |
| `owner`      | `npc_factions.name`| string? | Null when unowned                               |
| `ownerId`    | `owner_faction_id` | uuid?   | Null when unowned; FK to FactionDto.id          |

### FactionDto
Sourced from `npc_factions`. Selected fields only (not full row).

| Field       | DB column   | Type | Notes                                  |
|-------------|-------------|------|----------------------------------------|
| `id`        | `id`        | uuid | Cross-reference with TerritoryDto.ownerId |
| `name`      | `name`      | string |                                      |
| `type`      | `type`      | string | `merchant_guild` \| `empire` \| `clan` \| `order` \| `alliance` \| `tribe` |
| `influence` | `influence` | int  | Coalesced to 0; political weight       |
| `treasury`  | `treasury`  | int  | Coalesced to 0; gold on hand          |

### ArmyDto
Sourced from `military_forces`, scoped via `npc_governments → territories`.

| Field                | DB column              | Type     | Notes                                              |
|----------------------|------------------------|----------|----------------------------------------------------|
| `id`                 | `id`                   | uuid     |                                                    |
| `name`               | `army_name`            | string   | Server generates `Army-{id[0..5]}` when blank      |
| `territoryId`        | `territory_id`         | uuid     | Home base                                          |
| `currentTerritoryId` | `current_territory_id` | uuid     | Current standing position                          |
| `targetTerritoryId`  | `target_territory_id`  | uuid?    | Null when idle                                     |
| `movementProgress`   | `movement_progress`    | float    | 0.0–1.0 — lerp between current→target tile        |
| `movementStatus`     | `movement_status`      | string   | `idle` \| `moving` \| `arrived` \| `sieging`      |
| `recentPositions`    | `recent_positions`     | jsonb    | `[{ x, y, tick }]` breadcrumb trail               |
| `soldiers`           | `total_soldiers`       | int      |                                                    |
| `power`              | `military_power`       | float    | `soldiers × morale/100 × training/10 × supply/100 × 10` |
| `morale`             | `morale`               | float    | 0–100; below 30 → retreat                         |
| `supply`             | `supply_level`         | float    | 0–100; below 20 → attrition                       |

### NpcMapDto (lightweight)
Sourced from `npc_cores`, limit 300 per world. For full NPC state use `/api/unity/world-state/:worldSlug`.

| Field         | DB column      | Type    |
|---------------|----------------|---------|
| `id`          | `id`           | uuid    |
| `name`        | `name`         | string  |
| `occupation`  | `occupation`   | string  |
| `territoryId` | `territory_id` | uuid?   |
| `energy`      | `energy`       | int     |
| `hunger`      | `hunger`       | int     |
| `happiness`   | `happiness`    | int     |
| `currentGoal` | `current_goal` | string? |

---

## Unity Architecture

```
WorldLoader.cs (MonoBehaviour)
│   Polls GET /api/unity/map-state/:worldSlug
│   Coroutine-based — no threads, no async/await required
│   ├── OnStateRefreshed  event → MapStateDto (cached)
│   └── OnLoadError       event → string
│
├── MapStateDto.cs         Root response
│   ├── TerritoryDto[]     Territory tiles
│   ├── FactionDto[]       Political actors
│   ├── ArmyDto[]          Military forces
│   │   └── ArmyPositionDto[]  Breadcrumb trail
│   ├── NpcMapDto[]        Lightweight NPC layer
│   └── HistoryDto[]       Recent world history
│
Models (C# classes with [Serializable]):
├── TerritoryDto.cs
├── FactionDto.cs
└── ArmyDto.cs             (includes ArmyPositionDto)
```

All files live in namespace `AiWorldSystem.Unity`.

---

## File List

| File                         | Purpose                                        |
|------------------------------|------------------------------------------------|
| `UnityClient/WorldLoader.cs` | MonoBehaviour — polls, caches, raises events   |
| `UnityClient/MapStateDto.cs` | Root response + NpcMapDto + HistoryDto         |
| `UnityClient/TerritoryDto.cs`| Territory model                                |
| `UnityClient/FactionDto.cs`  | Faction model                                  |
| `UnityClient/ArmyDto.cs`     | Army model + ArmyPositionDto                   |

---

## Integration Guide

### 1 — Attach the loader

```csharp
// In your scene setup script or MapManager.Awake():
var loaderGO = new GameObject("WorldLoader");
DontDestroyOnLoad(loaderGO);
var loader = loaderGO.AddComponent<WorldLoader>();
loader.worldSlug        = "tu-tien";
loader.apiBaseUrl       = "https://<your-replit-domain>";
loader.pollIntervalSeconds = 10f;
loader.OnStateRefreshed += OnMapRefreshed;
loader.OnLoadError      += Debug.LogError;
```

### 2 — React to updates

```csharp
private void OnMapRefreshed(MapStateDto state)
{
    foreach (var territory in state.territories)
        TerritoryTileManager.Instance.UpdateTile(territory);

    foreach (var faction in state.factions)
        FactionColorRegistry.Instance.Register(faction);

    foreach (var army in state.armies)
        ArmyIconManager.Instance.UpdateArmy(army);
}
```

### 3 — Trigger a manual refresh (e.g. after a player action)

```csharp
loader.RequestRefresh();
```

### 4 — Switch worlds at runtime

```csharp
loader.LoadWorld("cyberpunk");
```

---

## Territory → Map Position

`x` and `y` are integers in the range **5–95**, representing percentage of the map canvas.

```csharp
// Convert to Unity world space assuming a 100×100 unit play area:
Vector3 WorldPos(TerritoryDto t, float mapWidth, float mapHeight) =>
    new Vector3(t.x / 100f * mapWidth, 0f, t.y / 100f * mapHeight);
```

---

## Army Movement Interpolation

Use `movementProgress` (0.0–1.0) to interpolate the army icon between territories.

```csharp
Vector3 ArmyIconPos(ArmyDto army, MapStateDto state)
{
    var current = state.territories.Find(t => t.id == army.currentTerritoryId);
    var target  = state.territories.Find(t => t.id == army.targetTerritoryId);
    if (current == null) return Vector3.zero;
    if (target  == null) return WorldPos(current, mapW, mapH);
    return Vector3.Lerp(WorldPos(current, mapW, mapH),
                        WorldPos(target,  mapW, mapH),
                        army.movementProgress);
}
```

---

## No Mock Data

All DTOs map 1-to-1 to real columns in the PostgreSQL schema. There are no hardcoded values or placeholder fields. If a field is nullable in the DB it is nullable (string = null, or list is empty) in the DTO.

---

## Related Endpoints

| Endpoint                                  | Purpose                              |
|-------------------------------------------|--------------------------------------|
| `GET /api/unity/world-state/:worldSlug`   | Full snapshot: NPC emotions, gov, wars, players |
| `GET /api/unity/world-events/:worldSlug`  | Recent narrative events              |
| `GET /api/unity/event-stream/:worldSlug`  | Replay-safe event log (since tick/ts)|
| `GET /api/unity/ws-info`                  | WebSocket subscribe instructions     |
| `WS  /ws/unity`                           | Real-time push: npc_move, battle, war_start… |
