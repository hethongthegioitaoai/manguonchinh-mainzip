using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Phase 7.6 — EventEffectManager
    ///
    /// Receives DeltaEvent payloads from GET /api/unity/delta/:worldSlug and plays
    /// per-territory or per-army visual effects via ParticleSystem, LineRenderer,
    /// and MaterialPropertyBlock. No audio — pure visual.
    ///
    /// Supported event types (delta type → source event names)
    /// --------------------------------------------------------
    ///   "territory_capture"     ← territory_capture
    ///   "territory_collapse"    ← territory_collapse
    ///   "territory_recolonized" ← territory_recolonized
    ///   "army_siege"            ← army_siege_started, army_siege_ended
    ///   "army_arrived"          ← army_arrived
    ///   "army_move"             ← army_move     (bulk, minimal effect)
    ///   "npc_move"              ← npc_migrate, npc_goal_changed, npc_birth, npc_death
    ///
    /// Queue architecture
    /// -------------------
    ///   All incoming events are enqueued as EffectRequest objects.
    ///   Each Update() tick dequeues and starts effects respecting:
    ///     1. Global throttle     — max N effects per second across all channels
    ///     2. Per-channel throttle — max M effects per second on a single territory/army
    ///     3. Stacking rules      — per-effect-type rules on same channel
    ///
    /// Stacking rules per effect type
    /// --------------------------------
    ///   territory_capture    REPLACE    — newer capture replaces active one on same territory
    ///   territory_collapse   SKIP       — skip if already playing on this territory
    ///   territory_recolonized SKIP      — skip if already playing on this territory
    ///   army_siege           EXTEND     — extend active siege ring; skip duplicate start
    ///   army_arrived         REPLACE    — always show (brief, low cost)
    ///   army_move            SKIP       — skip if already queued for same army
    ///   npc_move             STACK_MAX3 — collapse to one larger effect if ≥3 queued for same territory
    ///
    /// Replay support
    /// ---------------
    ///   Set replayMode = true before feeding historical events.
    ///   In replay mode: particles are skipped, flash effects play at 25% alpha,
    ///   duration is 0.1× normal, and all effects are non-blocking.
    ///   Set replayMode = false when switching back to live events.
    ///
    /// Payload field reference (from unityDelta.ts DeltaEvent.changes)
    /// ------------------------------------------------------------------
    ///   territory_capture:     territoryId, attackerName, defenderName, attackerWon (bool), refugeeCount
    ///   territory_collapse:    territoryId, territoryName, population, security
    ///   territory_recolonized: territoryId, settlers, fromTerritoryId
    ///   army_siege:            armyMovementId | armyId, territoryId
    ///   army_arrived:          armyId, territoryId (implied by entityId)
    ///   army_move:             updated (int), arrived (int) — bulk, no specific army id
    ///   npc_move:              npcId, territoryId (npc_migrate) / npcId (birth/death)
    ///
    /// Effect-to-territory resolution
    /// --------------------------------
    ///   All territory effects call TerritoryRendererPool.Get(territoryId) to get the
    ///   transform. Army effects call ArmyMovementController.Get(armyId) for position.
    ///   Unknown entities are silently skipped (pool returns null).
    /// </summary>
    public class EventEffectManager : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────────────────
        // Nested types
        // ─────────────────────────────────────────────────────────────────────────

        public enum StackingRule { Replace, Skip, Extend, StackMax3 }

        public enum EffectType
        {
            Capture,
            Collapse,
            Recolonize,
            Siege,
            SiegeEnd,
            ArmyArrived,
            ArmyMove,
            NpcMove,
        }

        private class EffectRequest
        {
            public EffectType     Type;
            public string         ChannelId;    // territoryId or armyId
            public DeltaEvent     Source;
            public float          EnqueuedAt;   // Time.unscaledTime
            public int            StackCount;   // for StackMax3 channels
        }

        private class ChannelState
        {
            public Coroutine      ActiveCoroutine;
            public EffectType?    ActiveType;
            public float          LastPlayedAt;
            public float          NextAllowedAt;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — dependencies
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Dependencies")]
        public TerritoryRendererPool   rendererPool;
        public ArmyMovementController  armyController;

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — throttle
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Throttle")]
        [Tooltip("Maximum total effects that can START per second globally.")]
        [Range(1, 30)]
        public int   maxGlobalPerSecond   = 8;

        [Tooltip("Maximum effects per second on the same territory/army channel.")]
        [Range(1, 10)]
        public int   maxChannelPerSecond  = 2;

        [Tooltip("How long an enqueued request stays valid before being dropped (seconds).")]
        [Range(1f, 30f)]
        public float requestTtl           = 8f;

        [Tooltip("Maximum items in queue before oldest non-critical events are dropped.")]
        [Range(8, 512)]
        public int   maxQueueDepth        = 128;

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — replay
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Replay")]
        [Tooltip("When true: 0.1× duration, 0.25× alpha, no particles. " +
                 "Feed historical delta events without visual spam.")]
        public bool replayMode = false;

        [Tooltip("Max enqueue rate when replaying (events/second). 0 = unlimited.")]
        [Range(0, 1000)]
        public int  replayIngestRate = 200;

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — effect durations (normal mode)
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Durations (seconds, normal mode)")]
        public float durationCapture     = 2.0f;
        public float durationCollapse    = 3.0f;
        public float durationRecolonize  = 2.5f;
        public float durationSiege       = 0f;    // 0 = until siege_ended event
        public float durationArrived     = 0.5f;
        public float durationArmyMove    = 0.25f;
        public float durationNpcMove     = 1.0f;

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — particle prefabs
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Particle Prefabs")]
        [Tooltip("Explosion ring prefab played at capture/victory territory.")]
        public ParticleSystem captureParticles;
        [Tooltip("Dust/rubble prefab for collapse.")]
        public ParticleSystem collapseParticles;
        [Tooltip("Green bloom / settler dots for recolonization.")]
        public ParticleSystem recolonizeParticles;
        [Tooltip("Impact sparks at siege target.")]
        public ParticleSystem siegeImpactParticles;
        [Tooltip("Small dot stream for NPC migration.")]
        public ParticleSystem npcMigrateParticles;

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — flash colours
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Flash Colours")]
        public Color captureWinColor  = new Color(0.937f, 0.267f, 0.267f, 0.85f); // #ef4444
        public Color captureLoseColor = new Color(0.545f, 0.361f, 0.965f, 0.85f); // #8b5cf6
        public Color collapseColor    = new Color(0.200f, 0.200f, 0.200f, 0.90f); // dark grey
        public Color recolonizeColor  = new Color(0.133f, 0.773f, 0.333f, 0.75f); // #22c55e
        public Color siegeColor       = new Color(0.937f, 0.267f, 0.267f, 0.70f); // #ef4444

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — float-text popup
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Float Text")]
        [Tooltip("Optional prefab with TextMeshProUGUI. Animated upward + fade out.")]
        public GameObject floatTextPrefab;
        public float      floatTextSpeed  = 1.5f;
        public float      floatTextHeight = 3.0f;

        // ─────────────────────────────────────────────────────────────────────────
        // Events
        // ─────────────────────────────────────────────────────────────────────────

        public event Action<EffectType, string> OnEffectStarted;
        public event Action<EffectType, string> OnEffectEnded;

        // ─────────────────────────────────────────────────────────────────────────
        // Private state
        // ─────────────────────────────────────────────────────────────────────────

        private readonly Queue<EffectRequest>         _queue        = new();
        private readonly Dictionary<string, ChannelState> _channels = new();
        private readonly Dictionary<string, Coroutine>    _activeSieges = new(); // armyId → siege coroutine

        // Active siege ring colours per territory (keep pulsing until siege_ended)
        private readonly HashSet<string> _activeSiegeTerritories = new();

        // Global throttle budget
        private float _globalTokens;
        private float _globalLastRefill;

        // Replay ingest throttle
        private float _replayIngestTokens;
        private float _replayLastRefill;

        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private MaterialPropertyBlock _mpb;

        // ─────────────────────────────────────────────────────────────────────────
        // Lifecycle
        // ─────────────────────────────────────────────────────────────────────────

        private void Awake()
        {
            _mpb = new MaterialPropertyBlock();
            _globalTokens       = maxGlobalPerSecond;
            _globalLastRefill   = Time.unscaledTime;
            _replayIngestTokens = replayIngestRate;
            _replayLastRefill   = Time.unscaledTime;
        }

        private void Update()
        {
            RefillGlobalTokens();
            ProcessQueue();
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Public API
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Enqueue a delta event for visual processing.
        /// Call this from your delta-stream consumer for every event received.
        /// Safe to call every frame — throttling is handled internally.
        /// </summary>
        public void Enqueue(DeltaEvent evt)
        {
            if (!TryParseEffect(evt, out EffectType effectType, out string channelId))
                return;

            // Replay ingest rate-limiting
            if (replayMode && replayIngestRate > 0)
            {
                float now = Time.unscaledTime;
                float elapsed = now - _replayLastRefill;
                _replayIngestTokens = Mathf.Min(replayIngestRate, _replayIngestTokens + elapsed * replayIngestRate);
                _replayLastRefill = now;
                if (_replayIngestTokens < 1f) return;
                _replayIngestTokens -= 1f;
            }

            // Apply stacking rules before queuing
            if (!PassesStackingRules(effectType, channelId, evt)) return;

            // Drop oldest non-critical event if queue full
            if (_queue.Count >= maxQueueDepth)
                DropOldestNonCritical();

            _queue.Enqueue(new EffectRequest
            {
                Type       = effectType,
                ChannelId  = channelId,
                Source     = evt,
                EnqueuedAt = Time.unscaledTime,
                StackCount = 1,
            });
        }

        /// <summary>
        /// Feed a batch of historical events (e.g. from a delta replay endpoint).
        /// Automatically enables replay mode for the duration of the batch.
        /// </summary>
        public void EnqueueBatch(IEnumerable<DeltaEvent> events)
        {
            bool wasReplay = replayMode;
            replayMode = true;
            foreach (var evt in events) Enqueue(evt);
            replayMode = wasReplay;
        }

        /// <summary>Clear the queue and stop all active effects immediately.</summary>
        public void ClearAll()
        {
            _queue.Clear();
            foreach (var ch in _channels.Values)
                if (ch.ActiveCoroutine != null) StopCoroutine(ch.ActiveCoroutine);
            _channels.Clear();
            _activeSieges.Clear();
            _activeSiegeTerritories.Clear();
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Queue processing
        // ─────────────────────────────────────────────────────────────────────────

        private void ProcessQueue()
        {
            if (_queue.Count == 0) return;

            float now = Time.unscaledTime;
            int processed = 0;

            while (_queue.Count > 0 && _globalTokens >= 1f)
            {
                var req = _queue.Peek();

                // TTL check
                if (now - req.EnqueuedAt > requestTtl)
                {
                    _queue.Dequeue();
                    continue;
                }

                // Channel throttle check
                var ch = GetOrCreateChannel(req.ChannelId);
                if (now < ch.NextAllowedAt)
                {
                    // Can't play this channel yet — try to skip past to another channel
                    if (processed > 0) break;
                    _queue.Dequeue();
                    _queue.Enqueue(req); // requeue at back
                    processed++;
                    continue;
                }

                // Resolve target transform
                var targetTransform = ResolveTransform(req);
                if (targetTransform == null)
                {
                    // Entity not found — discard silently
                    _queue.Dequeue();
                    continue;
                }

                _queue.Dequeue();
                _globalTokens -= 1f;

                ch.NextAllowedAt  = now + (1f / maxChannelPerSecond);
                ch.LastPlayedAt   = now;

                // Stop previous effect on this channel (for Replace rule)
                if (ch.ActiveCoroutine != null)
                    StopCoroutine(ch.ActiveCoroutine);

                ch.ActiveType = req.Type;
                ch.ActiveCoroutine = StartCoroutine(
                    PlayEffect(req, targetTransform, ch));

                processed++;
            }
        }

        private void RefillGlobalTokens()
        {
            float now = Time.unscaledTime;
            float elapsed = now - _globalLastRefill;
            _globalTokens = Mathf.Min(maxGlobalPerSecond, _globalTokens + elapsed * maxGlobalPerSecond);
            _globalLastRefill = now;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Effect dispatch
        // ─────────────────────────────────────────────────────────────────────────

        private IEnumerator PlayEffect(EffectRequest req, Transform target, ChannelState ch)
        {
            OnEffectStarted?.Invoke(req.Type, req.ChannelId);

            yield return req.Type switch
            {
                EffectType.Capture     => PlayCapture(req, target),
                EffectType.Collapse    => PlayCollapse(req, target),
                EffectType.Recolonize  => PlayRecolonize(req, target),
                EffectType.Siege       => PlaySiege(req, target),
                EffectType.SiegeEnd    => PlaySiegeEnd(req, target),
                EffectType.ArmyArrived => PlayArmyArrived(req, target),
                EffectType.ArmyMove    => PlayArmyMove(req, target),
                EffectType.NpcMove     => PlayNpcMove(req, target),
                _                      => null,
            };

            ch.ActiveCoroutine = null;
            ch.ActiveType      = null;
            OnEffectEnded?.Invoke(req.Type, req.ChannelId);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Effect implementations
        // ─────────────────────────────────────────────────────────────────────────

        // ── territory_capture ────────────────────────────────────────────────────
        // Payload: { attackerWon (bool), attackerName, defenderName, refugeeCount }
        // Visual:  Flash conquest colour → fade, conquest ring burst, float text

        private IEnumerator PlayCapture(EffectRequest req, Transform target)
        {
            bool attackerWon = GetBool(req.Source.changes, "attackerWon");
            string attackerName = GetStr(req.Source.changes, "attackerName", "Unknown");
            int refugees = GetInt(req.Source.changes, "refugeeCount");

            Color flashColor = attackerWon ? captureWinColor : captureLoseColor;
            float duration = replayMode ? durationCapture * 0.1f : durationCapture;

            // Flash the HeatmapLayer (or a dedicated flash SpriteRenderer)
            var sr = GetFlashLayer(target);
            if (sr != null) yield return FlashColor(sr, flashColor, duration);

            // Particles
            if (!replayMode && captureParticles != null)
            {
                var ps = Instantiate(captureParticles, target.position, Quaternion.identity);
                var main = ps.main;
                main.startColor = flashColor;
                ps.Play();
                Destroy(ps.gameObject, ps.main.duration + ps.main.startLifetime.constantMax);
            }

            // Float text
            if (!replayMode)
            {
                string label = attackerWon
                    ? $"⚔ {attackerName} captured!\n{refugees} refugees"
                    : $"⚔ {attackerName} repelled!";
                SpawnFloatText(target.position, label, flashColor);
            }

            yield return new WaitForSeconds(duration);
        }

        // ── territory_collapse ───────────────────────────────────────────────────
        // Payload: { territoryName, population, security }
        // Visual:  Desaturate flash, dust particles, "Collapsed" float text

        private IEnumerator PlayCollapse(EffectRequest req, Transform target)
        {
            string name = GetStr(req.Source.changes, "territoryName", "Territory");
            float duration = replayMode ? durationCollapse * 0.1f : durationCollapse;

            var sr = GetFlashLayer(target);
            if (sr != null) yield return FlashColor(sr, collapseColor, duration * 0.6f);

            if (!replayMode && collapseParticles != null)
            {
                var ps = Instantiate(collapseParticles, target.position, Quaternion.identity);
                ps.Play();
                Destroy(ps.gameObject, ps.main.duration + ps.main.startLifetime.constantMax);
            }

            if (!replayMode)
                SpawnFloatText(target.position, $"💀 {name} collapsed", collapseColor);

            yield return new WaitForSeconds(duration);
        }

        // ── territory_recolonized ────────────────────────────────────────────────
        // Payload: { territoryName, settlers (int), fromTerritoryName }
        // Visual:  Green bloom, settler particle burst, "Recolonized" float text

        private IEnumerator PlayRecolonize(EffectRequest req, Transform target)
        {
            string name    = GetStr(req.Source.changes, "territoryName", "Territory");
            int settlers   = GetInt(req.Source.changes, "settlers");
            string from    = GetStr(req.Source.changes, "fromTerritoryName", "");
            float duration = replayMode ? durationRecolonize * 0.1f : durationRecolonize;

            Color flashCol = AdjustAlpha(recolonizeColor, replayMode ? recolonizeColor.a * 0.25f : recolonizeColor.a);
            var sr = GetFlashLayer(target);
            if (sr != null) yield return FlashColor(sr, flashCol, duration * 0.4f);

            if (!replayMode && recolonizeParticles != null)
            {
                var ps = Instantiate(recolonizeParticles, target.position, Quaternion.identity);
                var main = ps.main;
                main.maxParticles = Mathf.Clamp(settlers / 20, 5, 80);
                ps.Play();
                Destroy(ps.gameObject, ps.main.duration + ps.main.startLifetime.constantMax);
            }

            if (!replayMode)
            {
                string label = from.Length > 0
                    ? $"🌱 {name} recolonized\n{settlers} settlers from {from}"
                    : $"🌱 {name} recolonized";
                SpawnFloatText(target.position, label, recolonizeColor);
            }

            yield return new WaitForSeconds(duration);
        }

        // ── army_siege (siege_started) ───────────────────────────────────────────
        // Payload: { armyMovementId | armyId, territoryId }
        // Visual:  Pulsing red ring on target territory; persists until army_siege_ended

        private IEnumerator PlaySiege(EffectRequest req, Transform target)
        {
            _activeSiegeTerritories.Add(req.ChannelId);

            if (!replayMode && siegeImpactParticles != null)
            {
                var ps = Instantiate(siegeImpactParticles, target.position, Quaternion.identity);
                ps.Play();
                Destroy(ps.gameObject, ps.main.duration + ps.main.startLifetime.constantMax);
            }

            if (!replayMode)
                SpawnFloatText(target.position, "⚔ Siege!", siegeColor);

            float elapsed = 0f;
            var sr = GetFlashLayer(target);

            // Pulse as long as siege is active (or until durationSiege seconds if set)
            while (true)
            {
                if (!_activeSiegeTerritories.Contains(req.ChannelId)) break;
                if (durationSiege > 0f && elapsed > durationSiege)        break;

                if (sr != null)
                {
                    float a = Mathf.Lerp(0.1f, 0.6f,
                        (Mathf.Sin(elapsed * 2.5f * Mathf.PI * 2f) + 1f) * 0.5f);
                    Color c = siegeColor;
                    c.a = replayMode ? a * 0.25f : a;
                    sr.GetPropertyBlock(_mpb);
                    _mpb.SetColor(ColorId, c);
                    sr.SetPropertyBlock(_mpb);
                    sr.gameObject.SetActive(true);
                }

                elapsed += Time.deltaTime;
                yield return null;
            }

            // Fade out the siege ring
            if (sr != null) yield return FadeOutLayer(sr, 0.3f);
        }

        // ── army_siege (siege_ended) ─────────────────────────────────────────────

        private IEnumerator PlaySiegeEnd(EffectRequest req, Transform target)
        {
            _activeSiegeTerritories.Remove(req.ChannelId);
            if (!replayMode)
                SpawnFloatText(target.position, "☮ Siege ended", Color.white);
            yield return new WaitForSeconds(0.1f);
        }

        // ── army_arrived ─────────────────────────────────────────────────────────
        // entityId = armyId; target = army icon transform
        // Visual:  Brief white flash on army icon

        private IEnumerator PlayArmyArrived(EffectRequest req, Transform target)
        {
            float duration = replayMode ? durationArrived * 0.1f : durationArrived;
            var sr = target.GetComponent<SpriteRenderer>() ??
                     target.GetComponentInChildren<SpriteRenderer>();
            if (sr != null) yield return FlashColor(sr, arrivedFlashColor, duration);
            yield return new WaitForSeconds(duration);
        }

        [Header("Army Arrived Flash")]
        public Color arrivedFlashColor = new Color(1f, 1f, 1f, 0.8f);

        // ── army_move ────────────────────────────────────────────────────────────
        // Bulk event — just a tiny pulse, no particles

        private IEnumerator PlayArmyMove(EffectRequest req, Transform target)
        {
            yield return new WaitForSeconds(replayMode ? 0f : durationArmyMove);
        }

        // ── npc_move ─────────────────────────────────────────────────────────────
        // Covers: npc_migrate, npc_birth, npc_death, npc_goal_changed
        // Visual:  Small dot burst (migrate) / green flash (birth) / grey flash (death)

        private IEnumerator PlayNpcMove(EffectRequest req, Transform target)
        {
            float duration = replayMode ? durationNpcMove * 0.1f : durationNpcMove;
            string rawType = GetStr(req.Source.changes, "_sourceEvent", "npc_migrate");

            // Determine sub-type from source event stored in changes (see Enqueue enrichment)
            // Fallback: treat all as migration
            bool isBirth = rawType == "npc_birth";
            bool isDeath = rawType == "npc_death";

            Color flashCol = isBirth  ? new Color(0.133f, 0.773f, 0.333f, 0.5f)   // green
                           : isDeath  ? new Color(0.400f, 0.400f, 0.400f, 0.5f)   // grey
                           : new Color(0.373f, 0.647f, 0.980f, 0.4f);             // blue — migration

            int stacks = req.StackCount;
            if (stacks >= 3 && !replayMode && npcMigrateParticles != null)
            {
                var ps = Instantiate(npcMigrateParticles, target.position, Quaternion.identity);
                var main = ps.main;
                main.maxParticles = Mathf.Clamp(stacks * 5, 10, 60);
                main.startColor = flashCol;
                ps.Play();
                Destroy(ps.gameObject, ps.main.duration + ps.main.startLifetime.constantMax);
            }
            else if (!replayMode)
            {
                var sr = GetFlashLayer(target);
                if (sr != null) yield return FlashColor(sr, flashCol, duration * 0.3f);
            }

            yield return new WaitForSeconds(duration);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Stacking rules
        // ─────────────────────────────────────────────────────────────────────────

        private bool PassesStackingRules(EffectType type, string channelId, DeltaEvent evt)
        {
            var ch = GetOrCreateChannel(channelId);

            switch (type)
            {
                case EffectType.Capture:
                    // Replace: always allow — ProcessQueue will stop the old coroutine
                    return true;

                case EffectType.Collapse:
                case EffectType.Recolonize:
                    // Skip if the same type is already active or queued for this channel
                    if (ch.ActiveType == type) return false;
                    return !IsQueued(channelId, type);

                case EffectType.Siege:
                    // Skip if siege already active on this territory
                    if (_activeSiegeTerritories.Contains(channelId)) return false;
                    return !IsQueued(channelId, EffectType.Siege);

                case EffectType.SiegeEnd:
                    return true; // always process siege end

                case EffectType.ArmyMove:
                    // Skip if already queued for this army
                    return !IsQueued(channelId, EffectType.ArmyMove);

                case EffectType.NpcMove:
                    // StackMax3: if 3+ already queued for this channel, coalesce
                    int existing = CountQueued(channelId, EffectType.NpcMove);
                    if (existing >= 3)
                    {
                        IncrementStackCount(channelId, EffectType.NpcMove);
                        return false; // don't add another — increment existing
                    }
                    return true;

                default:
                    return true;
            }
        }

        private bool IsQueued(string channelId, EffectType type)
        {
            foreach (var req in _queue)
                if (req.ChannelId == channelId && req.Type == type) return true;
            return false;
        }

        private int CountQueued(string channelId, EffectType type)
        {
            int n = 0;
            foreach (var req in _queue)
                if (req.ChannelId == channelId && req.Type == type) n++;
            return n;
        }

        private void IncrementStackCount(string channelId, EffectType type)
        {
            foreach (var req in _queue)
                if (req.ChannelId == channelId && req.Type == type) { req.StackCount++; return; }
        }

        private void DropOldestNonCritical()
        {
            // Convert to list, find oldest NpcMove or ArmyMove and remove it
            var list = new List<EffectRequest>(_queue);
            int oldest = -1;
            float oldestTime = float.MaxValue;
            for (int i = 0; i < list.Count; i++)
            {
                if ((list[i].Type == EffectType.NpcMove || list[i].Type == EffectType.ArmyMove)
                    && list[i].EnqueuedAt < oldestTime)
                {
                    oldest = i;
                    oldestTime = list[i].EnqueuedAt;
                }
            }
            if (oldest >= 0)
            {
                list.RemoveAt(oldest);
                _queue.Clear();
                foreach (var r in list) _queue.Enqueue(r);
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Event parsing
        // ─────────────────────────────────────────────────────────────────────────

        private bool TryParseEffect(DeltaEvent evt, out EffectType type, out string channelId)
        {
            type      = EffectType.NpcMove;
            channelId = evt.entityId;

            switch (evt.type)
            {
                case "territory_capture":
                    type      = EffectType.Capture;
                    channelId = GetStr(evt.changes, "territoryId", evt.entityId);
                    return true;

                case "territory_collapse":
                    type      = EffectType.Collapse;
                    channelId = GetStr(evt.changes, "territoryId", evt.entityId);
                    return true;

                case "territory_recolonized":
                    type      = EffectType.Recolonize;
                    channelId = GetStr(evt.changes, "territoryId", evt.entityId);
                    return true;

                case "army_siege":
                    // Both army_siege_started and army_siege_ended map to "army_siege"
                    // Distinguish by looking for a sub-event hint or status field
                    bool ended = GetStr(evt.changes, "status", "") == "ended" ||
                                 GetStr(evt.changes, "_sourceEvent", "") == "army_siege_ended";
                    type = ended ? EffectType.SiegeEnd : EffectType.Siege;
                    // Channel on the TERRITORY where the siege happens
                    channelId = GetStr(evt.changes, "territoryId", evt.entityId);
                    return true;

                case "army_arrived":
                    type      = EffectType.ArmyArrived;
                    channelId = evt.entityId; // armyId
                    return true;

                case "army_move":
                    type      = EffectType.ArmyMove;
                    channelId = evt.entityId;
                    return true;

                case "npc_move":
                    type      = EffectType.NpcMove;
                    channelId = GetStr(evt.changes, "territoryId", evt.entityId);
                    // Store source event type for sub-type detection
                    evt.changes["_sourceEvent"] = GetStr(evt.changes, "_sourceEvent",
                        GetStr(evt.changes, "event", "npc_migrate"));
                    return !string.IsNullOrEmpty(channelId);

                default:
                    return false;
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Transform resolution
        // ─────────────────────────────────────────────────────────────────────────

        private Transform ResolveTransform(EffectRequest req)
        {
            switch (req.Type)
            {
                case EffectType.ArmyArrived:
                case EffectType.ArmyMove:
                    var army = armyController?.Get(req.ChannelId);
                    return army != null ? army.transform : null;

                default:
                    // Territory-based effects
                    var tr = rendererPool?.Get(req.ChannelId);
                    return tr != null ? tr.transform : null;
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Visual primitives
        // ─────────────────────────────────────────────────────────────────────────

        private IEnumerator FlashColor(SpriteRenderer sr, Color target, float duration)
        {
            if (sr == null || duration <= 0f) yield break;

            sr.GetPropertyBlock(_mpb);
            Color original = _mpb.GetColor(ColorId);
            if (original.a < 0.01f) original = Color.clear;

            float half = duration * 0.4f;
            sr.gameObject.SetActive(true);

            // Flash in
            float elapsed = 0f;
            while (elapsed < half)
            {
                elapsed += Time.deltaTime;
                Color c = Color.Lerp(original, target, elapsed / half);
                sr.GetPropertyBlock(_mpb);
                _mpb.SetColor(ColorId, c);
                sr.SetPropertyBlock(_mpb);
                yield return null;
            }

            // Flash out
            elapsed = 0f;
            float fadeTime = duration * 0.6f;
            while (elapsed < fadeTime)
            {
                elapsed += Time.deltaTime;
                Color c = Color.Lerp(target, original, elapsed / fadeTime);
                sr.GetPropertyBlock(_mpb);
                _mpb.SetColor(ColorId, c);
                sr.SetPropertyBlock(_mpb);
                yield return null;
            }

            // Restore
            sr.GetPropertyBlock(_mpb);
            _mpb.SetColor(ColorId, original);
            sr.SetPropertyBlock(_mpb);
        }

        private IEnumerator FadeOutLayer(SpriteRenderer sr, float duration)
        {
            if (sr == null) yield break;
            sr.GetPropertyBlock(_mpb);
            Color start = _mpb.GetColor(ColorId);
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                Color c = start;
                c.a = Mathf.Lerp(start.a, 0f, elapsed / duration);
                sr.GetPropertyBlock(_mpb);
                _mpb.SetColor(ColorId, c);
                sr.SetPropertyBlock(_mpb);
                yield return null;
            }
            sr.gameObject.SetActive(false);
        }

        private void SpawnFloatText(Vector3 worldPos, string text, Color color)
        {
            if (floatTextPrefab == null || replayMode) return;
            var go = Instantiate(floatTextPrefab, worldPos + Vector3.up * 0.5f, Quaternion.identity);
            var label = go.GetComponentInChildren<TMPro.TextMeshProUGUI>();
            if (label != null)
            {
                label.text  = text;
                label.color = color;
            }
            StartCoroutine(AnimateFloatText(go.transform, color, label));
        }

        private IEnumerator AnimateFloatText(Transform t, Color color, TMPro.TextMeshProUGUI label)
        {
            float duration = 2.0f;
            float elapsed  = 0f;
            Vector3 start  = t.position;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float p = elapsed / duration;
                t.position = start + Vector3.up * (floatTextHeight * p);
                if (label != null)
                    label.color = new Color(color.r, color.g, color.b, Mathf.Lerp(1f, 0f, p));
                yield return null;
            }
            Destroy(t.gameObject);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Helpers
        // ─────────────────────────────────────────────────────────────────────────

        private ChannelState GetOrCreateChannel(string id)
        {
            if (!_channels.TryGetValue(id, out var ch))
            {
                ch = new ChannelState();
                _channels[id] = ch;
            }
            return ch;
        }

        private SpriteRenderer GetFlashLayer(Transform target)
        {
            // Look for "HeatmapLayer" child (same child used by Phase 7.4) for flash overlay
            var hml = target.Find("HeatmapLayer");
            if (hml != null) return hml.GetComponent<SpriteRenderer>();
            return target.GetComponentInChildren<SpriteRenderer>();
        }

        private static string GetStr(IDictionary<string, object> d, string key, string fallback = "")
        {
            if (d != null && d.TryGetValue(key, out object v) && v != null)
                return v.ToString();
            return fallback;
        }

        private static int GetInt(IDictionary<string, object> d, string key, int fallback = 0)
        {
            if (d != null && d.TryGetValue(key, out object v) && v != null &&
                int.TryParse(v.ToString(), out int result))
                return result;
            return fallback;
        }

        private static bool GetBool(IDictionary<string, object> d, string key, bool fallback = false)
        {
            if (d != null && d.TryGetValue(key, out object v) && v != null)
                return v.ToString() is "true" or "True" or "1";
            return fallback;
        }

        private static Color AdjustAlpha(Color c, float a) => new Color(c.r, c.g, c.b, a);
    }
}
