# Phase 7.6 — Event Effects

Visual effect layer driven by the live delta event stream from `GET /api/unity/delta/:worldSlug`. Every effect is keyed to a real event type emitted by `eventBus.ts` and carries only the payload fields actually present in `world_event_log`.

---

## Event Type Audit

### Event name mapping (`unityDelta.ts` `EVENT_TYPE_MAP`)

| Source event (world_event_log) | Delta type received by Unity   | EntityId extraction                                  |
|-------------------------------|-------------------------------|------------------------------------------------------|
| `territory_capture`           | `"territory_capture"`          | `payload.territoryId`                                |
| `territory_collapse`          | `"territory_collapse"`         | `payload.territoryId`                                |
| `territory_recolonized`       | `"territory_recolonized"`      | `payload.territoryId`                                |
| `army_siege_started`          | `"army_siege"`                 | `payload.armyMovementId ?? armyId ?? id`             |
| `army_siege_ended`            | `"army_siege"`                 | `payload.armyMovementId ?? armyId ?? id`             |
| `army_move`                   | `"army_move"`                  | `payload.armyMovementId ?? armyId ?? id`             |
| `army_arrived`                | `"army_arrived"`               | `payload.armyMovementId ?? armyId ?? id`             |
| `npc_migrate`                 | `"npc_move"`                   | `payload.npcId ?? id`                                |
| `npc_goal_changed`            | `"npc_move"`                   | `payload.npcId ?? id`                                |
| `npc_birth`                   | `"npc_move"`                   | `payload.npcId ?? id`                                |
| `npc_death`                   | `"npc_move"`                   | `payload.npcId ?? id`                                |

### Confirmed payload shapes (from source code)

#### `territory_capture` (emitted in `military.ts`)
```json
{
  "territoryId":        "uuid",
  "territoryName":      "string",
  "attackerName":       "string",
  "defenderName":       "string",
  "attackerWon":        true | false,
  "refugeeCount":       42,
  "attackerSoldiers":   500,
  "defenderSoldiers":   300,
  "combatTicks":        8
}
```

#### `territory_collapse` (emitted in `worldSimulation.ts`)
```json
{
  "territoryId":   "uuid",
  "territoryName": "string",
  "population":    0,
  "security":      5
}
```

#### `territory_recolonized` (emitted in `worldSimulation.ts`)
```json
{
  "territoryId":      "uuid",
  "territoryName":    "string",
  "settlers":         120,
  "fromTerritoryId":  "uuid",
  "fromTerritoryName":"string"
}
```

#### `army_siege_started` / `army_siege_ended` (army_siege delta)
```json
{
  "armyMovementId": "uuid",   // or "armyId"
  "territoryId":    "uuid",
  "status":         "started" | "ended"
}
```

#### `army_move` (emitted in `military.ts` — bulk)
```json
{
  "updated": 3,
  "arrived": 1
}
```

#### `army_arrived`
```json
{
  "armyId":      "uuid",
  "territoryId": "uuid"
}
```

#### `npc_migrate` / `npc_birth` / `npc_death` / `npc_goal_changed` (npc_move delta)
```json
{
  "npcId":       "uuid",
  "territoryId": "uuid"
}
```

---

## Effect Design

| Delta type               | EffectType     | Channel key   | Visual effect                                       |
|--------------------------|----------------|---------------|-----------------------------------------------------|
| `territory_capture`      | Capture        | territoryId   | Colour flash (red/violet) + conquest ring particles + float text |
| `territory_collapse`     | Collapse       | territoryId   | Grey desaturate flash + dust particles + "Collapsed" float text |
| `territory_recolonized`  | Recolonize     | territoryId   | Green bloom flash + settler dot burst + settlers count text |
| `army_siege` (started)   | Siege          | territoryId   | Pulsing red ring (sustained until siege_ended) + impact sparks |
| `army_siege` (ended)     | SiegeEnd       | territoryId   | Siege ring fade out + "Siege ended" text            |
| `army_arrived`           | ArmyArrived    | armyId        | White flash on army icon                            |
| `army_move`              | ArmyMove       | entityId      | No-op visual (army movement already handled by Phase 7.5) |
| `npc_move`               | NpcMove        | territoryId   | Dot flash (birth=green, death=grey, migrate=blue); particle burst when ≥3 stacked |

### Flash colours

| Effect       | Hex       | RGBA                         | Condition               |
|-------------|-----------|------------------------------|-------------------------|
| Capture win  | `#ef4444` | (0.937, 0.267, 0.267, 0.85) | `attackerWon == true`  |
| Capture lose | `#8b5cf6` | (0.545, 0.361, 0.965, 0.85) | `attackerWon == false` |
| Collapse     | `#333333` | (0.200, 0.200, 0.200, 0.90) | always                  |
| Recolonize   | `#22c55e` | (0.133, 0.773, 0.333, 0.75) | always                  |
| Siege pulse  | `#ef4444` | (0.937, 0.267, 0.267, 0.70) | alpha animates 0.1→0.6 |
| NPC birth    | `#22c55e` | (0.133, 0.773, 0.333, 0.50) | `_sourceEvent==npc_birth`  |
| NPC death    | `#666666` | (0.400, 0.400, 0.400, 0.50) | `_sourceEvent==npc_death`  |
| NPC migrate  | `#60a5fa` | (0.373, 0.647, 0.980, 0.40) | all other npc_move     |

Flash colours match the React `EventFeedPage.tsx` category palette to ensure consistent visual language across client and Unity.

### Flash animation formula

```csharp
// Flash in (40% of duration)
Color blended = Color.Lerp(originalColor, targetColor, elapsed / (duration * 0.4f));

// Flash out (60% of duration)
Color blended = Color.Lerp(targetColor, originalColor, elapsed / (duration * 0.6f));
```

Applied via `MaterialPropertyBlock._Color` on the `"HeatmapLayer"` child `SpriteRenderer` — same child used by Phase 7.4 heatmaps. No material instances created.

### Siege pulse formula

```csharp
float a = Mathf.Lerp(0.1f, 0.6f,
    (Mathf.Sin(elapsed × 2.5f × π × 2) + 1) / 2);
```

2.5 oscillations/second. Persists frame-by-frame in a coroutine until `army_siege_ended` removes the territory from `_activeSiegeTerritories`.

---

## Queue Architecture

```
DeltaEventConsumer
  └─ EventEffectManager.Enqueue(evt)
       │
       ├─ TryParseEffect()        → EffectType + channelId
       ├─ PassesStackingRules()   → accept / reject / increment stack
       ├─ DropOldestNonCritical() → if queue full (maxQueueDepth=128)
       └─ _queue.Enqueue(req)
                 │
                 ▼  (every Update frame)
         ProcessQueue()
           │
           ├─ RefillGlobalTokens()   token bucket: maxGlobalPerSecond=8 tokens/s
           │
           └─ while (queue not empty AND tokens ≥ 1):
                 ├─ TTL check (drop if age > requestTtl=8s)
                 ├─ Channel throttle check (NextAllowedAt)
                 ├─ ResolveTransform() → null = skip silently
                 ├─ globalTokens -= 1
                 ├─ channel.NextAllowedAt = now + 1/maxChannelPerSecond
                 └─ StartCoroutine(PlayEffect)
```

### Token bucket parameters

| Parameter            | Default | Description                                     |
|----------------------|---------|-------------------------------------------------|
| `maxGlobalPerSecond` | 8       | Max total effect starts per second              |
| `maxChannelPerSecond`| 2       | Max starts per territory/army per second        |
| `requestTtl`         | 8s      | Drop enqueued request after this many seconds   |
| `maxQueueDepth`      | 128     | Drop oldest non-critical when depth exceeded    |

---

## Stacking Rules

| EffectType        | Rule          | Behaviour                                                     |
|-------------------|---------------|---------------------------------------------------------------|
| `Capture`         | **Replace**   | Stops currently active capture effect; plays new one          |
| `Collapse`        | **Skip**      | Discarded if same territory is already collapsing             |
| `Recolonize`      | **Skip**      | Discarded if same territory already recolonizing              |
| `Siege`           | **Skip**      | Discarded if `_activeSiegeTerritories` contains territoryId   |
| `SiegeEnd`        | **Always**    | Always processed; removes territory from active siege set     |
| `ArmyArrived`     | **Replace**   | Brief, low-cost — always show, stops previous on same army    |
| `ArmyMove`        | **Skip**      | Discarded if already queued for same channelId                |
| `NpcMove`         | **StackMax3** | Up to 3 independent queued; 4th+ increments `StackCount` instead of queuing |

`StackCount` on an `NpcMove` request controls particle `maxParticles` for a combined migration swarm visual:

```csharp
maxParticles = Mathf.Clamp(stackCount × 5, 10, 60);
```

---

## Replay Support

```csharp
// Feed historical delta events from /api/unity/delta/:worldSlug?lastTick=0
eventEffectManager.EnqueueBatch(historicalEvents);
// ↑ automatically sets replayMode=true for the duration of the batch
```

### Replay mode changes

| Parameter           | Normal mode | Replay mode (`replayMode = true`)    |
|---------------------|-------------|--------------------------------------|
| Effect duration     | Full         | ×0.1 (collapsed time)               |
| Flash alpha         | Full         | ×0.25 (dimmed)                      |
| Particle systems    | Spawned      | **Skipped entirely**                 |
| Float text          | Spawned      | **Skipped entirely**                 |
| Ingest rate cap     | Unlimited    | `replayIngestRate` events/s (default 200) |
| Queue throttle      | Normal       | Normal (still protects frame budget) |

Replay mode allows the client to fast-forward through event history (e.g. loading a world mid-session) without spawning hundreds of particle systems.

---

## Wiring Example

```csharp
public class MapManager : MonoBehaviour
{
    public WorldLoader             loader;
    public TerritoryRendererPool   pool;
    public ArmyMovementController  armyController;
    public HeatmapManager          heatmap;
    public EventEffectManager      effects;

    [SerializeField] string clientId = "unity-client-1";

    private float _lastTick = 0f;
    private float _deltaInterval = 2.0f;  // poll delta every 2 seconds

    private void Start()
    {
        loader.OnStateRefreshed += OnState;
        StartCoroutine(PollDelta());
    }

    private void OnState(MapStateDto state)
    {
        pool.SyncFromState(state.territories);
        armyController.SyncFromState(state);
        heatmap.RefreshData(state);
    }

    private IEnumerator PollDelta()
    {
        while (true)
        {
            yield return new WaitForSeconds(_deltaInterval);
            // Your delta fetch → foreach (var evt in response.events) effects.Enqueue(evt);
        }
    }
}
```

---

## Float Text Requirements

`floatTextPrefab` must have:
- A `Canvas` (World Space, `sortingLayerName = "UI"`)
- A `TextMeshProUGUI` child component
- No `ContentSizeFitter` or layout groups (text is set directly)

Text animates upward `floatTextHeight` units (default 3.0) over 2 seconds while alpha fades to 0, then destroys itself. Not shown in replay mode.

---

## File List

| File                                | Purpose                                              |
|-------------------------------------|------------------------------------------------------|
| `UnityClient/EventEffectManager.cs` | Manager, queue, all 8 effect implementations         |
| `docs/PHASE7_6_EVENT_EFFECTS.md`    | This document — audit, rules, wiring                 |
