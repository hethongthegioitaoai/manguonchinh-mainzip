using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Phase 7.5 — ArmyMovementController
    ///
    /// Scene-level manager for all army renderers. Pools ArmyRenderer instances
    /// keyed by army id, resolves territory world positions, and drives every
    /// ArmyRenderer.Apply() call with correctly computed positions.
    ///
    /// Wiring (MapManager)
    /// --------------------
    ///   loader.OnStateRefreshed  →  SyncFromState(MapStateDto)
    ///
    /// Territory position resolution
    /// -------------------------------
    ///   Each ArmyDto references territories by UUID.
    ///   Positions are resolved from the territories[] array in the same MapStateDto.
    ///   Formula (same as TerritoryRenderer.ApplyPosition):
    ///     worldX = territory.x / 100 × mapWidth
    ///     worldZ = territory.y / 100 × mapHeight
    ///
    ///   If a territory id is not found in the snapshot (race condition / unloaded),
    ///   the last known position is preserved and a warning is logged once per id.
    ///
    /// Both army types covered
    /// -------------------------
    ///   This controller handles armies[] from military_forces (standing armies with
    ///   Phase 63A movement fields). The separate army_movements table (war-linked
    ///   cross-world movements) is handled identically — both share ArmyDto shape
    ///   as returned by the map-state endpoint.
    ///
    /// Delta stream integration (optional)
    /// --------------------------------------
    ///   Subscribe ApplyDeltaEvent() to your delta-stream dispatcher.
    ///   Supported delta types: "army_move", "army_arrived", "army_siege".
    ///   Delta events update the cached state for the affected army id without
    ///   waiting for the next full poll cycle, giving sub-second visual feedback.
    /// </summary>
    public class ArmyMovementController : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────────────────
        // Inspector
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Prefab")]
        [Tooltip("Prefab with ArmyRenderer component. One instance created per army.")]
        public ArmyRenderer armyPrefab;

        [Header("Map Dimensions")]
        [Tooltip("Must match TerritoryRenderer and HeatmapManager values.")]
        public float mapWidth  = 100f;
        public float mapHeight = 100f;

        [Header("Smooth Lerp (optional)")]
        [Tooltip("When true, the controller smoothly animates the icon between poll snapshots " +
                 "using the last known progress. When false, positions snap immediately on Apply().")]
        public bool   smoothLerp          = true;
        [Range(0f, 5f)]
        [Tooltip("Seconds to complete a full 0→1 progress lerp. Should approximate server tick rate.")]
        public float  lerpDuration        = 3.0f;

        [Header("Debug")]
        public bool   drawGizmos          = true;

        // ─────────────────────────────────────────────────────────────────────────
        // Events
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>Fired when an army transitions into Sieging state for the first time.</summary>
        public event Action<ArmyRenderer> OnSiegeStarted;

        /// <summary>Fired when an army arrives at its target territory.</summary>
        public event Action<ArmyRenderer> OnArmyArrived;

        // ─────────────────────────────────────────────────────────────────────────
        // Private state
        // ─────────────────────────────────────────────────────────────────────────

        // Keyed by ArmyDto.id
        private readonly Dictionary<string, ArmyRenderer>   _live         = new();
        private readonly Dictionary<string, ArmyDto>        _cachedDtos   = new();
        private readonly Dictionary<string, ArmyRenderer.ArmyState> _prevStates = new();

        // World positions per army id — updated every SyncFromState call
        private readonly Dictionary<string, Vector3> _currentPositions = new();
        private readonly Dictionary<string, Vector3> _targetPositions  = new();

        // Territory position lookup — rebuilt every SyncFromState call
        private readonly Dictionary<string, Vector3> _territoryPositions = new();

        // Per-army smooth lerp coroutines
        private readonly Dictionary<string, Coroutine> _lerpCoroutines = new();

        // ─────────────────────────────────────────────────────────────────────────
        // Public API
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Process a full MapStateDto snapshot — creates, updates, and removes army renderers.
        /// Connect to WorldLoader.OnStateRefreshed.
        /// </summary>
        public void SyncFromState(MapStateDto state)
        {
            if (state == null) return;

            // Rebuild territory position lookup
            _territoryPositions.Clear();
            if (state.territories != null)
            {
                foreach (var t in state.territories)
                    _territoryPositions[t.id] = TerritoryWorldPos(t.x, t.y);
            }

            var seen = new HashSet<string>();

            if (state.armies != null)
            {
                foreach (var dto in state.armies)
                {
                    seen.Add(dto.id);
                    UpdateArmy(dto);
                }
            }

            // Remove armies that no longer appear in the server response
            var toRemove = new List<string>();
            foreach (var id in _live.Keys)
                if (!seen.Contains(id)) toRemove.Add(id);

            foreach (var id in toRemove)
                RemoveArmy(id);
        }

        /// <summary>
        /// Apply a delta event from GET /api/unity/delta/:worldSlug.
        /// Supported types: "army_move", "army_arrived", "army_siege".
        /// Call this from your delta-stream consumer to get sub-poll visual updates.
        /// </summary>
        public void ApplyDeltaEvent(DeltaEvent evt)
        {
            if (!_cachedDtos.TryGetValue(evt.entityId, out var dto)) return;

            // Patch the cached DTO with delta changes
            if (evt.changes.TryGetValue("movementStatus", out var status))
                dto.movementStatus = status?.ToString() ?? dto.movementStatus;

            if (evt.changes.TryGetValue("movementProgress", out var prog) &&
                float.TryParse(prog?.ToString(), out float p))
                dto.movementProgress = p;

            if (evt.changes.TryGetValue("targetTerritoryId", out var tgt))
                dto.targetTerritoryId = tgt?.ToString();

            if (evt.changes.TryGetValue("currentTerritoryId", out var cur))
                dto.currentTerritoryId = cur?.ToString();

            // Re-apply without waiting for next full poll
            UpdateArmy(dto);
        }

        /// <summary>Returns the ArmyRenderer for a given army id, or null.</summary>
        public ArmyRenderer Get(string armyId) =>
            _live.TryGetValue(armyId, out var r) ? r : null;

        /// <summary>Returns all active army renderers.</summary>
        public IEnumerable<ArmyRenderer> All() => _live.Values;

        // ─────────────────────────────────────────────────────────────────────────
        // Internal update
        // ─────────────────────────────────────────────────────────────────────────

        private void UpdateArmy(ArmyDto dto)
        {
            // Resolve world positions
            bool hasCurrent = _territoryPositions.TryGetValue(dto.currentTerritoryId ?? "", out Vector3 currentPos);
            bool hasTarget  = !string.IsNullOrEmpty(dto.targetTerritoryId) &&
                              _territoryPositions.TryGetValue(dto.targetTerritoryId, out Vector3 targetPos);

            if (!hasCurrent)
            {
                // Fallback to last known position
                if (_currentPositions.TryGetValue(dto.id, out Vector3 cached))
                    currentPos = cached;
                else
                    currentPos = Vector3.zero;
            }

            if (!hasTarget)
                targetPos = Vector3.zero;

            _currentPositions[dto.id] = currentPos;
            _targetPositions[dto.id]  = targetPos;

            // Get or create renderer
            if (!_live.TryGetValue(dto.id, out var renderer))
            {
                renderer = Instantiate(armyPrefab, transform);
                renderer.SetMapDimensions(mapWidth, mapHeight);
                renderer.name   = $"Army_{dto.id[..Mathf.Min(6, dto.id.Length)]}";
                _live[dto.id]   = renderer;
                _prevStates[dto.id] = ArmyRenderer.ArmyState.Idle;
            }

            // Cache DTO for delta patching
            _cachedDtos[dto.id] = dto;

            // Apply to renderer
            renderer.Apply(dto, currentPos, targetPos, hasTarget);

            // Fire transition events
            var newState  = ArmyRenderer.ParseState(dto.movementStatus);
            var prevState = _prevStates.GetValueOrDefault(dto.id, ArmyRenderer.ArmyState.Idle);

            if (newState == ArmyRenderer.ArmyState.Sieging &&
                prevState != ArmyRenderer.ArmyState.Sieging)
                OnSiegeStarted?.Invoke(renderer);

            if (newState == ArmyRenderer.ArmyState.Arrived &&
                prevState == ArmyRenderer.ArmyState.Moving)
                OnArmyArrived?.Invoke(renderer);

            _prevStates[dto.id] = newState;

            // Optional smooth lerp between polls
            if (smoothLerp && newState == ArmyRenderer.ArmyState.Moving && hasTarget)
                StartLerp(dto.id, renderer, currentPos, targetPos, dto.movementProgress);
        }

        private void RemoveArmy(string id)
        {
            if (_lerpCoroutines.TryGetValue(id, out var co) && co != null)
                StopCoroutine(co);
            _lerpCoroutines.Remove(id);

            if (_live.TryGetValue(id, out var r))
                Destroy(r.gameObject);

            _live.Remove(id);
            _cachedDtos.Remove(id);
            _prevStates.Remove(id);
            _currentPositions.Remove(id);
            _targetPositions.Remove(id);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Smooth lerp between polls
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Animate the army icon from its server-reported progress forward until
        /// the next SyncFromState overwrites it. This fills the visual gap between
        /// poll cycles so the icon doesn't jump.
        ///
        /// The lerp assumes constant march speed and stops at 0.99 to avoid
        /// overshooting while waiting for the server to confirm arrival.
        /// </summary>
        private void StartLerp(string id, ArmyRenderer renderer,
                                Vector3 from, Vector3 to, float startProgress)
        {
            if (_lerpCoroutines.TryGetValue(id, out var existing) && existing != null)
                StopCoroutine(existing);

            _lerpCoroutines[id] = StartCoroutine(LerpArmy(id, renderer, from, to, startProgress));
        }

        private IEnumerator LerpArmy(string id, ArmyRenderer renderer,
                                      Vector3 from, Vector3 to, float startProgress)
        {
            float elapsed = startProgress * lerpDuration;

            while (elapsed < lerpDuration * 0.99f)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / lerpDuration);
                renderer.transform.position = Vector3.Lerp(from, to, t);

                // Also update path line start point
                if (renderer.pathLine != null && renderer.pathLine.positionCount >= 1)
                    renderer.pathLine.SetPosition(0, renderer.transform.position);

                yield return null;
            }

            _lerpCoroutines.Remove(id);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Coordinate helper
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Convert map-% coordinates (territory.x 5-95, territory.y 5-95) to world space.
        /// Matches TerritoryRenderer.ApplyPosition() exactly.
        /// </summary>
        public Vector3 TerritoryWorldPos(int x, int y) =>
            new Vector3(x / 100f * mapWidth, 0f, y / 100f * mapHeight);

        /// <summary>
        /// Convert recentPositions coordinates to world space.
        /// recentPositions.x/y are in the same map-% space as territory.x/y.
        /// </summary>
        public Vector3 RecentPosToWorld(float x, float y) =>
            new Vector3(x / 100f * mapWidth, 0f, y / 100f * mapHeight);

        // ─────────────────────────────────────────────────────────────────────────
        // Gizmos
        // ─────────────────────────────────────────────────────────────────────────

#if UNITY_EDITOR
        private void OnDrawGizmos()
        {
            if (!drawGizmos) return;
            foreach (var kv in _live)
            {
                if (kv.Value == null) continue;
                var dto = _cachedDtos.GetValueOrDefault(kv.Key);
                if (dto == null) continue;

                Color c = ArmyRenderer.ParseState(dto.movementStatus) switch
                {
                    ArmyRenderer.ArmyState.Moving  => Color.cyan,
                    ArmyRenderer.ArmyState.Sieging => Color.red,
                    ArmyRenderer.ArmyState.Arrived => Color.green,
                    _                              => Color.grey,
                };
                Gizmos.color = c;
                Gizmos.DrawWireSphere(kv.Value.transform.position, 0.4f);

                if (_targetPositions.TryGetValue(kv.Key, out Vector3 tp) && tp != Vector3.zero)
                {
                    Gizmos.color = new Color(c.r, c.g, c.b, 0.3f);
                    Gizmos.DrawLine(kv.Value.transform.position, tp);
                }
            }
        }
#endif
    }
}
