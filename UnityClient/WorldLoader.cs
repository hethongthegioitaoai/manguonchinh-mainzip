using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Phase 7.2 — WorldLoader
    ///
    /// Polls GET /api/unity/map-state/:worldSlug, deserializes the response into
    /// MapStateDto, caches it, and fires OnStateRefreshed on every successful load.
    ///
    /// Usage
    /// -----
    ///   1. Attach this component to a persistent GameObject (e.g. "WorldManager").
    ///   2. Set worldSlug and apiBaseUrl in the Inspector.
    ///   3. Subscribe to OnStateRefreshed to receive every MapStateDto update.
    ///   4. Call RequestRefresh() at any time to trigger an immediate poll.
    ///
    /// Endpoint audited: GET /api/unity/map-state/:worldSlug
    ///   → Returns: { worldSlug, ts, territories[], factions[], armies[], npcs[], recentHistory[] }
    ///   → Auth:    none (public endpoint, no isAuthenticated guard on this route)
    ///   → Errors:  500 { error: "Failed to fetch map state" }
    /// </summary>
    public class WorldLoader : MonoBehaviour
    {
        // ── Inspector ────────────────────────────────────────────────────────────

        [Header("World")]
        [Tooltip("The slug of the world to load, e.g. 'tu-tien'.")]
        public string worldSlug = "tu-tien";

        [Header("API")]
        [Tooltip("Base URL of the API server WITHOUT trailing slash. " +
                 "E.g. 'https://<your-replit-domain>' in production, " +
                 "'http://localhost:8080' in editor.")]
        public string apiBaseUrl = "http://localhost:8080";

        [Header("Polling")]
        [Tooltip("Seconds between automatic refreshes. Set 0 to disable auto-polling.")]
        public float pollIntervalSeconds = 10f;

        [Tooltip("Seconds to wait before the first automatic poll after Start().")]
        public float initialDelaySeconds = 0f;

        // ── Events ───────────────────────────────────────────────────────────────

        /// <summary>
        /// Fired on the main thread after every successful parse of MapStateDto.
        /// Subscribers should update their visual state here.
        /// </summary>
        public event Action<MapStateDto> OnStateRefreshed;

        /// <summary>
        /// Fired when the network request or JSON parse fails.
        /// Carries a human-readable error message.
        /// </summary>
        public event Action<string> OnLoadError;

        // ── Public read-only state ────────────────────────────────────────────────

        /// <summary>The most recently successfully loaded map state. Null until the first load.</summary>
        public MapStateDto CachedState { get; private set; }

        /// <summary>Unix milliseconds of the last successful server response (CachedState.ts).</summary>
        public long LastRefreshedTs { get; private set; }

        /// <summary>True while a network request is in flight.</summary>
        public bool IsLoading { get; private set; }

        // ── Private ───────────────────────────────────────────────────────────────

        private bool _manualRefreshRequested;
        private Coroutine _pollCoroutine;

        // ── Unity lifecycle ───────────────────────────────────────────────────────

        private void Start()
        {
            if (string.IsNullOrWhiteSpace(worldSlug))
            {
                Debug.LogError("[WorldLoader] worldSlug is not set.");
                return;
            }

            _pollCoroutine = StartCoroutine(PollLoop());
        }

        private void OnDestroy()
        {
            if (_pollCoroutine != null)
                StopCoroutine(_pollCoroutine);
        }

        // ── Public API ────────────────────────────────────────────────────────────

        /// <summary>
        /// Immediately triggers one map-state fetch outside the normal poll cycle.
        /// Safe to call at any time; ignored while another request is already in flight.
        /// </summary>
        public void RequestRefresh()
        {
            if (!IsLoading)
                _manualRefreshRequested = true;
        }

        /// <summary>
        /// Change the world slug at runtime and immediately refresh.
        /// </summary>
        public void LoadWorld(string slug)
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                Debug.LogWarning("[WorldLoader] LoadWorld called with empty slug — ignored.");
                return;
            }

            worldSlug = slug;
            CachedState = null;
            LastRefreshedTs = 0;
            RequestRefresh();
        }

        // ── Internal polling loop ─────────────────────────────────────────────────

        private IEnumerator PollLoop()
        {
            if (initialDelaySeconds > 0f)
                yield return new WaitForSeconds(initialDelaySeconds);

            while (true)
            {
                yield return StartCoroutine(FetchMapState());

                if (pollIntervalSeconds <= 0f)
                {
                    // Auto-poll disabled — only react to manual requests
                    yield return new WaitUntil(() => _manualRefreshRequested);
                    _manualRefreshRequested = false;
                }
                else
                {
                    // Wait for the interval, but allow an early exit via RequestRefresh()
                    float elapsed = 0f;
                    while (elapsed < pollIntervalSeconds)
                    {
                        if (_manualRefreshRequested)
                        {
                            _manualRefreshRequested = false;
                            break;
                        }
                        elapsed += Time.unscaledDeltaTime;
                        yield return null;
                    }
                }
            }
        }

        // ── Network fetch ─────────────────────────────────────────────────────────

        private IEnumerator FetchMapState()
        {
            if (IsLoading) yield break;

            IsLoading = true;
            string url = BuildUrl();
            Debug.Log($"[WorldLoader] Fetching {url}");

            using var request = UnityWebRequest.Get(url);
            request.SetRequestHeader("Accept", "application/json");
            request.timeout = 15;

            yield return request.SendWebRequest();

            IsLoading = false;

            if (request.result != UnityWebRequest.Result.Success)
            {
                string err = $"[WorldLoader] Network error ({request.responseCode}): {request.error}";
                Debug.LogWarning(err);
                OnLoadError?.Invoke(err);
                yield break;
            }

            string json = request.downloadHandler.text;
            ParseAndCache(json);
        }

        // ── Parse + cache ─────────────────────────────────────────────────────────

        private void ParseAndCache(string json)
        {
            MapStateDto dto;
            try
            {
                dto = JsonUtility.FromJson<MapStateDto>(json);
            }
            catch (Exception ex)
            {
                string err = $"[WorldLoader] JSON parse failed: {ex.Message}";
                Debug.LogError(err);
                OnLoadError?.Invoke(err);
                return;
            }

            if (dto == null || string.IsNullOrEmpty(dto.worldSlug))
            {
                string err = "[WorldLoader] Received null or malformed MapStateDto.";
                Debug.LogError(err);
                OnLoadError?.Invoke(err);
                return;
            }

            CachedState      = dto;
            LastRefreshedTs  = dto.ts;

            Debug.Log($"[WorldLoader] Loaded world='{dto.worldSlug}' " +
                      $"territories={dto.territories?.Count ?? 0} " +
                      $"factions={dto.factions?.Count ?? 0} " +
                      $"armies={dto.armies?.Count ?? 0} " +
                      $"npcs={dto.npcs?.Count ?? 0}");

            OnStateRefreshed?.Invoke(dto);
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private string BuildUrl()
        {
            string base_ = apiBaseUrl.TrimEnd('/');
            string slug  = Uri.EscapeDataString(worldSlug);
            return $"{base_}/api/unity/map-state/{slug}";
        }
    }
}
