using System.Collections.Generic;
using UnityEngine;

namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Phase 7.5 — ArmyRenderer
    ///
    /// Per-army visual component. Driven entirely by ArmyDto fields returned by
    /// GET /api/unity/map-state/:worldSlug → armies[].
    ///
    /// DB source: military_forces table (lib/db/src/schema/militaryForces.ts)
    ///
    /// Fields consumed
    /// ---------------
    ///   id                  — identity key
    ///   name                — label text
    ///   soldiers            — stats popup + scale
    ///   power               — stats popup
    ///   morale              — stats popup + morale bar colour
    ///   supply              — stats popup
    ///   movementStatus      — state machine: "idle"|"moving"|"arrived"|"sieging"
    ///   movementProgress    — 0.0–1.0, used to lerp world position
    ///   currentTerritoryId  — lookup world position from territory list
    ///   targetTerritoryId   — lookup world position; null when idle
    ///   recentPositions     — [{x,y,tick}] breadcrumb trail in map-% space
    ///
    /// Movement state machine (Phase 63A)
    /// -----------------------------------
    ///   idle     → army standing still at currentTerritoryId
    ///   moving   → army marching; position = Lerp(currentPos, targetPos, movementProgress)
    ///   arrived  → army just reached target; currentTerritoryId == targetTerritoryId
    ///   sieging  → army assaulting; at target position; siege ring pulsing
    ///
    /// Child objects (assign in Inspector or auto-created by ArmyMovementController)
    /// -------------------------------------------------------------------------------
    ///   ArmyIcon        SpriteRenderer   army sprite, coloured by state
    ///   SiegeRing       SpriteRenderer   pulsing ring, active only during sieging
    ///   PathLine        LineRenderer     current→target path, active during moving
    ///   TrailLine       LineRenderer     recentPositions breadcrumb trail
    ///   StatsCanvas     Canvas (World)   world-space stats popup
    ///   └─ SoldiersLabel  TextMeshProUGUI
    ///   └─ PowerLabel     TextMeshProUGUI
    ///   └─ MoraleBar      Image (fill)
    ///   └─ SupplyBar      Image (fill)
    ///   └─ NameLabel      TextMeshProUGUI
    ///   └─ StatusLabel    TextMeshProUGUI
    /// </summary>
    [DisallowMultipleComponent]
    public class ArmyRenderer : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — child renderers
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Icon")]
        public SpriteRenderer armyIcon;

        [Header("Siege")]
        [Tooltip("Animated ring shown only when movementStatus == 'sieging'.")]
        public SpriteRenderer siegeRing;

        [Header("Lines")]
        [Tooltip("LineRenderer for current→target path. 2 points. Active when 'moving'.")]
        public LineRenderer pathLine;

        [Tooltip("LineRenderer for recentPositions breadcrumb trail.")]
        public LineRenderer trailLine;

        [Header("Stats Popup")]
        public TMPro.TextMeshProUGUI nameLabel;
        public TMPro.TextMeshProUGUI soldiersLabel;
        public TMPro.TextMeshProUGUI powerLabel;
        public TMPro.TextMeshProUGUI statusLabel;
        [Tooltip("Fill Image for morale bar (0-100).")]
        public UnityEngine.UI.Image moraleBar;
        [Tooltip("Fill Image for supply bar (0-100).")]
        public UnityEngine.UI.Image supplyBar;
        [Tooltip("Root of the world-space stats canvas — toggled on hover/select.")]
        public GameObject statsCanvas;

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — sprites
        // ─────────────────────────────────────────────────────────────────────────

        [Header("State Sprites")]
        [Tooltip("Icon sprites indexed by ArmyState enum order.")]
        public Sprite idleSprite;
        public Sprite movingSprite;
        public Sprite arrivedSprite;
        public Sprite siegingSprite;

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — colours
        // ─────────────────────────────────────────────────────────────────────────

        [Header("State Colours")]
        public Color idleColor    = new Color(0.612f, 0.639f, 0.686f); // #9ca3af  grey
        public Color movingColor  = new Color(0.133f, 0.827f, 0.933f); // #22d3ee  cyan
        public Color arrivedColor = new Color(0.133f, 0.773f, 0.333f); // #22c55e  green
        public Color siegingColor = new Color(0.937f, 0.267f, 0.267f); // #ef4444  red

        [Header("Bar Colours")]
        public Color moraleHighColor = new Color(0.133f, 0.773f, 0.333f); // green  ≥60
        public Color moraleMidColor  = new Color(0.918f, 0.702f, 0.031f); // yellow 30-59
        public Color moraleLowColor  = new Color(0.937f, 0.267f, 0.267f); // red    <30
        public Color supplyHighColor = new Color(0.133f, 0.773f, 0.333f); // green  ≥50
        public Color supplyLowColor  = new Color(0.937f, 0.267f, 0.267f); // red    <50

        [Header("Path Line")]
        public Color   pathLineColor = new Color(1f, 1f, 1f, 0.55f);
        [Range(0.01f, 0.5f)]
        public float   pathLineWidth = 0.08f;

        [Header("Trail Line")]
        public Color   trailHeadColor = new Color(0.133f, 0.827f, 0.933f, 0.85f);
        public Color   trailTailColor = new Color(0.133f, 0.827f, 0.933f, 0f);
        [Range(0.01f, 0.5f)]
        public float   trailLineWidth = 0.06f;

        [Header("Siege Ring")]
        [Tooltip("Pulse frequency in oscillations per second.")]
        [Range(0.2f, 4f)]
        public float   siegePulseFreq  = 1.2f;
        [Range(0f, 1f)]
        public float   siegeAlphaMin   = 0.25f;
        [Range(0f, 1f)]
        public float   siegeAlphaMax   = 0.85f;

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — scale
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Size Scaling")]
        [Tooltip("Maps soldier count to icon scale. Key = soldiers, Value = scale.")]
        public AnimationCurve soldierScaleCurve = AnimationCurve.Linear(0, 0.5f, 3000, 1.4f);
        [Range(0.2f, 0.8f)] public float minArmyScale = 0.3f;
        [Range(1.0f, 3.0f)] public float maxArmyScale = 1.6f;

        // ─────────────────────────────────────────────────────────────────────────
        // Public state
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>Most recently applied DTO. Null until Apply() is called.</summary>
        public ArmyDto Data { get; private set; }

        /// <summary>Current world-space position of this army icon (interpolated).</summary>
        public Vector3 WorldPosition => transform.position;

        public enum ArmyState { Idle, Moving, Arrived, Sieging }
        public ArmyState CurrentState { get; private set; }

        // ─────────────────────────────────────────────────────────────────────────
        // Private
        // ─────────────────────────────────────────────────────────────────────────

        private MaterialPropertyBlock _iconMpb;
        private MaterialPropertyBlock _ringMpb;
        private static readonly int   ColorId = Shader.PropertyToID("_Color");
        private bool _statsVisible;

        // ─────────────────────────────────────────────────────────────────────────
        // Lifecycle
        // ─────────────────────────────────────────────────────────────────────────

        private void Awake()
        {
            _iconMpb = new MaterialPropertyBlock();
            _ringMpb = new MaterialPropertyBlock();

            if (statsCanvas != null) statsCanvas.SetActive(false);
            if (siegeRing   != null) siegeRing.gameObject.SetActive(false);
            if (pathLine    != null) pathLine.gameObject.SetActive(false);
            if (trailLine   != null) trailLine.gameObject.SetActive(false);

            // Configure LineRenderer defaults
            ConfigureLine(pathLine,  pathLineWidth, pathLineColor, pathLineColor);
            ConfigureLine(trailLine, trailLineWidth, trailHeadColor, trailTailColor);
        }

        private void Update()
        {
            if (CurrentState == ArmyState.Sieging)
                AnimateSiegeRing();
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Main entry point
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Apply a live ArmyDto snapshot.
        ///
        /// Parameters
        /// ----------
        /// dto         — the army data from map-state
        /// currentPos  — world position of currentTerritoryId tile (from TerritoryRendererPool)
        /// targetPos   — world position of targetTerritoryId tile; Vector3.zero when null
        /// hasTarget   — whether targetTerritoryId resolved to a valid territory
        /// </summary>
        public void Apply(ArmyDto dto, Vector3 currentPos, Vector3 targetPos, bool hasTarget)
        {
            Data = dto;
            CurrentState = ParseState(dto.movementStatus);

            ApplyWorldPosition(dto, currentPos, targetPos, hasTarget);
            ApplyIconSprite(CurrentState);
            ApplyIconColor(CurrentState);
            ApplyScale(dto.soldiers);
            ApplyPathLine(CurrentState, targetPos, hasTarget);
            ApplyTrail(dto.recentPositions);
            ApplySiegeRing(CurrentState);
            ApplyStats(dto);
        }

        /// <summary>Show or hide the stats popup (call from input handler on hover/click).</summary>
        public void SetStatsVisible(bool visible)
        {
            _statsVisible = visible;
            if (statsCanvas != null) statsCanvas.SetActive(visible);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Sub-renderer updates
        // ─────────────────────────────────────────────────────────────────────────

        private void ApplyWorldPosition(ArmyDto dto, Vector3 currentPos,
                                         Vector3 targetPos, bool hasTarget)
        {
            Vector3 pos;
            if (CurrentState == ArmyState.Moving && hasTarget)
            {
                // Lerp between territory world positions using server-provided progress.
                // progress 0.0 = standing at currentTerritoryId
                // progress 1.0 = standing at targetTerritoryId
                float t = Mathf.Clamp01(dto.movementProgress);
                pos = Vector3.Lerp(currentPos, targetPos, t);
            }
            else
            {
                pos = currentPos;
            }

            transform.position = pos;
        }

        private void ApplyIconSprite(ArmyState state)
        {
            if (armyIcon == null) return;
            armyIcon.sprite = state switch
            {
                ArmyState.Moving  => movingSprite  ?? idleSprite,
                ArmyState.Arrived => arrivedSprite ?? idleSprite,
                ArmyState.Sieging => siegingSprite ?? idleSprite,
                _                 => idleSprite,
            };
        }

        private void ApplyIconColor(ArmyState state)
        {
            if (armyIcon == null) return;
            armyIcon.GetPropertyBlock(_iconMpb);
            _iconMpb.SetColor(ColorId, StateColor(state));
            armyIcon.SetPropertyBlock(_iconMpb);
        }

        private void ApplyScale(int soldiers)
        {
            float raw = soldierScaleCurve.Evaluate(soldiers);
            float s   = Mathf.Clamp(raw, minArmyScale, maxArmyScale);
            transform.localScale = new Vector3(s, s, s);
        }

        private void ApplyPathLine(ArmyState state, Vector3 targetPos, bool hasTarget)
        {
            if (pathLine == null) return;

            bool showPath = state == ArmyState.Moving && hasTarget;
            pathLine.gameObject.SetActive(showPath);

            if (showPath)
            {
                pathLine.positionCount = 2;
                pathLine.SetPosition(0, transform.position);
                pathLine.SetPosition(1, targetPos);
            }
        }

        private void ApplyTrail(List<ArmyPositionDto> recentPositions)
        {
            if (trailLine == null) return;

            if (recentPositions == null || recentPositions.Count < 2)
            {
                trailLine.gameObject.SetActive(false);
                return;
            }

            trailLine.gameObject.SetActive(true);
            trailLine.positionCount = recentPositions.Count;

            // recentPositions are stored oldest-first in the DB JSONB array.
            // Render oldest (tail, transparent) → newest (head, opaque).
            for (int i = 0; i < recentPositions.Count; i++)
            {
                var p = recentPositions[i];
                // x,y in recentPositions are the same map-% coordinate space
                // as TerritoryDto.x / TerritoryDto.y — convert to world space.
                float wx = p.x / 100f * GetMapWidth();
                float wz = p.y / 100f * GetMapHeight();
                trailLine.SetPosition(i, new Vector3(wx, 0f, wz));
            }

            // Colour gradient: tail (index 0) transparent → head (last) opaque
            var gradient = new Gradient();
            gradient.SetKeys(
                new[] {
                    new GradientColorKey(trailTailColor, 0f),
                    new GradientColorKey(trailHeadColor, 1f),
                },
                new[] {
                    new GradientAlphaKey(0f,                   0f),
                    new GradientAlphaKey(trailHeadColor.a,     1f),
                }
            );
            trailLine.colorGradient = gradient;
        }

        private void ApplySiegeRing(ArmyState state)
        {
            if (siegeRing == null) return;
            bool active = state == ArmyState.Sieging;
            siegeRing.gameObject.SetActive(active);
        }

        private void ApplyStats(ArmyDto dto)
        {
            if (nameLabel     != null) nameLabel.text     = dto.name;
            if (soldiersLabel != null) soldiersLabel.text = $"{dto.soldiers:N0} soldiers";
            if (powerLabel    != null) powerLabel.text    = $"Power {dto.power:F0}";
            if (statusLabel   != null) statusLabel.text   = StatusText(CurrentState);

            if (moraleBar != null)
            {
                moraleBar.fillAmount = Mathf.Clamp01(dto.morale / 100f);
                moraleBar.color      = MoraleColor(dto.morale);
            }
            if (supplyBar != null)
            {
                supplyBar.fillAmount = Mathf.Clamp01(dto.supply / 100f);
                supplyBar.color      = dto.supply >= 50f ? supplyHighColor : supplyLowColor;
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Siege ring animation (runs in Update)
        // ─────────────────────────────────────────────────────────────────────────

        private void AnimateSiegeRing()
        {
            if (siegeRing == null) return;
            float a = Mathf.Lerp(siegeAlphaMin, siegeAlphaMax,
                (Mathf.Sin(Time.time * siegePulseFreq * Mathf.PI * 2f) + 1f) * 0.5f);
            siegeRing.GetPropertyBlock(_ringMpb);
            _ringMpb.SetColor(ColorId, new Color(siegingColor.r, siegingColor.g, siegingColor.b, a));
            siegeRing.SetPropertyBlock(_ringMpb);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Helpers
        // ─────────────────────────────────────────────────────────────────────────

        public static ArmyState ParseState(string movementStatus) => movementStatus switch
        {
            "moving"   => ArmyState.Moving,
            "arrived"  => ArmyState.Arrived,
            "sieging"  => ArmyState.Sieging,
            _          => ArmyState.Idle,    // "idle" + any unknown value
        };

        private Color StateColor(ArmyState state) => state switch
        {
            ArmyState.Moving  => movingColor,
            ArmyState.Arrived => arrivedColor,
            ArmyState.Sieging => siegingColor,
            _                 => idleColor,
        };

        private Color MoraleColor(float morale)
        {
            if (morale >= 60f) return moraleHighColor;
            if (morale >= 30f) return moraleMidColor;
            return moraleLowColor;
        }

        private static string StatusText(ArmyState state) => state switch
        {
            ArmyState.Moving  => "Marching",
            ArmyState.Arrived => "Arrived",
            ArmyState.Sieging => "⚔ Sieging",
            _                 => "Standby",
        };

        private static void ConfigureLine(LineRenderer lr, float width, Color start, Color end)
        {
            if (lr == null) return;
            lr.startWidth        = width;
            lr.endWidth          = width;
            lr.startColor        = start;
            lr.endColor          = end;
            lr.useWorldSpace     = true;
            lr.positionCount     = 0;
        }

        // Map dimensions are read from ArmyMovementController if available, otherwise defaults.
        private float _mapWidth  = -1f;
        private float _mapHeight = -1f;

        internal void SetMapDimensions(float w, float h) { _mapWidth = w; _mapHeight = h; }

        private float GetMapWidth()  => _mapWidth  > 0 ? _mapWidth  : 100f;
        private float GetMapHeight() => _mapHeight > 0 ? _mapHeight : 100f;
    }
}
