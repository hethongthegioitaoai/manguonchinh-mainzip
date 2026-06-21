# Phase 7.5 — Army Renderer

Unity rendering and movement architecture for AI World System armies. All fields sourced from the live `GET /api/unity/map-state/:worldSlug` endpoint. No placeholder values.

---

## Schema Audit

### `military_forces` table (`lib/db/src/schema/militaryForces.ts`)

Primary army table. Exposed in map-state as `armies[]`.

| DB column                | Type         | ArmyDto field        | Notes                                      |
|--------------------------|--------------|----------------------|--------------------------------------------|
| `id`                     | uuid PK      | `id`                 | Stable across refreshes                    |
| `army_name`              | varchar(128) | `name`               | Server generates `Army-{id[0..5]}` if blank |
| `territory_id`           | uuid         | `territoryId`        | Home base — recruitment territory          |
| `total_soldiers`         | integer      | `soldiers`           | Headcount                                  |
| `morale`                 | real         | `morale`             | 0–100; <30 = retreat risk                 |
| `training_level`         | real         | *(in power formula)* | Not in ArmyDto; absorbed into `power`      |
| `supply_level`           | real         | `supply`             | 0–100; <20 = attrition                    |
| `military_power`         | real         | `power`              | `soldiers × morale/100 × training/10 × supply/100 × 10` |
| `current_territory_id`   | uuid?        | `currentTerritoryId` | Where the army stands right now            |
| `target_territory_id`    | uuid?        | `targetTerritoryId`  | March destination. **Null when idle**      |
| `movement_progress`      | real         | `movementProgress`   | 0.0–1.0. 0 = at current, 1 = at target    |
| `movement_status`        | varchar(16)  | `movementStatus`     | `"idle"` \| `"moving"` \| `"arrived"` \| `"sieging"` |
| `recent_positions`       | jsonb        | `recentPositions`    | `[{x, y, tick}]` — map-% breadcrumbs      |

### Movement state machine (Phase 63A)

```
               march order
    idle  ──────────────────▶  moving
     ▲                            │
     │      cancel / retreat      │  progress → 1.0
     │ ◀──────────────────────────▼
     │                         arrived
     │                            │
     │                            │  siege begins
     │                            ▼
     └───────────────────────  sieging
             siege ends
```

### `army_movements` table (`lib/db/src/schema/worldMap.ts`)

War-linked cross-world army columns. Also exposed via map-state `armies[]` in `world-state` endpoint (different from `map-state` `armies[]` which comes from `military_forces`).

| DB column          | Type        | Notes                                              |
|--------------------|-------------|----------------------------------------------------|
| `id`               | uuid PK     |                                                    |
| `world_slug`       | varchar(64) |                                                    |
| `war_id`           | uuid?       | FK to world_wars                                   |
| `from_territory_id`| uuid        | Origin territory                                   |
| `to_territory_id`  | uuid        | Target territory                                   |
| `army_size`        | integer     | Headcount                                          |
| `faction_id`       | uuid?       | FK to npc_factions                                 |
| `status`           | varchar(16) | `"moving"` (only active movements are fetched)     |
| `progress`         | real        | 0.0–1.0                                            |
| `started_at`       | timestamp   |                                                    |
| `arrives_at`       | timestamp   | Server ETA — can be used for client-side progress estimate |

### Delta events (`/api/unity/delta/:worldSlug`)

| Event type         | Trigger                         |
|--------------------|---------------------------------|
| `army_move`        | Army starts marching            |
| `army_arrived`     | Army reaches `targetTerritoryId`|
| `army_siege`       | Siege starts or ends            |

---

## Architecture

```
MapManager (GameObject)
│
├── WorldLoader              polls map-state every N seconds
│     └─ OnStateRefreshed ──▶ ArmyMovementController.SyncFromState(dto)
│
├── ArmyMovementController   scene-level pool manager
│     Builds territory position lookup from territories[] in the same snapshot.
│     Creates / updates / destroys ArmyRenderer per army id.
│     Fires OnSiegeStarted and OnArmyArrived events.
│     Optional: smooth-lerp icon between polls (configurable).
│
└── Army_{id[0..5]}           pooled GameObjects
      ArmyRenderer             per-army MonoBehaviour
      ├── ArmyIcon             SpriteRenderer   icon, coloured by state
      ├── SiegeRing            SpriteRenderer   pulsing ring (sieging only)
      ├── PathLine             LineRenderer     current→target path (moving only)
      ├── TrailLine            LineRenderer     recentPositions breadcrumb
      └── StatsCanvas          Canvas (World)
          ├── NameLabel        TextMeshProUGUI
          ├── SoldiersLabel    TextMeshProUGUI
          ├── PowerLabel       TextMeshProUGUI
          ├── StatusLabel      TextMeshProUGUI
          ├── MoraleBar        UI.Image (fill)
          └── SupplyBar        UI.Image (fill)
```

---

## Position Interpolation

Territory positions are in the same coordinate space across all Phase 7 systems:

```
worldX = territory.x / 100 × mapWidth
worldZ = territory.y / 100 × mapHeight
```

`territory.x` and `territory.y` are integers 5–95 from the DB. The same formula applies to `recentPositions[i].x` / `.y`.

### Movement progress lerp

```csharp
// ArmyRenderer.ApplyWorldPosition()
float t = Mathf.Clamp01(dto.movementProgress);  // server-provided 0.0–1.0
pos = Vector3.Lerp(currentTerritoryPos, targetTerritoryPos, t);
```

`movementProgress` is updated server-side each simulation tick. The client displays exactly what the server reports — no client-side extrapolation unless `smoothLerp = true` is enabled.

### Smooth lerp between polls (optional)

When `ArmyMovementController.smoothLerp = true`, a coroutine continues advancing the icon from `startProgress` toward 1.0 at a constant rate of `1.0 / lerpDuration` per second. It stops at 0.99 and waits for the next server update to avoid overshooting.

```
poll N:   server reports progress=0.30 → coroutine starts from 0.30
  … icon animates smoothly 0.30 → 0.99 over lerpDuration …
poll N+1: server reports progress=0.55 → coroutine restarts from 0.55
```

---

## Visual Rules

### State colours

| State    | Hex       | RGBA                          | Condition                    |
|----------|-----------|-------------------------------|------------------------------|
| idle     | `#9ca3af` | (0.612, 0.639, 0.686)         | `movementStatus == "idle"`   |
| moving   | `#22d3ee` | (0.133, 0.827, 0.933)         | `movementStatus == "moving"` |
| arrived  | `#22c55e` | (0.133, 0.773, 0.333)         | `movementStatus == "arrived"`|
| sieging  | `#ef4444` | (0.937, 0.267, 0.267)         | `movementStatus == "sieging"`|

### Soldier scale

```csharp
// ArmyRenderer.ApplyScale()
float raw = soldierScaleCurve.Evaluate(dto.soldiers);  // AnimationCurve
float s   = Mathf.Clamp(raw, minArmyScale, maxArmyScale);
transform.localScale = new Vector3(s, s, s);
```

Default curve: 0 soldiers → 0.3× scale, 3000 soldiers → 1.4× scale.

### Morale bar colour thresholds

| morale range | Colour   | Hex       |
|-------------|----------|-----------|
| ≥ 60        | Green    | `#22c55e` |
| 30–59       | Yellow   | `#eab308` |
| < 30        | Red      | `#ef4444` |

### Supply bar colour

| supply range | Colour | Hex       |
|-------------|--------|-----------|
| ≥ 50        | Green  | `#22c55e` |
| < 50        | Red    | `#ef4444` |

---

## Movement Path (LineRenderer)

Active only when `movementStatus == "moving"` AND `targetTerritoryId` resolves to a valid territory.

```
pathLine.positionCount = 2
positionCount[0] = army.WorldPosition      (lerped, updates every frame)
positionCount[1] = targetTerritory.WorldPos (static)
```

| Property  | Value                        |
|-----------|------------------------------|
| Width     | 0.08 (Inspector-configurable)|
| Color     | white `(1,1,1,0.55)`        |
| Gradient  | constant (no fade)           |
| World space | true                       |

---

## Trail History (LineRenderer)

Driven by `recentPositions: [{x, y, tick}]` from `military_forces.recent_positions` JSONB.

Coordinate conversion:
```csharp
float wx = pos.x / 100f * mapWidth;
float wz = pos.y / 100f * mapHeight;
```

Array ordering: index 0 = **oldest** position (tail), last index = **newest** (head near current icon).

```
trailLine.positionCount = recentPositions.Count
trailLine.SetPosition(i, WorldPos(recentPositions[i]))
```

Gradient (tail→head, matching army moving colour):
```
alpha at index 0 (oldest) = 0.0   (transparent tail)
alpha at index n (newest) = 0.85  (trailHeadColor alpha)
colour: #22d3ee throughout
```

Hidden when `recentPositions.Count < 2`.

---

## Siege Ring

Active only when `movementStatus == "sieging"`.

Pulsing alpha animation runs in `Update()`:
```csharp
float a = Mathf.Lerp(alphaMin=0.25, alphaMax=0.85,
              (Sin(Time.time × freq × 2π) + 1) / 2);
```

Default pulse frequency: 1.2 oscillations/second. Colour: `#ef4444` (siege red). Applied via `MaterialPropertyBlock` — no material instances.

---

## Delta Stream Integration

```csharp
// In your delta consumer:
void OnDeltaReceived(DeltaEvent evt)
{
    if (evt.type is "army_move" or "army_arrived" or "army_siege")
        armyController.ApplyDeltaEvent(evt);
}
```

`ApplyDeltaEvent()` patches the cached `ArmyDto` with changes from the delta payload and calls `UpdateArmy()` immediately, giving visual response before the next full poll cycle.

---

## Full Wiring Example

```csharp
public class MapManager : MonoBehaviour
{
    public WorldLoader             loader;
    public TerritoryRendererPool   territoryPool;
    public ArmyMovementController  armyController;
    public HeatmapManager          heatmap;

    private void Start()
    {
        loader.OnStateRefreshed += OnState;
        armyController.OnSiegeStarted += r => CameraShake.Instance?.Shake(0.3f);
        armyController.OnArmyArrived  += r => NotificationBanner.Show($"{r.Data.name} arrived");
    }

    private void OnState(MapStateDto state)
    {
        territoryPool.SyncFromState(state.territories);
        armyController.SyncFromState(state);
        heatmap.RefreshData(state);
    }
}
```

---

## File List

| File                                      | Purpose                                              |
|-------------------------------------------|------------------------------------------------------|
| `UnityClient/ArmyRenderer.cs`             | Per-army MonoBehaviour — icon, path, trail, siege    |
| `UnityClient/ArmyMovementController.cs`   | Scene manager — pool, position resolution, lerp      |
| `UnityClient/ArmyDto.cs`                  | Data model (Phase 7.2)                               |
| `UnityClient/WorldLoader.cs`              | Data source (Phase 7.2)                              |
| `docs/PHASE7_5_ARMY_RENDERER.md`          | This document                                        |

---

## Sorting Layer Recommendation

```
Sorting Layer order (back to front — extends Phase 7.3 table):
  Background      ground plane
  Territory       TileBase, TerrainOverlay, OwnerBorder
  TerritoryUI     ProsperityRing, SecurityDot
  TerritoryFX     StateOverlay, SelectionGlow, HeatmapLayer
  ArmyTrails      TrailLine, PathLine          ← new
  Armies          ArmyIcon, SiegeRing          ← new
  Players         player agent icons
  NPCs            NPC dots
  UI              world-space labels
```
