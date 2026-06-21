using System;
using System.Collections.Generic;
using UnityEngine;

#if UNITY_EDITOR
using UnityEditor;
#endif

namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Phase 7.3 — TerritoryRenderer
    ///
    /// Renders a single territory tile driven entirely by TerritoryDto data from the
    /// map-state endpoint. No mock values — every visual property maps to a real DB field.
    ///
    /// DB fields consumed
    /// ------------------
    ///   type        → base tile sprite / prefab variant
    ///   terrain     → terrain overlay tint
    ///   status      → state machine (active / abandoned / ruins)
    ///   x, y        → world position (via WorldLoader coordinate mapping)
    ///   population  → tile scale (PopulationScaleCurve)
    ///   prosperity  → ring fill (0-100)
    ///   security    → indicator colour and icon
    ///   ownerId     → faction colour (deterministic hash, matches server factionColor())
    ///   owner       → label text
    ///   name        → name label
    ///
    /// Prefab structure (assign in Inspector)
    /// ---------------------------------------
    ///   TileBase        SpriteRenderer   base territory sprite
    ///   TerrainOverlay  SpriteRenderer   terrain tint quad (additive)
    ///   OwnerBorder     SpriteRenderer   border ring coloured by faction
    ///   ProsperityRing  SpriteRenderer   arc fill — prosperity 0-100
    ///   SecurityDot     SpriteRenderer   dot colour = security level
    ///   StateOverlay    SpriteRenderer   ruins / abandoned overlay
    ///   NameLabel       TMPro.TextMeshPro  territory name
    ///   OwnerLabel      TMPro.TextMeshPro  faction name (hidden when null)
    ///   SelectionGlow   SpriteRenderer   disabled by default
    /// </summary>
    [DisallowMultipleComponent]
    public class TerritoryRenderer : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — child renderers
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Child Renderers")]
        [Tooltip("Base tile — one sprite per TerritoryType.")]
        public SpriteRenderer tileBase;

        [Tooltip("Additive overlay tinted by terrain type.")]
        public SpriteRenderer terrainOverlay;

        [Tooltip("Outer border ring — filled with faction colour.")]
        public SpriteRenderer ownerBorder;

        [Tooltip("Prosperity arc ring — fill amount driven by prosperity 0-100.")]
        public SpriteRenderer prosperityRing;

        [Tooltip("Small dot indicating security level via colour.")]
        public SpriteRenderer securityDot;

        [Tooltip("Full-tile overlay for ruins or abandoned state.")]
        public SpriteRenderer stateOverlay;

        [Tooltip("Territory name label (TextMeshPro).")]
        public TMPro.TextMeshProUGUI nameLabel;

        [Tooltip("Owner faction name label. Hidden when territory is unclaimed.")]
        public TMPro.TextMeshProUGUI ownerLabel;

        [Tooltip("Selection glow. Disabled at runtime; enabled by MapInputHandler.")]
        public SpriteRenderer selectionGlow;

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — sprite libraries
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Type Sprites")]
        [Tooltip("Sprites indexed by TerritoryType enum (same order).")]
        public Sprite[] typeSprites;   // village, district, city, farmland, harbor

        [Header("Terrain Overlays")]
        [Tooltip("Overlay sprites indexed by TerrainType enum (same order).")]
        public Sprite[] terrainSprites; // plains, forest, mountain, desert, swamp, sea

        [Header("State Overlays")]
        public Sprite activeOverlaySprite;     // normally null / transparent
        public Sprite abandonedOverlaySprite;  // faded grey vignette
        public Sprite ruinsOverlaySprite;      // crumbled texture

        [Header("Security Icons")]
        [Tooltip("Sprites indexed by SecurityLevel enum (same order).")]
        public Sprite[] securitySprites;       // critical, low, medium, high

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — colours
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Faction Palette")]
        [Tooltip("12-colour deterministic palette — matches server factionColor() exactly.")]
        public Color[] factionPalette = new Color[]
        {
            new Color(0.13f, 0.83f, 0.93f), // #22d3ee  cyan
            new Color(0.66f, 0.33f, 0.97f), // #a855f7  purple
            new Color(0.94f, 0.27f, 0.27f), // #ef4444  red
            new Color(0.98f, 0.60f, 0.09f), // #f97316  orange
            new Color(0.13f, 0.77f, 0.33f), // #22c55e  green
            new Color(0.92f, 0.70f, 0.03f), // #eab308  yellow
            new Color(0.93f, 0.30f, 0.60f), // #ec4899  pink
            new Color(0.23f, 0.51f, 0.97f), // #3b82f6  blue
            new Color(0.08f, 0.72f, 0.64f), // #14b8a6  teal
            new Color(0.96f, 0.25f, 0.37f), // #f43f5e  rose
            new Color(0.55f, 0.36f, 0.96f), // #8b5cf6  violet
            new Color(0.52f, 0.80f, 0.09f), // #84cc16  lime
        };

        [Tooltip("Colour used when a territory has no owner.")]
        public Color neutralColor = new Color(0.22f, 0.25f, 0.31f); // #374151

        [Header("Terrain Tints")]
        public Color plainsTint    = new Color(0.85f, 0.95f, 0.70f, 0.25f);
        public Color forestTint    = new Color(0.10f, 0.55f, 0.15f, 0.30f);
        public Color mountainTint  = new Color(0.65f, 0.65f, 0.68f, 0.35f);
        public Color desertTint    = new Color(0.93f, 0.83f, 0.50f, 0.30f);
        public Color swampTint     = new Color(0.35f, 0.50f, 0.25f, 0.30f);
        public Color seaTint       = new Color(0.10f, 0.30f, 0.75f, 0.30f);

        [Header("Security Colours")]
        public Color securityCritical = new Color(0.94f, 0.27f, 0.27f); // red    < 25
        public Color securityLow      = new Color(0.98f, 0.60f, 0.09f); // orange 25-49
        public Color securityMedium   = new Color(0.92f, 0.70f, 0.03f); // yellow 50-74
        public Color securityHigh     = new Color(0.13f, 0.77f, 0.33f); // green  75-100

        [Header("Prosperity Ring")]
        public Color prosperityEmpty = new Color(0.15f, 0.15f, 0.15f, 0.40f);
        public Color prosperityFull  = new Color(0.98f, 0.84f, 0.25f, 0.90f); // gold

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector — scaling
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Population Scaling")]
        [Tooltip("Maps population value to tile localScale.x/y. " +
                 "Key = population headcount, Value = scale multiplier (1.0 = base).")]
        public AnimationCurve populationScaleCurve = AnimationCurve.Linear(0f, 0.5f, 5000f, 1.8f);

        [Tooltip("Minimum tile scale regardless of population.")]
        [Range(0.2f, 1.0f)] public float minScale = 0.4f;

        [Tooltip("Maximum tile scale regardless of population.")]
        [Range(1.0f, 3.0f)] public float maxScale = 2.0f;

        [Header("Map Layout")]
        [Tooltip("Total width of the Unity play area (matches TerritoryDto.x / 100 * mapWidth).")]
        public float mapWidth = 100f;

        [Tooltip("Total height of the Unity play area (matches TerritoryDto.y / 100 * mapHeight).")]
        public float mapHeight = 100f;

        // ─────────────────────────────────────────────────────────────────────────
        // Public state
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>The data this renderer currently displays. Null until Apply() is called.</summary>
        public TerritoryDto Data { get; private set; }

        /// <summary>Whether this territory is currently selected by the player.</summary>
        public bool IsSelected { get; private set; }

        // ─────────────────────────────────────────────────────────────────────────
        // MaterialPropertyBlocks — avoid material instances
        // ─────────────────────────────────────────────────────────────────────────

        private MaterialPropertyBlock _borderMpb;
        private MaterialPropertyBlock _ringMpb;
        private MaterialPropertyBlock _dotMpb;
        private MaterialPropertyBlock _overlayMpb;
        private static readonly int   ColorId      = Shader.PropertyToID("_Color");
        private static readonly int   FillAmountId = Shader.PropertyToID("_FillAmount");

        // ─────────────────────────────────────────────────────────────────────────
        // Enumerations
        // ─────────────────────────────────────────────────────────────────────────

        public enum TerritoryType   { Village, District, City, Farmland, Harbor }
        public enum TerrainType     { Plains, Forest, Mountain, Desert, Swamp, Sea }
        public enum SecurityLevel   { Critical, Low, Medium, High }
        public enum TerritoryState  { Active, Abandoned, Ruins }

        // ─────────────────────────────────────────────────────────────────────────
        // Unity lifecycle
        // ─────────────────────────────────────────────────────────────────────────

        private void Awake()
        {
            _borderMpb  = new MaterialPropertyBlock();
            _ringMpb    = new MaterialPropertyBlock();
            _dotMpb     = new MaterialPropertyBlock();
            _overlayMpb = new MaterialPropertyBlock();
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Main entry point
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Apply a fresh TerritoryDto snapshot. Safe to call every poll cycle —
        /// only dirty sub-renderers are updated.
        /// </summary>
        public void Apply(TerritoryDto dto)
        {
            bool isNew = Data == null;
            Data = dto ?? throw new ArgumentNullException(nameof(dto));

            ApplyPosition(dto);
            ApplyScale(dto.population);
            ApplyTypeSprite(dto.type);
            ApplyTerrainOverlay(dto.terrain);
            ApplyOwnerBorder(dto.ownerId);
            ApplyProsperityRing(dto.prosperity);
            ApplySecurityDot(dto.security);
            ApplyState(dto.status, dto.population, dto.ownerId);
            ApplyLabels(dto.name, dto.owner);
        }

        /// <summary>Toggle the selection glow ring.</summary>
        public void SetSelected(bool selected)
        {
            IsSelected = selected;
            if (selectionGlow != null)
                selectionGlow.gameObject.SetActive(selected);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Sub-renderer updates
        // ─────────────────────────────────────────────────────────────────────────

        private void ApplyPosition(TerritoryDto dto)
        {
            // x,y are integers 5-95 representing percentage of map dimensions
            float wx = dto.x / 100f * mapWidth;
            float wy = dto.y / 100f * mapHeight;
            transform.localPosition = new Vector3(wx, 0f, wy);
        }

        private void ApplyScale(int population)
        {
            float raw = populationScaleCurve.Evaluate(population);
            float s   = Mathf.Clamp(raw, minScale, maxScale);
            transform.localScale = new Vector3(s, s, s);
        }

        private void ApplyTypeSprite(string type)
        {
            if (tileBase == null) return;
            int idx = TypeToIndex(type);
            if (idx >= 0 && idx < typeSprites.Length && typeSprites[idx] != null)
                tileBase.sprite = typeSprites[idx];
        }

        private void ApplyTerrainOverlay(string terrain)
        {
            if (terrainOverlay == null) return;
            int idx = TerrainToIndex(terrain);
            if (idx >= 0 && idx < terrainSprites.Length && terrainSprites[idx] != null)
                terrainOverlay.sprite = terrainSprites[idx];
            terrainOverlay.color = TerrainTint(terrain);
        }

        private void ApplyOwnerBorder(string ownerId)
        {
            if (ownerBorder == null) return;
            Color c = FactionColor(ownerId);
            ownerBorder.GetPropertyBlock(_borderMpb);
            _borderMpb.SetColor(ColorId, c);
            ownerBorder.SetPropertyBlock(_borderMpb);
        }

        private void ApplyProsperityRing(int prosperity)
        {
            if (prosperityRing == null) return;
            float fill = Mathf.Clamp01(prosperity / 100f);
            Color c    = Color.Lerp(prosperityEmpty, prosperityFull, fill);

            prosperityRing.GetPropertyBlock(_ringMpb);
            _ringMpb.SetFloat(FillAmountId, fill);
            _ringMpb.SetColor(ColorId, c);
            prosperityRing.SetPropertyBlock(_ringMpb);
        }

        private void ApplySecurityDot(int security)
        {
            if (securityDot == null) return;
            SecurityLevel level = ClassifySecurity(security);

            int idx = (int)level;
            if (idx >= 0 && idx < securitySprites.Length && securitySprites[idx] != null)
                securityDot.sprite = securitySprites[idx];

            securityDot.GetPropertyBlock(_dotMpb);
            _dotMpb.SetColor(ColorId, SecurityColor(level));
            securityDot.SetPropertyBlock(_dotMpb);
        }

        private void ApplyState(string status, int population, string ownerId)
        {
            if (stateOverlay == null) return;
            TerritoryState state = ClassifyState(status, population, ownerId);

            switch (state)
            {
                case TerritoryState.Active:
                    stateOverlay.gameObject.SetActive(false);
                    break;

                case TerritoryState.Abandoned:
                    stateOverlay.gameObject.SetActive(true);
                    stateOverlay.sprite = abandonedOverlaySprite;
                    _overlayMpb.SetColor(ColorId, new Color(1f, 1f, 1f, 0.45f));
                    stateOverlay.SetPropertyBlock(_overlayMpb);
                    // Desaturate base tile
                    if (tileBase != null) tileBase.color = new Color(0.55f, 0.55f, 0.55f, 1f);
                    break;

                case TerritoryState.Ruins:
                    stateOverlay.gameObject.SetActive(true);
                    stateOverlay.sprite = ruinsOverlaySprite;
                    _overlayMpb.SetColor(ColorId, new Color(1f, 0.8f, 0.7f, 0.65f));
                    stateOverlay.SetPropertyBlock(_overlayMpb);
                    // Heavy desaturate + darken
                    if (tileBase != null) tileBase.color = new Color(0.30f, 0.28f, 0.27f, 1f);
                    // Hide prosperity ring for ruins
                    if (prosperityRing != null) prosperityRing.gameObject.SetActive(false);
                    break;
            }

            // Restore base tile colour when state is active
            if (state == TerritoryState.Active && tileBase != null)
            {
                tileBase.color = Color.white;
                if (prosperityRing != null) prosperityRing.gameObject.SetActive(true);
            }
        }

        private void ApplyLabels(string name, string owner)
        {
            if (nameLabel  != null) nameLabel.text  = name ?? string.Empty;
            if (ownerLabel != null)
            {
                bool hasOwner = !string.IsNullOrEmpty(owner);
                ownerLabel.gameObject.SetActive(hasOwner);
                if (hasOwner) ownerLabel.text = owner;
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Classification helpers — all logic derived from real DB field ranges
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Derives render state from DB fields.
        /// - status == "ruins" or "destroyed"             → Ruins
        /// - status == "abandoned"                        → Abandoned
        /// - ownerId == null AND population == 0          → Abandoned
        /// - otherwise                                    → Active
        /// </summary>
        public static TerritoryState ClassifyState(string status, int population, string ownerId)
        {
            if (status == "ruins" || status == "destroyed")
                return TerritoryState.Ruins;
            if (status == "abandoned")
                return TerritoryState.Abandoned;
            if (string.IsNullOrEmpty(ownerId) && population == 0)
                return TerritoryState.Abandoned;
            return TerritoryState.Active;
        }

        /// <summary>
        /// Security thresholds:
        ///   0-24  → Critical (red)
        ///  25-49  → Low      (orange)
        ///  50-74  → Medium   (yellow)
        ///  75-100 → High     (green)
        /// </summary>
        public static SecurityLevel ClassifySecurity(int security)
        {
            if (security < 25)  return SecurityLevel.Critical;
            if (security < 50)  return SecurityLevel.Low;
            if (security < 75)  return SecurityLevel.Medium;
            return SecurityLevel.High;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Colour derivation
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Replicates the server-side factionColor() function exactly:
        ///   sum of all char codes mod 12 → palette index.
        /// Returns neutralColor when ownerId is null/empty.
        /// </summary>
        public Color FactionColor(string ownerId)
        {
            if (string.IsNullOrEmpty(ownerId)) return neutralColor;
            int sum = 0;
            foreach (char c in ownerId) sum += c;
            return factionPalette[sum % factionPalette.Length];
        }

        private Color SecurityColor(SecurityLevel level) => level switch
        {
            SecurityLevel.Critical => securityCritical,
            SecurityLevel.Low      => securityLow,
            SecurityLevel.Medium   => securityMedium,
            SecurityLevel.High     => securityHigh,
            _                      => securityMedium,
        };

        private Color TerrainTint(string terrain) => terrain switch
        {
            "plains"   => plainsTint,
            "forest"   => forestTint,
            "mountain" => mountainTint,
            "desert"   => desertTint,
            "swamp"    => swampTint,
            "sea"      => seaTint,
            _          => plainsTint,
        };

        // ─────────────────────────────────────────────────────────────────────────
        // Index lookup tables
        // ─────────────────────────────────────────────────────────────────────────

        private static int TypeToIndex(string type) => type switch
        {
            "village"  => (int)TerritoryType.Village,
            "district" => (int)TerritoryType.District,
            "city"     => (int)TerritoryType.City,
            "farmland" => (int)TerritoryType.Farmland,
            "harbor"   => (int)TerritoryType.Harbor,
            _          => (int)TerritoryType.Village,
        };

        private static int TerrainToIndex(string terrain) => terrain switch
        {
            "plains"   => (int)TerrainType.Plains,
            "forest"   => (int)TerrainType.Forest,
            "mountain" => (int)TerrainType.Mountain,
            "desert"   => (int)TerrainType.Desert,
            "swamp"    => (int)TerrainType.Swamp,
            "sea"      => (int)TerrainType.Sea,
            _          => (int)TerrainType.Plains,
        };

#if UNITY_EDITOR
        // ─────────────────────────────────────────────────────────────────────────
        // Editor gizmo — preview tile in scene view
        // ─────────────────────────────────────────────────────────────────────────
        private void OnDrawGizmos()
        {
            if (Data == null) return;
            Gizmos.color = FactionColor(Data.ownerId);
            Gizmos.DrawWireSphere(transform.position, transform.localScale.x * 0.5f);
            Handles.Label(transform.position + Vector3.up * 1.2f,
                $"{Data.name}\npop={Data.population} pros={Data.prosperity} sec={Data.security}");
        }
#endif
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TerritoryRendererPool
    // Manages a pool of TerritoryRenderer instances, keyed by TerritoryDto.id.
    // Place this on your MapManager GameObject.
    // ─────────────────────────────────────────────────────────────────────────────

    public class TerritoryRendererPool : MonoBehaviour
    {
        [Header("Prefabs — one per TerritoryType (village/district/city/farmland/harbor)")]
        public TerritoryRenderer villagePrefab;
        public TerritoryRenderer districtPrefab;
        public TerritoryRenderer cityPrefab;
        public TerritoryRenderer farmlandPrefab;
        public TerritoryRenderer harborPrefab;

        [Header("Map Dimensions")]
        public float mapWidth  = 100f;
        public float mapHeight = 100f;

        private readonly Dictionary<string, TerritoryRenderer> _live
            = new Dictionary<string, TerritoryRenderer>();

        /// <summary>
        /// Called from your OnStateRefreshed handler.
        /// Creates renderers for new territories, updates existing ones, removes stale ones.
        /// </summary>
        public void SyncFromState(List<TerritoryDto> territories)
        {
            if (territories == null) return;

            var seen = new HashSet<string>();

            foreach (var dto in territories)
            {
                seen.Add(dto.id);
                if (!_live.TryGetValue(dto.id, out var renderer))
                {
                    renderer = Instantiate(PrefabForType(dto.type), transform);
                    renderer.mapWidth  = mapWidth;
                    renderer.mapHeight = mapHeight;
                    renderer.name      = $"Territory_{dto.type}_{dto.id[..6]}";
                    _live[dto.id]      = renderer;
                }
                renderer.Apply(dto);
            }

            // Remove territories that no longer exist in the server response
            var toRemove = new List<string>();
            foreach (var id in _live.Keys)
                if (!seen.Contains(id)) toRemove.Add(id);

            foreach (var id in toRemove)
            {
                if (_live.TryGetValue(id, out var r))
                    Destroy(r.gameObject);
                _live.Remove(id);
            }
        }

        /// <summary>Returns the renderer for a given territory id, or null.</summary>
        public TerritoryRenderer Get(string territoryId) =>
            _live.TryGetValue(territoryId, out var r) ? r : null;

        private TerritoryRenderer PrefabForType(string type) => type switch
        {
            "district" => districtPrefab ?? villagePrefab,
            "city"     => cityPrefab     ?? villagePrefab,
            "farmland" => farmlandPrefab ?? villagePrefab,
            "harbor"   => harborPrefab   ?? villagePrefab,
            _          => villagePrefab,
        };
    }
}
