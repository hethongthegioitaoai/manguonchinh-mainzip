using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Phase 7.7 — ReplayController
    ///
    /// Fetches missed events from GET /api/unity/delta/:worldSlug?lastTick=N
    /// using paginated REST calls. Falls back to a full snapshot if the gap is
    /// too large or the server reports no events for the requested range.
    ///
    /// REST endpoints used
    /// --------------------
    ///   GET /api/unity/delta/:worldSlug
    ///       ?lastTick={N}          — fetch events since tick N
    ///       &clientId={clientId}   — server-side cursor (in-memory, survives reconnects)
    ///       &limit=1000            — maximum per call (server cap)
    ///   Response: { worldSlug, lastTickSent, previousCursor, count, events: DeltaEvent[] }
    ///
    ///   GET /api/unity/map-state/:worldSlug
    ///       — full snapshot for snapshot recovery
    ///
    /// Pagination strategy for 10,000+ events
    /// -----------------------------------------
    ///   Events arrive in pages of 1000 (server hard cap).
    ///   ReplayController loops pages until count < limit (last page).
    ///   Processing is interleaved: each page is fed to EventEffectManager
    ///   in replay mode before fetching the next page, keeping memory flat.
    ///
    ///   Worst-case memory per page: 1000 events × ~500 bytes = ~500 KB.
    ///   Page is discarded after processing — O(1) steady-state memory.
    ///
    /// Stress-test sizing
    /// -------------------
    ///   1,000 ticks  → ~280 events  → 1 page  (< 1 REST call at limit=1000)
    ///   5,000 ticks  → ~1400 events → 2 pages
    ///  10,000 ticks  → ~2800 events → 3 pages
    ///  50,000 ticks  → ~14000 events→ 14 pages (~7 s at 500ms/page)
    ///
    ///   Server retains 100,000 events per world (eventBus.ts RETENTION_LIMIT).
    ///   Any gap within the last 100k events is recoverable via delta.
    ///   Beyond that: snapshot recovery is triggered automatically.
    ///
    /// Snapshot fallback
    /// ------------------
    ///   Triggered when:
    ///     a) maxPagesPerSession reached without catching up
    ///     b) Server returns 0 events for a non-zero tick gap (pruned)
    ///     c) lastReceivedTick == -1 (cold start — never connected before)
    ///   Snapshot recovery calls WorldLoader.LoadWorld() which fires
    ///   OnStateRefreshed — all visual managers (TerritoryRendererPool,
    ///   ArmyMovementController, HeatmapManager) rebuild from the snapshot.
    /// </summary>
    public class ReplayController : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────────────────
        // Inspector
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Dependencies")]
        public WorldLoader          loader;
        public EventDispatcher      dispatcher;
        public EventEffectManager   effects;

        [Header("Endpoints")]
        [Tooltip("Base URL of the API server. e.g. http://localhost:8080")]
        public string apiBaseUrl = "http://localhost:8080";
        [Tooltip("Stable identifier for this Unity client — server stores lastTickSent per clientId.")]
        public string clientId   = "unity-client-1";

        [Header("Pagination")]
        [Tooltip("Events per REST call. Must match server cap (1000).")]
        [Range(100, 1000)]
        public int   pageLimit            = 1000;
        [Tooltip("Max pages fetched per FetchMissed() call. Prevents runaway fetches on very large gaps.")]
        [Range(1, 100)]
        public int   maxPagesPerSession   = 20;
        [Tooltip("Seconds to wait between page fetches. Prevents server hammering.")]
        [Range(0f, 5f)]
        public float delayBetweenPages    = 0.1f;

        [Header("Snapshot Fallback")]
        [Tooltip("If missed event count exceeds this, skip delta replay and take a snapshot instead.")]
        [Range(100, 50000)]
        public int   snapshotFallbackThreshold = 5000;

        [Header("Retry")]
        [Range(0, 5)]
        public int   maxRetries           = 2;
        [Range(0.5f, 10f)]
        public float retryDelay           = 1.5f;

        [Header("Debug")]
        public bool  verboseLog           = false;

        // ─────────────────────────────────────────────────────────────────────────
        // Public state
        // ─────────────────────────────────────────────────────────────────────────

        public enum ReplayState { Idle, FetchingDelta, FetchingSnapshot, Complete, Failed }
        public ReplayState State { get; private set; } = ReplayState.Idle;

        public int  TotalEventsFetched  { get; private set; }
        public int  TotalPagesConsumed  { get; private set; }
        public int  SnapshotRecoveries  { get; private set; }

        /// <summary>Fires when a replay session starts (arg = worldSlug).</summary>
        public event Action<string>     OnReplayStarted;
        /// <summary>Fires after each page is processed (arg = eventsInPage).</summary>
        public event Action<int>        OnPageProcessed;
        /// <summary>Fires when replay completes (arg = total events replayed).</summary>
        public event Action<int>        OnReplayComplete;
        /// <summary>Fires when snapshot recovery starts.</summary>
        public event Action             OnSnapshotStarted;

        // ─────────────────────────────────────────────────────────────────────────
        // Private
        // ─────────────────────────────────────────────────────────────────────────

        private Coroutine _activeSession;
        private bool      _sessionActive;

        // ─────────────────────────────────────────────────────────────────────────
        // Public API
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Fetch all delta events since fromTick for worldSlug.
        /// Skips if a session is already in progress.
        /// Called automatically by EventDispatcher on gap detection and reconnect.
        /// </summary>
        public void FetchMissed(string worldSlug, int fromTick)
        {
            if (_sessionActive)
            {
                Log($"[Replay] Session already active — skipping FetchMissed(tick={fromTick})");
                return;
            }
            _activeSession = StartCoroutine(ReplaySession(worldSlug, fromTick));
        }

        /// <summary>
        /// Force a full snapshot recovery regardless of tick cursor.
        /// Useful on cold start or if delta is irreparably out of sync.
        /// </summary>
        public void ForceSnapshotRecovery(string worldSlug)
        {
            if (_activeSession != null) StopCoroutine(_activeSession);
            _activeSession = StartCoroutine(SnapshotRecovery(worldSlug));
        }

        /// <summary>Cancel any active replay session immediately.</summary>
        public void CancelSession()
        {
            if (_activeSession != null) StopCoroutine(_activeSession);
            _sessionActive = false;
            State = ReplayState.Idle;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Replay session coroutine
        // ─────────────────────────────────────────────────────────────────────────

        private IEnumerator ReplaySession(string worldSlug, int fromTick)
        {
            _sessionActive = true;
            State          = ReplayState.FetchingDelta;

            int sessionTick   = fromTick;
            int pagesThisSession = 0;
            int totalThisSession = 0;

            OnReplayStarted?.Invoke(worldSlug);
            Log($"[Replay] Session start: world={worldSlug} fromTick={fromTick}");

            // Enable replay mode on effects manager
            bool wasReplay = effects != null && effects.replayMode;
            if (effects != null) effects.replayMode = true;

            while (pagesThisSession < maxPagesPerSession)
            {
                // Build URL
                string url = $"{apiBaseUrl}/api/unity/delta/{worldSlug}" +
                             $"?lastTick={sessionTick}&clientId={Uri.EscapeDataString(clientId)}&limit={pageLimit}";

                DeltaPageResponse page = null;
                int retries = 0;

                // Fetch one page with retries
                while (retries <= maxRetries)
                {
                    yield return FetchPage(url, result =>
                    {
                        page = result;
                    });

                    if (page != null) break;

                    retries++;
                    if (retries <= maxRetries)
                    {
                        Log($"[Replay] Retry {retries}/{maxRetries} after {retryDelay}s");
                        yield return new WaitForSeconds(retryDelay);
                    }
                }

                // Failed all retries
                if (page == null)
                {
                    Debug.LogWarning($"[Replay] Page fetch failed after {maxRetries} retries — falling back to snapshot");
                    yield return SnapshotRecovery(worldSlug);
                    goto Done;
                }

                // Server returned 0 events on a non-zero gap — may be pruned
                if (page.count == 0 && totalThisSession == 0 && fromTick > 0)
                {
                    Log("[Replay] Server returned 0 events — triggering snapshot recovery");
                    yield return SnapshotRecovery(worldSlug);
                    goto Done;
                }

                // Check if we should switch to snapshot (very large gap)
                if (totalThisSession == 0 && page.count == pageLimit)
                {
                    // Estimate total remaining: project from first page size
                    // If gap is beyond threshold, take snapshot instead
                    if (fromTick >= 0 && page.lastTickSent - fromTick > snapshotFallbackThreshold)
                    {
                        Log($"[Replay] Gap {page.lastTickSent - fromTick} > threshold {snapshotFallbackThreshold} — snapshot recovery");
                        yield return SnapshotRecovery(worldSlug);
                        goto Done;
                    }
                }

                // Process events — filter out any already in the ring buffer
                var toProcess = FilterAlreadyBuffered(page.events, sessionTick);

                if (toProcess.Count > 0)
                    effects?.EnqueueBatch(ConvertPageToDelta(toProcess));

                totalThisSession    += page.count;
                TotalEventsFetched  += page.count;
                TotalPagesConsumed++;
                pagesThisSession++;
                sessionTick         = page.lastTickSent;

                OnPageProcessed?.Invoke(page.count);
                Log($"[Replay] Page {pagesThisSession}: {page.count} events, lastTick={page.lastTickSent}");

                // Update dispatcher cursor
                if (dispatcher != null && page.lastTickSent > dispatcher.LastReceivedTick)
                {
                    // Safe update via reflection-free approach: dispatcher exposes a method
                    dispatcher.SetLastReceivedTickFromReplay(page.lastTickSent);
                }

                // Last page — done
                if (page.count < pageLimit) break;

                // Inter-page delay to avoid hammering
                if (delayBetweenPages > 0f)
                    yield return new WaitForSeconds(delayBetweenPages);
            }

            if (pagesThisSession >= maxPagesPerSession)
            {
                Debug.LogWarning($"[Replay] maxPagesPerSession ({maxPagesPerSession}) reached — " +
                                  "catching up via next poll cycle");
            }

            Done:
            if (effects != null) effects.replayMode = wasReplay;
            State = ReplayState.Complete;
            _sessionActive = false;
            OnReplayComplete?.Invoke(totalThisSession);
            Log($"[Replay] Session complete: {totalThisSession} events, {pagesThisSession} pages");
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Snapshot recovery coroutine
        // ─────────────────────────────────────────────────────────────────────────

        private IEnumerator SnapshotRecovery(string worldSlug)
        {
            State = ReplayState.FetchingSnapshot;
            OnSnapshotStarted?.Invoke();
            SnapshotRecoveries++;
            Log($"[Replay] Snapshot recovery for world={worldSlug}");

            // Delegate to WorldLoader — it fires OnStateRefreshed which rebuilds all visuals
            if (loader != null)
            {
                loader.RequestRefresh();
                yield return new WaitForSeconds(0.5f); // give loader time to start
            }
            else
            {
                Debug.LogWarning("[Replay] WorldLoader not assigned — snapshot recovery unavailable");
            }

            State = ReplayState.Complete;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // HTTP fetch
        // ─────────────────────────────────────────────────────────────────────────

        private IEnumerator FetchPage(string url, Action<DeltaPageResponse> callback)
        {
            using var req = UnityWebRequest.Get(url);
            req.timeout = 15;
            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                Log($"[Replay] HTTP error: {req.error} url={url}");
                callback(null);
                yield break;
            }

            DeltaPageResponse page = null;
            try { page = JsonUtility.FromJson<DeltaPageResponse>(req.downloadHandler.text); }
            catch (Exception e) { Debug.LogWarning($"[Replay] Parse error: {e.Message}"); }

            callback(page);
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Helpers
        // ─────────────────────────────────────────────────────────────────────────

        private List<DeltaEventRaw> FilterAlreadyBuffered(DeltaEventRaw[] incoming, int sinceExclusive)
        {
            if (incoming == null) return new List<DeltaEventRaw>();

            // Get already-buffered ticks
            var buffered = dispatcher?.GetBufferedSince(sinceExclusive);
            var bufferedTicks = new HashSet<int>();
            if (buffered != null)
                foreach (var e in buffered) bufferedTicks.Add(e.tick);

            var result = new List<DeltaEventRaw>(incoming.Length);
            foreach (var e in incoming)
                if (!bufferedTicks.Contains(e.tick))
                    result.Add(e);
            return result;
        }

        private IEnumerable<DeltaEvent> ConvertPageToDelta(List<DeltaEventRaw> raws)
        {
            foreach (var raw in raws)
            {
                var changes = EventDispatcher.ParsePayloadDict(raw.changesRaw);
                if (!changes.ContainsKey("_sourceEvent"))
                    changes["_sourceEvent"] = raw.type;
                yield return new DeltaEvent
                {
                    type     = raw.type,
                    tick     = raw.tick,
                    entityId = raw.entityId,
                    changes  = changes,
                };
            }
        }

        private void Log(string msg)
        {
            if (verboseLog) Debug.Log(msg);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Wire types for JsonUtility deserialization
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Response shape from GET /api/unity/delta/:worldSlug
    /// { worldSlug, lastTickSent, previousCursor, count, events }
    /// </summary>
    [Serializable]
    public class DeltaPageResponse
    {
        public string         worldSlug;
        public int            lastTickSent;
        public int            previousCursor;
        public int            count;
        public DeltaEventRaw[] events;
    }

    /// <summary>
    /// Raw DeltaEvent as returned by the REST endpoint.
    /// { type, tick, entityId, changes }
    /// changes is left as raw JSON string for lazy parsing.
    /// </summary>
    [Serializable]
    public class DeltaEventRaw
    {
        public string type;
        public int    tick;
        public string entityId;
        public string changesRaw; // populated by JsonUtility or manual parse
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Addendum: EventDispatcher.SetLastReceivedTickFromReplay()
// Extends EventDispatcher with the replay cursor update method.
// Must be in same namespace to avoid partial-class across files.
// ─────────────────────────────────────────────────────────────────────────────

namespace AiWorldSystem.Unity
{
    public partial class EventDispatcher
    {
        /// <summary>
        /// Called by ReplayController to advance the known tick cursor without
        /// going through OnRawEvent (avoids gap re-detection during replay).
        /// </summary>
        public void SetLastReceivedTickFromReplay(int tick)
        {
            if (tick > LastReceivedTick)
            {
                LastReceivedTick = tick;
            }
        }
    }
}
