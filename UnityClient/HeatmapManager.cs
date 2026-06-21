using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Phase 7.4 — HeatmapManager
    ///
    /// Drives five overlay modes on top of TerritoryRendererPool tiles.
    /// Each mode computes a normalised score per territory from live MapStateDto data,
    /// then lerps a colour onto the tile's HeatmapLayer SpriteRenderer via
    /// MaterialPropertyBlock — no new material instances.
    ///
    /// Overlay modes
    /// -------------
    ///   None        (0)  — overlays removed, normal rendering
    ///   Population  (1)  — territory.population         key [1]
    ///   Security    (2)  — territory.security  0-100    key [2]
    ///   Food        (3)  — 100 - avg npc.hunger per territory  key [3]
    ///   Military    (4)  — Σ army.soldiers*power per currentTerritoryId  key [4]
    ///   Prosperity  (5)  — territory.prosperity 0-100   key [5]
    ///
    /// Data sources (all from GET /api/unity/map-state/:worldSlug)
    /// ------------------------------------------------------------
    ///   territory.population    integer (typically 0-5000+)
    ///   territory.security      integer 0-100
    ///   territory.prosperity    integer 0-100
    ///   npc.hunger              integer 0-100 per npc (food score = 100 - hunger)
    ///   army.soldiers           integer
    ///   army.power              float (computed server-side)
    ///   army.currentTerritoryId uuid
    ///
    /// Colour formulas (exact)
    /// -----------------------
    ///   All overlays use: Color.Lerp(lowColor, highColor, t)
    ///   where t = Mathf.InverseLerp(domainMin, domainMax, rawValue)
    ///   clamped to [0, 1].  domainMax for Population and Military is
    ///   computed dynamically as the observed maximum in the current snapshot.
    ///
    ///   Population:  #1e3a5f → #22d3ee   (dark navy → bright cyan)
    ///   Security:    #ef4444 → #22c55e   (red → green,  matches Phase 7.3 dots)
    ///   Food:        #ef4444 → #84cc16   (red → lime)
    ///   Military:    #1a1a2e → #ef4444   (near-black → red)
    ///   Prosperity:  #8b5cf6 → #eab308   (violet → gold, matches palette)
    ///
    /// Keyboard shortcuts
    /// ------------------
    ///   0  →  None (clear)
    ///   1  →  Population
    ///   2  →  Security
    ///   3  →  Food
    ///   4  →  Military
    ///   5  →  Prosperity
    ///   H  →  Toggle last active overlay on/off
    ///
    /// Setup
    /// -----
    ///   1. Attach to the same GameObject as TerritoryRendererPool (or any persistent GO).
    ///   2. Assign rendererPool and legendUI in the Inspector.
    ///   3. Each TerritoryRenderer prefab must have a child SpriteRenderer named
    ///      "HeatmapLayer" using Mat_Heatmap (see material strategy in docs).
    ///   4. Subscribe WorldLoader.OnStateRefreshed to RefreshData().
    /// </summary>
    public class HeatmapManager : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────────────────
        // Overlay enum
        // ─────────────────────────────────────────────────────────────────────────

        public enum OverlayMode
        {
            None       = 0,
            Population = 1,
            Security   = 2,
            Food       = 3,
            Military   = 4,
            Prosperity = 5,
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Inspector
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Dependencies")]
        [Tooltip("Pool that owns all active TerritoryRenderer instances.")]
        public TerritoryRendererPool rendererPool;

        [Tooltip("Optional legend UI controller. Receives label/colour data on mode change.")]
        public HeatmapLegendUI legendUI;

        [Header("Transition")]
        [Tooltip("Seconds to fully blend from one overlay to the next.")]
        [Range(0.05f, 2f)] public float transitionDuration = 0.35f;

        [Tooltip("Alpha of the heatmap overlay at full opacity (0 = invisible, 1 = opaque).")]
        [Range(0f, 1f)] public float overlayAlpha = 0.62f;

        [Header("Colour Formulas — Population")]
        public Color populationLow  = new Color(0.118f, 0.227f, 0.373f); // #1e3a5f
        public Color populationHigh = new Color(0.133f, 0.827f, 0.933f); // #22d3ee

        [Header("Colour Formulas — Security")]
        public Color securityLow    = new Color(0.937f, 0.267f, 0.267f); // #ef4444
        public Color securityHigh   = new Color(0.133f, 0.773f, 0.333f); // #22c55e

        [Header("Colour Formulas — Food")]
        public Color foodLow        = new Color(0.937f, 0.267f, 0.267f); // #ef4444
        public Color foodHigh       = new Color(0.518f, 0.800f, 0.086f); // #84cc16

        [Header("Colour Formulas — Military")]
        public Color militaryLow    = new Color(0.102f, 0.102f, 0.180f); // #1a1a2e
        public Color militaryHigh   = new Color(0.937f, 0.267f, 0.267f); // #ef4444

        [Header("Colour Formulas — Prosperity")]
        public Color prosperityLow  = new Color(0.545f, 0.361f, 0.965f); // #8b5cf6
        public Color prosperityHigh = new Color(0.918f, 0.702f, 0.031f); // #eab308

        [Header("Keyboard Shortcuts")]
        public KeyCode toggleKey = KeyCode.H;

        // ─────────────────────────────────────────────────────────────────────────
        // Public state
        // ─────────────────────────────────────────────────────────────────────────

        public OverlayMode ActiveMode  { get; private set; } = OverlayMode.None;
        public OverlayMode PreviousMode { get; private set; } = OverlayMode.None;

        /// <summary>Fired whenever the active overlay mode changes.</summary>
        public event Action<OverlayMode> OnModeChanged;

        // ─────────────────────────────────────────────────────────────────────────
        // Private
        // ─────────────────────────────────────────────────────────────────────────

        // Latest computed scores: territory id → normalised 0-1
        private readonly Dictionary<string, float> _scores = new();

        // Per-territory current displayed colour (for smooth lerp)
        private readonly Dictionary<string, Color> _currentColors = new();

        // Cached child SpriteRenderers per territory id
        private readonly Dictionary<string, SpriteRenderer> _heatmapLayers = new();

        // Transition coroutine
        private Coroutine _transitionCoroutine;

        // Last snapshot used to recompute after mode change without re-fetching
        private MapStateDto _lastState;

        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private MaterialPropertyBlock _mpb;

        // ─────────────────────────────────────────────────────────────────────────
        // Unity lifecycle
        // ─────────────────────────────────────────────────────────────────────────

        private void Awake()
        {
            _mpb = new MaterialPropertyBlock();
        }

        private void Update()
        {
            HandleKeyboard();
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Public API
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Feed a fresh MapStateDto snapshot. Recomputes scores for the active overlay
        /// if one is active; updates heatmap layers. Safe to call every poll cycle.
        /// Connect to WorldLoader.OnStateRefreshed.
        /// </summary>
        public void RefreshData(MapStateDto state)
        {
            _lastState = state;
            if (ActiveMode != OverlayMode.None)
                ComputeAndApply(state, ActiveMode);
        }

        /// <summary>
        /// Switch to the given overlay mode with a smooth colour transition.
        /// Passing the current mode has no effect. Passing None clears all overlays.
        /// </summary>
        public void SetMode(OverlayMode mode)
        {
            if (mode == ActiveMode) return;

            PreviousMode = ActiveMode;
            ActiveMode   = mode;
            OnModeChanged?.Invoke(mode);

            if (_transitionCoroutine != null)
                StopCoroutine(_transitionCoroutine);

            if (mode == OverlayMode.None)
            {
                _transitionCoroutine = StartCoroutine(TransitionToNone());
            }
            else
            {
                if (_lastState != null)
                    ComputeAndApply(_lastState, mode);
                _transitionCoroutine = StartCoroutine(TransitionIn());
            }

            legendUI?.Refresh(mode, GetLegendData(mode));
        }

        /// <summary>Toggle the last active overlay on/off (keyboard shortcut H).</summary>
        public void ToggleLastOverlay()
        {
            if (ActiveMode != OverlayMode.None)
                SetMode(OverlayMode.None);
            else
                SetMode(PreviousMode == OverlayMode.None ? OverlayMode.Prosperity : PreviousMode);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Score computation — one method per overlay type
        // ─────────────────────────────────────────────────────────────────────────

        private void ComputeAndApply(MapStateDto state, OverlayMode mode)
        {
            _scores.Clear();

            switch (mode)
            {
                case OverlayMode.Population:  ComputePopulation(state);  break;
                case OverlayMode.Security:    ComputeSecurity(state);    break;
                case OverlayMode.Food:        ComputeFood(state);        break;
                case OverlayMode.Military:    ComputeMilitary(state);    break;
                case OverlayMode.Prosperity:  ComputeProsperity(state);  break;
            }
        }

        // ── 1. Population ────────────────────────────────────────────────────────
        // Source: territory.population (integer, no upper bound, dynamic max)
        // Formula: t = population / observedMax  (observedMax ≥ 1)

        private void ComputePopulation(MapStateDto state)
        {
            int max = 1;
            foreach (var t in state.territories)
                if (t.population > max) max = t.population;

            foreach (var t in state.territories)
            {
                float score = Mathf.Clamp01((float)t.population / max);
                _scores[t.id] = score;
                SetTileColor(t.id, Color.Lerp(populationLow, populationHigh, score));
            }
        }

        // ── 2. Security ──────────────────────────────────────────────────────────
        // Source: territory.security  integer 0-100 (fixed domain)
        // Formula: t = security / 100

        private void ComputeSecurity(MapStateDto state)
        {
            foreach (var t in state.territories)
            {
                float score = Mathf.Clamp01(t.security / 100f);
                _scores[t.id] = score;
                SetTileColor(t.id, Color.Lerp(securityLow, securityHigh, score));
            }
        }

        // ── 3. Food ──────────────────────────────────────────────────────────────
        // Source: npc.hunger  integer 0-100 per NPC, grouped by npc.territoryId
        // Formula: avgHunger = Σ hunger / npcCount  (default 50 when no NPCs)
        //          foodScore = (100 - avgHunger) / 100
        //          High hunger → low food score → red.  Low hunger → abundant → lime.

        private void ComputeFood(MapStateDto state)
        {
            // Accumulate hunger sum + count per territory
            var hungerSum   = new Dictionary<string, float>();
            var hungerCount = new Dictionary<string, int>();

            if (state.npcs != null)
            {
                foreach (var npc in state.npcs)
                {
                    if (string.IsNullOrEmpty(npc.territoryId)) continue;
                    hungerSum[npc.territoryId]   = (hungerSum.GetValueOrDefault(npc.territoryId))   + npc.hunger;
                    hungerCount[npc.territoryId] = (hungerCount.GetValueOrDefault(npc.territoryId)) + 1;
                }
            }

            foreach (var t in state.territories)
            {
                float avgHunger = hungerCount.TryGetValue(t.id, out int cnt) && cnt > 0
                    ? hungerSum[t.id] / cnt
                    : 50f;                          // neutral fallback when no NPCs

                float score = Mathf.Clamp01((100f - avgHunger) / 100f);
                _scores[t.id] = score;
                SetTileColor(t.id, Color.Lerp(foodLow, foodHigh, score));
            }
        }

        // ── 4. Military ──────────────────────────────────────────────────────────
        // Source: army.soldiers (int) × army.power (float), grouped by army.currentTerritoryId
        // Formula: strength = Σ (soldiers × power) per territory
        //          t = strength / observedMax  (observedMax ≥ 1)
        //
        // Territories with no stationed army receive score 0 (near-black).

        private void ComputeMilitary(MapStateDto state)
        {
            var strength = new Dictionary<string, float>();
            if (state.armies != null)
            {
                foreach (var a in state.armies)
                {
                    if (string.IsNullOrEmpty(a.currentTerritoryId)) continue;
                    float s = a.soldiers * a.power;
                    strength[a.currentTerritoryId] = strength.GetValueOrDefault(a.currentTerritoryId) + s;
                }
            }

            float max = 1f;
            foreach (var v in strength.Values) if (v > max) max = v;

            foreach (var t in state.territories)
            {
                float score = strength.TryGetValue(t.id, out float str)
                    ? Mathf.Clamp01(str / max)
                    : 0f;

                _scores[t.id] = score;
                SetTileColor(t.id, Color.Lerp(militaryLow, militaryHigh, score));
            }
        }

        // ── 5. Prosperity ────────────────────────────────────────────────────────
        // Source: territory.prosperity  integer 0-100 (fixed domain)
        // Formula: t = prosperity / 100

        private void ComputeProsperity(MapStateDto state)
        {
            foreach (var t in state.territories)
            {
                float score = Mathf.Clamp01(t.prosperity / 100f);
                _scores[t.id] = score;
                SetTileColor(t.id, Color.Lerp(prosperityLow, prosperityHigh, score));
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Colour application
        // ─────────────────────────────────────────────────────────────────────────

        private void SetTileColor(string territoryId, Color target)
        {
            var sr = GetOrFindHeatmapLayer(territoryId);
            if (sr == null) return;

            // Store target; actual display colour is driven by the transition coroutine
            // or set immediately when no transition is running
            if (_transitionCoroutine == null)
                ApplyColorImmediate(sr, territoryId, target);
            else
                _currentColors[territoryId] = target; // coroutine will lerp toward this
        }

        private void ApplyColorImmediate(SpriteRenderer sr, string id, Color c)
        {
            c.a = overlayAlpha;
            _currentColors[id] = c;
            sr.GetPropertyBlock(_mpb);
            _mpb.SetColor(ColorId, c);
            sr.SetPropertyBlock(_mpb);
            sr.gameObject.SetActive(true);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Smooth transitions
        // ─────────────────────────────────────────────────────────────────────────

        private IEnumerator TransitionIn()
        {
            float elapsed = 0f;

            // Snapshot starting colours
            var startColors = new Dictionary<string, Color>(_currentColors);

            while (elapsed < transitionDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.SmoothStep(0f, 1f, elapsed / transitionDuration);

                foreach (var kv in _currentColors)
                {
                    var sr = GetOrFindHeatmapLayer(kv.Key);
                    if (sr == null) continue;

                    Color from = startColors.TryGetValue(kv.Key, out Color s) ? s : Color.clear;
                    Color to   = kv.Value;
                    to.a       = overlayAlpha;

                    Color blended = Color.Lerp(from, to, t);
                    sr.GetPropertyBlock(_mpb);
                    _mpb.SetColor(ColorId, blended);
                    sr.SetPropertyBlock(_mpb);
                    sr.gameObject.SetActive(true);
                }

                yield return null;
            }

            _transitionCoroutine = null;
        }

        private IEnumerator TransitionToNone()
        {
            float elapsed = 0f;
            var startColors = new Dictionary<string, Color>(_currentColors);

            while (elapsed < transitionDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.SmoothStep(0f, 1f, elapsed / transitionDuration);

                foreach (var kv in startColors)
                {
                    var sr = GetOrFindHeatmapLayer(kv.Key);
                    if (sr == null) continue;

                    Color fade = kv.Value;
                    fade.a = Mathf.Lerp(overlayAlpha, 0f, t);
                    sr.GetPropertyBlock(_mpb);
                    _mpb.SetColor(ColorId, fade);
                    sr.SetPropertyBlock(_mpb);
                }

                yield return null;
            }

            // Disable all heatmap layers
            foreach (var id in startColors.Keys)
            {
                var sr = GetOrFindHeatmapLayer(id);
                sr?.gameObject.SetActive(false);
            }

            _scores.Clear();
            _currentColors.Clear();
            _transitionCoroutine = null;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Keyboard input
        // ─────────────────────────────────────────────────────────────────────────

        private void HandleKeyboard()
        {
            if (Input.GetKeyDown(KeyCode.Alpha0) || Input.GetKeyDown(KeyCode.Keypad0))
                SetMode(OverlayMode.None);
            else if (Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.Keypad1))
                SetMode(OverlayMode.Population);
            else if (Input.GetKeyDown(KeyCode.Alpha2) || Input.GetKeyDown(KeyCode.Keypad2))
                SetMode(OverlayMode.Security);
            else if (Input.GetKeyDown(KeyCode.Alpha3) || Input.GetKeyDown(KeyCode.Keypad3))
                SetMode(OverlayMode.Food);
            else if (Input.GetKeyDown(KeyCode.Alpha4) || Input.GetKeyDown(KeyCode.Keypad4))
                SetMode(OverlayMode.Military);
            else if (Input.GetKeyDown(KeyCode.Alpha5) || Input.GetKeyDown(KeyCode.Keypad5))
                SetMode(OverlayMode.Prosperity);
            else if (Input.GetKeyDown(toggleKey))
                ToggleLastOverlay();
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Legend data
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>Returns gradient stops for legend UI generation.</summary>
        public LegendData GetLegendData(OverlayMode mode)
        {
            return mode switch
            {
                OverlayMode.Population  => new LegendData("Population",
                    "people", false,
                    new[] { (populationLow,  "0"),
                             (Color.Lerp(populationLow, populationHigh, 0.5f), "avg"),
                             (populationHigh, "max") }),

                OverlayMode.Security    => new LegendData("Security",
                    "%", true,
                    new[] { (securityLow,  "0"),
                             (Color.Lerp(securityLow, securityHigh, 0.5f), "50"),
                             (securityHigh, "100") }),

                OverlayMode.Food        => new LegendData("Food availability",
                    "%", true,
                    new[] { (foodLow,  "scarce"),
                             (Color.Lerp(foodLow, foodHigh, 0.5f), "moderate"),
                             (foodHigh, "abundant") }),

                OverlayMode.Military    => new LegendData("Military strength",
                    "force", false,
                    new[] { (militaryLow,  "0"),
                             (Color.Lerp(militaryLow, militaryHigh, 0.5f), "avg"),
                             (militaryHigh, "max") }),

                OverlayMode.Prosperity  => new LegendData("Prosperity",
                    "%", true,
                    new[] { (prosperityLow,  "0"),
                             (Color.Lerp(prosperityLow, prosperityHigh, 0.5f), "50"),
                             (prosperityHigh, "100") }),

                _ => new LegendData("None", "", false,
                    Array.Empty<(Color, string)>()),
            };
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Heatmap layer cache
        // ─────────────────────────────────────────────────────────────────────────

        private SpriteRenderer GetOrFindHeatmapLayer(string territoryId)
        {
            if (_heatmapLayers.TryGetValue(territoryId, out var cached) && cached != null)
                return cached;

            var renderer = rendererPool?.Get(territoryId);
            if (renderer == null) return null;

            // Find the "HeatmapLayer" child SpriteRenderer by name
            var transform = renderer.transform.Find("HeatmapLayer");
            if (transform == null)
            {
                Debug.LogWarning($"[HeatmapManager] No 'HeatmapLayer' child on territory {territoryId}. " +
                                 "Add a SpriteRenderer child named 'HeatmapLayer' to the prefab.");
                return null;
            }

            var sr = transform.GetComponent<SpriteRenderer>();
            _heatmapLayers[territoryId] = sr;
            return sr;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // LegendData — passed to HeatmapLegendUI
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Gradient stop data for the legend UI.
    /// Passed to HeatmapLegendUI.Refresh() on every mode change.
    /// </summary>
    public readonly struct LegendData
    {
        public readonly string                    Title;
        public readonly string                    Unit;
        public readonly bool                      FixedDomain;  // true = 0-100, false = dynamic max
        public readonly (Color color, string label)[] Stops;

        public LegendData(string title, string unit, bool fixedDomain,
                          (Color, string)[] stops)
        {
            Title       = title;
            Unit        = unit;
            FixedDomain = fixedDomain;
            Stops       = stops;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // HeatmapLegendUI — attach to your UI canvas legend panel
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Renders the legend panel for the active heatmap overlay.
    /// Wire HeatmapManager.legendUI to this component in the Inspector.
    ///
    /// Prefab structure expected:
    ///   LegendPanel (CanvasGroup)
    ///   ├── TitleLabel     (TextMeshProUGUI)
    ///   ├── GradientBar    (RawImage — Texture2D generated at runtime)
    ///   └── StopsContainer (HorizontalLayoutGroup)
    ///       ├── StopLabel_0   (TextMeshProUGUI)
    ///       ├── StopLabel_1   (TextMeshProUGUI)
    ///       └── StopLabel_2   (TextMeshProUGUI)
    /// </summary>
    public class HeatmapLegendUI : MonoBehaviour
    {
        [Header("Legend Panel")]
        public CanvasGroup           legendPanel;
        public TMPro.TextMeshProUGUI titleLabel;
        public UnityEngine.UI.RawImage gradientBar;
        public TMPro.TextMeshProUGUI[] stopLabels;   // length 3

        [Header("Show/Hide")]
        [Tooltip("Seconds to fade the legend panel in/out.")]
        public float fadeDuration = 0.2f;

        private Coroutine _fadeCoroutine;
        private Texture2D _gradientTexture;
        private const int GradientWidth = 256;

        private void Awake()
        {
            _gradientTexture = new Texture2D(GradientWidth, 1, TextureFormat.RGBA32, false)
            {
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear,
            };
            if (gradientBar != null)
                gradientBar.texture = _gradientTexture;
        }

        /// <summary>
        /// Rebuild the legend for the new overlay mode.
        /// Called by HeatmapManager.SetMode() automatically.
        /// </summary>
        public void Refresh(HeatmapManager.OverlayMode mode, LegendData data)
        {
            bool show = mode != HeatmapManager.OverlayMode.None;

            if (titleLabel != null)
                titleLabel.text = data.Title;

            // Rebuild gradient texture
            if (data.Stops != null && data.Stops.Length >= 2)
            {
                Color low  = data.Stops[0].color;
                Color high = data.Stops[^1].color;
                for (int i = 0; i < GradientWidth; i++)
                    _gradientTexture.SetPixel(i, 0, Color.Lerp(low, high, i / (float)(GradientWidth - 1)));
                _gradientTexture.Apply();
            }

            // Rebuild stop labels
            if (stopLabels != null && data.Stops != null)
            {
                for (int i = 0; i < stopLabels.Length; i++)
                {
                    if (i < data.Stops.Length)
                    {
                        stopLabels[i].text  = data.Stops[i].label;
                        stopLabels[i].color = data.Stops[i].color;
                    }
                    else
                    {
                        stopLabels[i].text = string.Empty;
                    }
                }
            }

            // Fade panel in or out
            if (_fadeCoroutine != null) StopCoroutine(_fadeCoroutine);
            _fadeCoroutine = StartCoroutine(FadePanel(show ? 1f : 0f));
        }

        private IEnumerator FadePanel(float targetAlpha)
        {
            if (legendPanel == null) yield break;
            float start   = legendPanel.alpha;
            float elapsed = 0f;
            legendPanel.gameObject.SetActive(true);

            while (elapsed < fadeDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                legendPanel.alpha = Mathf.Lerp(start, targetAlpha, elapsed / fadeDuration);
                yield return null;
            }

            legendPanel.alpha = targetAlpha;
            if (targetAlpha <= 0f)
                legendPanel.gameObject.SetActive(false);
        }
    }
}
