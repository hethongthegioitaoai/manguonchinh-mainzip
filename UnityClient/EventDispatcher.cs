using System;
using System.Collections.Generic;
using UnityEngine;

namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Phase 7.7 — EventDispatcher
    ///
    /// Routes WorldEventDto from WorldEventClient into the Phase 7.5/7.6 managers.
    /// Converts WorldEvent → DeltaEvent, detects tick gaps, and triggers
    /// ReplayController when events may have been missed.
    ///
    /// Data flow
    /// ----------
    ///   WorldEventClient.OnEventReceived
    ///     └─▶ EventDispatcher.OnRawEvent()
    ///           ├─ Enrich: store raw tick + worldSlug in ring buffer
    ///           ├─ Convert: WorldEventDto → DeltaEvent (for EventEffectManager)
    ///           ├─ Route:
    ///           │    EventEffectManager.Enqueue(delta)       — effects
    ///           │    ArmyMovementController.ApplyDeltaEvent(delta) — army pos
    ///           └─ Gap detection:
    ///                if tick > lastKnownTick + gapThreshold
    ///                  → ReplayController.FetchMissed(lastKnownTick, worldSlug)
    ///
    /// Ring buffer
    /// ------------
    ///   Stores the last ringBufferCapacity WorldEventDto instances.
    ///   Used by:
    ///     • ReplayController — avoids re-fetching events already in buffer
    ///     • Diagnostics — inspect recent events without a REST call
    ///   Oldest entry is silently overwritten when capacity is reached.
    ///   Memory at capacity: ~400 bytes × 2000 = ~800 KB.
    ///
    /// Gap detection
    /// --------------
    ///   Ticks are not necessarily contiguous (simulation may skip ticks between
    ///   world_tick events). Gap is detected when:
    ///     newTick > lastReceivedTick + gapThreshold
    ///   Default gapThreshold = 5 (tuned to skip normal tick gaps).
    ///   On gap: ReplayController.FetchMissed() is called once per gap detection.
    ///   Duplicate calls are debounced (replayDebounceSeconds).
    ///
    /// Reconnect recovery
    ///   WorldEventClient.OnConnected fires → triggers snapshot recovery
    ///   (delegates to WorldLoader, not ReplayController, since full state is needed)
    /// </summary>
    public class EventDispatcher : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────────────────
        // Inspector
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Dependencies")]
        public WorldEventClient        wsClient;
        public EventEffectManager      effects;
        public ArmyMovementController  armyController;
        public ReplayController        replay;
        public WorldLoader             loader;

        [Header("Ring Buffer")]
        [Tooltip("Number of recent WorldEvents to keep in memory. ~400 bytes each.")]
        [Range(100, 10000)]
        public int ringBufferCapacity = 2000;

        [Header("Gap Detection")]
        [Tooltip("Tick jump larger than this triggers a missed-event replay fetch.")]
        [Range(1, 100)]
        public int  gapThreshold = 5;

        [Tooltip("Minimum seconds between consecutive replay fetch triggers.")]
        [Range(1f, 30f)]
        public float replayDebounceSeconds = 5f;

        [Header("Debug")]
        public bool verboseGapLog = false;

        // ─────────────────────────────────────────────────────────────────────────
        // Public state
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>Last tick successfully received from the WebSocket stream.</summary>
        public int  LastReceivedTick { get; private set; } = -1;

        /// <summary>Last worldSlug seen on the stream.</summary>
        public string LastWorldSlug { get; private set; }

        public int  TotalDispatched   { get; private set; }
        public int  TotalGapsDetected { get; private set; }

        /// <summary>Fires when a tick gap is detected (arg = gap size in ticks).</summary>
        public event Action<int> OnGapDetected;

        // ─────────────────────────────────────────────────────────────────────────
        // Private
        // ─────────────────────────────────────────────────────────────────────────

        // Ring buffer
        private WorldEventDto[] _ring;
        private int             _ringHead; // next write index
        private int             _ringCount;

        // Gap detection debounce
        private float _lastReplayTriggerTime = -999f;

        // ─────────────────────────────────────────────────────────────────────────
        // Lifecycle
        // ─────────────────────────────────────────────────────────────────────────

        private void Awake()
        {
            _ring = new WorldEventDto[ringBufferCapacity];
        }

        private void OnEnable()
        {
            if (wsClient != null)
            {
                wsClient.OnEventReceived += OnRawEvent;
                wsClient.OnConnected     += OnReconnected;
            }
        }

        private void OnDisable()
        {
            if (wsClient != null)
            {
                wsClient.OnEventReceived -= OnRawEvent;
                wsClient.OnConnected     -= OnReconnected;
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Core dispatch
        // ─────────────────────────────────────────────────────────────────────────

        private void OnRawEvent(WorldEventDto evt)
        {
            if (evt == null) return;

            // Ring buffer write (always — even if we drop the effect)
            WriteRing(evt);

            // Gap detection
            if (LastReceivedTick >= 0 && evt.tick > LastReceivedTick + gapThreshold)
            {
                int gap = evt.tick - LastReceivedTick;
                TotalGapsDetected++;
                OnGapDetected?.Invoke(gap);

                if (verboseGapLog)
                    Debug.Log($"[Dispatcher] Gap detected: {LastReceivedTick}→{evt.tick} (+{gap} ticks)");

                TryTriggerReplay(evt.worldSlug, LastReceivedTick);
            }

            LastReceivedTick = Mathf.Max(LastReceivedTick, evt.tick);
            LastWorldSlug    = evt.worldSlug;
            TotalDispatched++;

            // Convert and route
            DeltaEvent delta = ConvertToDelta(evt);

            effects?.Enqueue(delta);
            RouteToArmyController(delta, evt);
        }

        private void OnReconnected()
        {
            // After reconnect: request a fresh full-state snapshot to resync
            // visual state, then let replay fill any missed delta events.
            loader?.RequestRefresh();

            if (LastReceivedTick >= 0 && !string.IsNullOrEmpty(LastWorldSlug))
                TryTriggerReplay(LastWorldSlug, LastReceivedTick);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Conversion: WorldEventDto → DeltaEvent
        // ─────────────────────────────────────────────────────────────────────────

        private static DeltaEvent ConvertToDelta(WorldEventDto evt)
        {
            // Extract the inner delta type via the same EVENT_TYPE_MAP as unityDelta.ts
            string deltaType = MapEventType(evt.@event);

            // Build a changes dict from the raw payload
            var changes = ParsePayloadDict(evt.payloadRaw);

            // Store source event for sub-type detection (Phase 7.6 NpcMove/Siege)
            if (!changes.ContainsKey("_sourceEvent"))
                changes["_sourceEvent"] = evt.@event;

            // Extract entity id using the same priority chain as extractEntityId()
            string entityId = ExtractEntityId(evt.@event, changes, evt.worldSlug);

            return new DeltaEvent
            {
                type     = deltaType,
                tick     = evt.tick,
                entityId = entityId,
                changes  = changes,
            };
        }

        private void RouteToArmyController(DeltaEvent delta, WorldEventDto evt)
        {
            if (armyController == null) return;
            if (delta.type is "army_move" or "army_arrived" or "army_siege")
                armyController.ApplyDeltaEvent(delta);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Ring buffer
        // ─────────────────────────────────────────────────────────────────────────

        private void WriteRing(WorldEventDto evt)
        {
            _ring[_ringHead] = evt;
            _ringHead = (_ringHead + 1) % ringBufferCapacity;
            if (_ringCount < ringBufferCapacity) _ringCount++;
        }

        /// <summary>
        /// Returns all buffered events with tick &gt; sinceExclusive in chronological order.
        /// Used by ReplayController to check which missed events are already in buffer.
        /// </summary>
        public List<WorldEventDto> GetBufferedSince(int sinceExclusive)
        {
            var result = new List<WorldEventDto>(_ringCount);
            int count  = _ringCount;
            int start  = (_ringHead - count + ringBufferCapacity) % ringBufferCapacity;

            for (int i = 0; i < count; i++)
            {
                var e = _ring[(start + i) % ringBufferCapacity];
                if (e != null && e.tick > sinceExclusive)
                    result.Add(e);
            }

            result.Sort((a, b) => a.tick.CompareTo(b.tick));
            return result;
        }

        /// <summary>Snapshot of the full ring buffer contents (newest last).</summary>
        public List<WorldEventDto> GetBuffer()
        {
            var result = new List<WorldEventDto>(_ringCount);
            int start  = (_ringHead - _ringCount + ringBufferCapacity) % ringBufferCapacity;
            for (int i = 0; i < _ringCount; i++)
            {
                var e = _ring[(start + i) % ringBufferCapacity];
                if (e != null) result.Add(e);
            }
            return result;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Gap recovery
        // ─────────────────────────────────────────────────────────────────────────

        private void TryTriggerReplay(string worldSlug, int fromTick)
        {
            if (replay == null) return;
            float now = Time.unscaledTime;
            if (now - _lastReplayTriggerTime < replayDebounceSeconds) return;
            _lastReplayTriggerTime = now;
            replay.FetchMissed(worldSlug, fromTick);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Static helpers — mirror unityDelta.ts logic
        // ─────────────────────────────────────────────────────────────────────────

        private static string MapEventType(string evt) => evt switch
        {
            "territory_capture"    => "territory_capture",
            "territory_collapse"   => "territory_collapse",
            "territory_recolonized"=> "territory_recolonized",
            "army_move"            => "army_move",
            "army_arrived"         => "army_arrived",
            "army_siege_started"   => "army_siege",
            "army_siege_ended"     => "army_siege",
            "npc_migrate"          => "npc_move",
            "npc_goal_changed"     => "npc_move",
            "npc_birth"            => "npc_move",
            "npc_death"            => "npc_move",
            "faction_created"      => "faction_changed",
            "faction_leader_changed"=> "faction_changed",
            "election_result"      => "faction_changed",
            "diplomacy_action"     => "faction_changed",
            "world_war_start"      => "faction_changed",
            "world_war_end"        => "faction_changed",
            "battle_result"        => "faction_changed",
            "world_tick"           => "world_tick",
            _                      => evt,
        };

        private static string ExtractEntityId(string evt,
            Dictionary<string, object> p, string worldSlug)
        {
            string Get(string key) => p.TryGetValue(key, out var v) ? v?.ToString() ?? "" : "";

            return evt switch
            {
                "npc_migrate" or "npc_goal_changed" or "npc_birth" or "npc_death"
                    => NonEmpty(Get("npcId"), Get("id"), worldSlug),
                "territory_capture" or "territory_collapse" or "territory_recolonized"
                    => NonEmpty(Get("territoryId"), Get("id"), worldSlug),
                "army_move" or "army_arrived" or "army_siege_started" or "army_siege_ended"
                    => NonEmpty(Get("armyMovementId"), Get("armyId"), Get("id"), worldSlug),
                "faction_created" or "faction_leader_changed" or "election_result"
                or "world_war_start" or "world_war_end" or "battle_result"
                    => NonEmpty(Get("factionId"), Get("govId"), Get("warId"), Get("id"), worldSlug),
                "diplomacy_action"
                    => NonEmpty(Get("govA"), Get("factionId"), Get("id"), worldSlug),
                _   => NonEmpty(Get("id"), worldSlug),
            };
        }

        private static string NonEmpty(params string[] candidates)
        {
            foreach (var s in candidates)
                if (!string.IsNullOrEmpty(s)) return s;
            return string.Empty;
        }

        /// <summary>
        /// Minimal JSON object parser — extracts top-level string/number/bool fields.
        /// Does not handle arrays or nested objects (they are ignored).
        /// For production, replace with your project's JSON library (Newtonsoft, etc.)
        /// </summary>
        public static Dictionary<string, object> ParsePayloadDict(string json)
        {
            var dict = new Dictionary<string, object>();
            if (string.IsNullOrEmpty(json)) return dict;

            // Strip outer braces
            json = json.Trim();
            if (json.StartsWith("{")) json = json.Substring(1);
            if (json.EndsWith("}"))   json = json.Substring(0, json.Length - 1);

            // Split on top-level commas (naive but sufficient for flat payloads)
            int depth = 0;
            int start = 0;
            var pairs = new List<string>();
            for (int i = 0; i < json.Length; i++)
            {
                char c = json[i];
                if (c == '{' || c == '[') depth++;
                else if (c == '}' || c == ']') depth--;
                else if (c == ',' && depth == 0)
                {
                    pairs.Add(json.Substring(start, i - start).Trim());
                    start = i + 1;
                }
            }
            if (start < json.Length) pairs.Add(json.Substring(start).Trim());

            foreach (var pair in pairs)
            {
                int colon = pair.IndexOf(':');
                if (colon < 0) continue;
                string key = pair.Substring(0, colon).Trim().Trim('"');
                string val = pair.Substring(colon + 1).Trim();

                if (val.StartsWith("\"") && val.EndsWith("\""))
                    dict[key] = val.Substring(1, val.Length - 2);
                else if (val == "true")  dict[key] = true;
                else if (val == "false") dict[key] = false;
                else if (val == "null")  dict[key] = null;
                else if (val.StartsWith("{") || val.StartsWith("["))
                    dict[key] = val; // keep nested as raw string
                else if (double.TryParse(val, out double d))
                    dict[key] = d;
                else
                    dict[key] = val;
            }
            return dict;
        }
    }
}
