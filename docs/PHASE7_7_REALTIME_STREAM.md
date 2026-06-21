# Phase 7.7 — Realtime World Stream

Full-duplex live event delivery for the Unity client. Combines a persistent WebSocket for zero-latency live events with a paginated REST delta replay for gap recovery, reconnects, and cold-start catch-up.

---

## Server Audit

### WebSocket server (`artifacts/api-server/src/lib/unityWs.ts`)

| Property       | Value                                              |
|----------------|----------------------------------------------------|
| Path           | `/api/ws/unity`                                    |
| Library        | `ws` (Node.js)                                     |
| Subscribe msg  | `{ type: "subscribe", worlds: ["worldSlug"] }`     |
| Server ack     | `{ type: "subscribed", worlds: [...] }`            |
| Unsubscribe    | `{ type: "unsubscribe", worlds: [...] }`           |
| Ping           | `{ type: "ping" }` → `{ type: "pong" }`           |
| Broadcast shape| `WorldEvent { event, worldSlug, tick, ts, payload }`|
| Fan-out        | Per-world subscriber set (`worldSubs: Map<string, Set<WebSocket>>`) |
| Cleanup        | On `close` / `error` — auto-removed from all world sets |

WorldEvent broadcast format (confirmed in `unityWs.ts`):
```json
{
  "event":     "territory_capture",
  "worldSlug": "my-world",
  "tick":      1042,
  "ts":        1719000000000,
  "payload":   { "territoryId": "uuid", "attackerWon": true, ... }
}
```

### Delta REST endpoint (`artifacts/api-server/src/routes/unityDelta.ts`)

```
GET /api/unity/delta/:worldSlug
    ?lastTick={N}        — events where tick > N
    &clientId={id}       — server stores lastTickSent per worldSlug:clientId (in-memory)
    &limit={N}           — default 200, max 1000
```

Response:
```json
{
  "worldSlug":      "my-world",
  "lastTickSent":   1050,
  "previousCursor": 1000,
  "count":          47,
  "events": [
    { "type": "territory_capture", "tick": 1001, "entityId": "uuid", "changes": {...} },
    ...
  ]
}
```

### Event log retention (`artifacts/api-server/src/lib/eventBus.ts`)

- **RETENTION_LIMIT**: 100,000 events per world
- Pruned every 1,000 emits (fire-and-forget, keeps newest)
- Any gap within the last 100k events is recoverable via delta

### Snapshot endpoint (for full recovery)

```
GET /api/unity/map-state/:worldSlug
```
Returns complete MapStateDto. Used by WorldLoader (Phase 7.2). ReplayController delegates to `WorldLoader.RequestRefresh()` for snapshot recovery.

---

## Architecture

```
                     WebSocket (/api/ws/unity)
                            │
                     WorldEventClient          System.Net.WebSockets.ClientWebSocket
                     ├─ Background receive Task (ConcurrentQueue thread-safe handoff)
                     ├─ Auto-reconnect (exponential backoff 1s→16s)
                     └─ Heartbeat ping/pong (30s interval, 10s timeout)
                            │
                            │ OnEventReceived (main thread)
                            ▼
                     EventDispatcher
                     ├─ MapEventType() → delta type  (mirrors EVENT_TYPE_MAP)
                     ├─ ParsePayloadDict() → changes dict
                     ├─ ExtractEntityId() → entityId
                     ├─ Ring buffer (2000 events, ~800 KB)
                     ├─ Gap detection (tick jump > gapThreshold=5)
                     │    └─ ReplayController.FetchMissed() [debounced 5s]
                     └─ Route:
                          EventEffectManager.Enqueue(delta)
                          ArmyMovementController.ApplyDeltaEvent(delta)
                            │
                            │ On gap / reconnect
                            ▼
                     ReplayController
                     ├─ FetchMissed() → paginated GET /api/unity/delta
                     │    ├─ Page loop (1000/page, max 20 pages)
                     │    ├─ FilterAlreadyBuffered() (dedup with ring buffer)
                     │    ├─ effects.EnqueueBatch() in replayMode=true
                     │    └─ Snapshot fallback if gap > 5000 or 0 events returned
                     └─ SnapshotRecovery() → WorldLoader.RequestRefresh()
```

---

## Connection Lifecycle

```
Connect()
  │
  └─▶ ConnectLoop (Task)
        │
        ├─ ClientWebSocket.ConnectAsync(wsUrl)
        ├─ Send { type:"subscribe", worlds:[slug] }
        ├─ State = Connected; OnConnected fired (main thread)
        │
        └─▶ ReceiveLoop
              │
              ├─ Receives frames → ConcurrentQueue
              │
              ├─ On Close frame → graceful close → reconnect
              └─ On Error/Exception → reconnect after backoff
```

### Auto-reconnect backoff

```
Attempt 1:  wait 1s
Attempt 2:  wait 2s
Attempt 3:  wait 4s
Attempt 4:  wait 8s
Attempt 5+: wait 16s (capped)
```

`reconnectMaxAttempts = 0` means unlimited (default). On reconnect success: backoff resets to 1s.

### Heartbeat

```
Every 30s: send { type: "ping" }
           set awaitingPong = true, record lastPingTime
On pong:   awaitingPong = false, record lastPongTime
If no pong in 10s: ws.Abort() → triggers reconnect
```

---

## Thread Model

```
Background thread (Task)         Main thread (Update)
───────────────────────────      ─────────────────────────
ClientWebSocket.ReceiveAsync()   _inboundQueue.TryDequeue()
  │                                    │
  └─▶ _inboundQueue.Enqueue(raw)       └─▶ ParseAndDispatch(raw)
  (ConcurrentQueue — lock-free)            OnEventReceived?.Invoke(evt)

Background thread (ConnectLoop)  LateUpdate()
  │                              ─────────────────────────
  └─▶ _mainThreadQueue.Enqueue() _mainThreadQueue.TryDequeue()
       (state changes, events)         action()
```

All Unity API calls (`OnConnected`, `State =`, etc.) are marshalled to the main thread via `_mainThreadQueue` drained in `LateUpdate()`.

`maxDrainPerFrame = 50` caps per-frame processing time. At 50 events × ~5 µs/event ≈ 250 µs/frame overhead.

---

## Gap Detection & Replay

### Gap detection rule

```
if newEvent.tick > lastReceivedTick + gapThreshold(=5):
    gap = newEvent.tick - lastReceivedTick
    trigger ReplayController.FetchMissed(worldSlug, lastReceivedTick)
    [debounced: minimum 5s between triggers]
```

The `gapThreshold=5` tolerates the normal tick increment between `world_tick` events (which often come in bursts) without false-positive replay triggers.

### Replay session flow

```
FetchMissed(worldSlug, fromTick)
  │
  ├─ effects.replayMode = true
  │
  └─▶ Loop (max 20 pages):
        │
        ├─ GET /delta?lastTick={cursor}&limit=1000
        ├─ FilterAlreadyBuffered()    — skip events already in ring buffer
        ├─ effects.EnqueueBatch()     — replay mode: no particles, 0.1× duration
        ├─ dispatcher.SetLastReceivedTickFromReplay(lastTickSent)
        ├─ cursor = page.lastTickSent
        └─ if page.count < 1000: DONE (last page)
  │
  └─ effects.replayMode = false
```

### Snapshot fallback triggers

| Condition | Action |
|---|---|
| `delta.count == 0` on first page with non-zero gap | Snapshot recovery |
| `gap > snapshotFallbackThreshold` (5000 events) | Snapshot recovery |
| HTTP error after `maxRetries` (2) attempts | Snapshot recovery |
| Cold start (`lastReceivedTick == -1`) | Snapshot recovery (via OnConnected) |
| `lastReceivedTick == -1` on reconnect | Full `WorldLoader.LoadWorld()` |

---

## Stress-Test Architecture

### Event volume analysis

Simulation event rate from `stress-test-7.ts`:
- Random event probability: **28%** per tick (`if (Math.random() < 0.28)`)
- Plus mandatory events: `territory_collapse`, `territory_recolonized`, `army_move`, `territory_capture`

| Ticks | Estimated events | Pages (limit=1000) | Replay time (0.1s/page) |
|-------|-----------------|-------------------|------------------------|
| 1,000 | ~280            | **1**             | 0.1s                   |
| 5,000 | ~1,400          | **2**             | 0.2s                   |
| 10,000| ~2,800          | **3**             | 0.3s                   |
| 50,000| ~14,000         | **14**            | 1.4s                   |
| 100k* | ~28,000         | **28**            | 2.8s                   |

*100k approaches RETENTION_LIMIT — snapshot recovery recommended beyond this.

### Memory budget per scenario

| Component | 1k ticks | 5k ticks | 10k ticks | Notes |
|---|---|---|---|---|
| Ring buffer | 280 × 400B = **112 KB** | 1,400 × 400B = **560 KB** | 2,000 × 400B = **800 KB** (capped) | Fixed 2000 capacity |
| Active page | 280 × 500B = **140 KB** | 1,000 × 500B = **500 KB** | 1,000 × 500B = **500 KB** | Discarded after processing |
| Effect queue | ~50 items × 200B = **10 KB** | **10 KB** | **10 KB** | Fixed maxQueueDepth=128 |
| **Total peak** | **262 KB** | **1.07 MB** | **1.31 MB** | Well within mobile limits |

Ring buffer at 2000 entries (800 KB max) provides ~5000 tick coverage at 28% event rate. Events older than buffer capacity are fetched fresh via REST on reconnect.

### Performance strategy

1. **Page-at-a-time processing**: Each page of 1000 events is fed to `effects.EnqueueBatch()` and then discarded. Memory stays flat regardless of total gap size.

2. **Replay mode**: All historical events bypass particle systems and reduce duration to 0.1×. 10,000 events replay in <1 second wall time with negligible frame impact.

3. **Effect throttling** (Phase 7.6): `maxGlobalPerSecond=8` and `maxQueueDepth=128` ensure replayed events don't overwhelm the queue even if 2,800 events arrive at once.

4. **Inter-page delay**: `delayBetweenPages=0.1s` prevents server overload during large catch-ups. 14-page session takes ~1.4s — acceptable.

5. **FilterAlreadyBuffered()**: Deduplicates events that arrived via WebSocket and are already in the ring buffer, preventing double-effects during overlap windows.

---

## Ring Buffer Design

```
_ring: WorldEventDto[2000]    circular array
_ringHead: int                next write index
_ringCount: int               current fill level

Write: O(1)   — _ring[_ringHead] = evt; _ringHead = (_ringHead+1) % capacity
Read:  O(n)   — scan from oldest → newest for GetBufferedSince()
```

At 2000 capacity and ~400 bytes/event: **800 KB steady state**.

Oldest events silently overwritten when full — this is intentional. The REST delta endpoint covers events older than the buffer.

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
    public WorldEventClient        wsClient;
    public EventDispatcher         dispatcher;
    public ReplayController        replay;

    private void Start()
    {
        // Phase 7.2–7.4: full-state sync on every poll
        loader.OnStateRefreshed += state => {
            pool.SyncFromState(state.territories);
            armyController.SyncFromState(state);
            heatmap.RefreshData(state);
        };

        // Phase 7.7: WS ready → kick off missed-event catch-up
        wsClient.OnConnected    += () => replay.FetchMissed(loader.WorldSlug, dispatcher.LastReceivedTick);
        wsClient.OnDisconnected += reason => Debug.Log($"[WS] Disconnected: {reason}");

        // Replay events: effects only (no visual rebuild — snapshot handles that)
        replay.OnReplayComplete += total => Debug.Log($"[Replay] {total} events processed");
    }
}
```

---

## Inspector Checklist

### WorldEventClient
| Field | Recommended value |
|---|---|
| `wsUrl` | `ws://$REPLIT_DEV_DOMAIN/api/ws/unity` (dev) / `wss://app.replit.app/api/ws/unity` (prod) |
| `worldSlugs` | `["default"]` |
| `autoConnect` | true |
| `reconnectBaseDelay` | 1 |
| `reconnectMaxDelay` | 16 |
| `reconnectMaxAttempts` | 0 (unlimited) |
| `pingIntervalSeconds` | 30 |
| `pongTimeoutSeconds` | 10 |

### EventDispatcher
| Field | Recommended value |
|---|---|
| `ringBufferCapacity` | 2000 |
| `gapThreshold` | 5 |
| `replayDebounceSeconds` | 5 |

### ReplayController
| Field | Recommended value |
|---|---|
| `apiBaseUrl` | `http://localhost:8080` (dev) / `https://app.replit.app` (prod) |
| `clientId` | Unique per device/session — persist across reconnects |
| `pageLimit` | 1000 |
| `maxPagesPerSession` | 20 |
| `snapshotFallbackThreshold` | 5000 |

---

## File List

| File | Lines | Purpose |
|---|---|---|
| `UnityClient/WorldEventClient.cs` | WebSocket connection, reconnect, heartbeat, thread dispatch |
| `UnityClient/EventDispatcher.cs` | Event routing, type mapping, ring buffer, gap detection |
| `UnityClient/ReplayController.cs` | REST delta fetch, pagination, snapshot fallback |
| `docs/PHASE7_7_REALTIME_STREAM.md` | This document |
