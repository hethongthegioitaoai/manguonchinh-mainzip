using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Phase 7.7 — WorldEventClient
    ///
    /// Maintains a WebSocket connection to /api/ws/unity.
    /// Receives WorldEvent JSON on a background thread and dispatches to the
    /// Unity main thread via a ConcurrentQueue drained in Update().
    ///
    /// WebSocket server spec (unityWs.ts)
    /// ------------------------------------
    ///   Path:      /api/ws/unity
    ///   Subscribe: { type: "subscribe", worlds: ["worldSlug"] }
    ///   Response:  { type: "subscribed", worlds: [...] }
    ///   Ping:      { type: "ping" }   → server: { type: "pong" }
    ///   Broadcast: WorldEvent { event, worldSlug, tick, ts, payload }
    ///
    /// Connection lifecycle
    /// ---------------------
    ///   Connect() → handshake → Subscribe() → receive loop
    ///   On error/close → backoff → auto-reconnect
    ///   Disconnect() → graceful close + cancel
    ///
    /// Auto-reconnect strategy (exponential backoff)
    /// -----------------------------------------------
    ///   Attempt 1:  1 s
    ///   Attempt 2:  2 s
    ///   Attempt 3:  4 s
    ///   Attempt 4:  8 s
    ///   Attempt 5+: 16 s (cap)
    ///   Max attempts: configurable (0 = unlimited)
    ///
    /// Thread model
    /// -------------
    ///   Receive loop runs on a dedicated Task (background thread pool thread).
    ///   Received messages → _inboundQueue (ConcurrentQueue, lock-free).
    ///   Update() drains _inboundQueue on the Unity main thread.
    ///   All Unity API calls happen on the main thread.
    ///
    /// Platform note
    /// --------------
    ///   Uses System.Net.WebSockets.ClientWebSocket — works on PC, Mac, iOS,
    ///   Android (IL2CPP), and Editor. Not supported on WebGL builds.
    ///   For WebGL, replace the socket implementation with a JavaScript bridge.
    /// </summary>
    public class WorldEventClient : MonoBehaviour
    {
        // ─────────────────────────────────────────────────────────────────────────
        // Inspector
        // ─────────────────────────────────────────────────────────────────────────

        [Header("Connection")]
        [Tooltip("e.g. ws://localhost:8080/api/ws/unity  or  wss://your-domain/api/ws/unity")]
        public string wsUrl = "ws://localhost:8080/api/ws/unity";

        [Tooltip("World slug(s) to subscribe to on connect.")]
        public string[] worldSlugs = new[] { "default" };

        [Tooltip("Connect automatically on Start().")]
        public bool autoConnect = true;

        [Header("Reconnect")]
        [Range(1, 120)]
        public float reconnectBaseDelay  = 1f;   // seconds
        [Range(1, 120)]
        public float reconnectMaxDelay   = 16f;  // seconds
        [Tooltip("0 = unlimited reconnect attempts.")]
        public int   reconnectMaxAttempts = 0;

        [Header("Heartbeat")]
        [Range(5, 120)]
        public float pingIntervalSeconds  = 30f;
        [Range(1, 30)]
        public float pongTimeoutSeconds   = 10f;

        [Header("Receive Buffer")]
        [Tooltip("Bytes allocated per receive segment. 8 KB handles most events.")]
        public int   receiveBufferBytes   = 8192;
        [Tooltip("Max messages per Update() drain. Caps main-thread time per frame.")]
        public int   maxDrainPerFrame     = 50;

        [Header("Debug")]
        public bool  verboseLog           = false;

        // ─────────────────────────────────────────────────────────────────────────
        // Events (main thread)
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>Fired for every WorldEvent received from the server.</summary>
        public event Action<WorldEventDto> OnEventReceived;

        /// <summary>Fired when the WebSocket connection opens and subscribes.</summary>
        public event Action OnConnected;

        /// <summary>Fired on clean or unexpected disconnect before reconnect attempt.</summary>
        public event Action<string> OnDisconnected;

        /// <summary>Fired when all reconnect attempts are exhausted.</summary>
        public event Action OnConnectionFailed;

        // ─────────────────────────────────────────────────────────────────────────
        // Public state
        // ─────────────────────────────────────────────────────────────────────────

        public enum ConnectionState { Disconnected, Connecting, Connected, Reconnecting, Failed }
        public ConnectionState State { get; private set; } = ConnectionState.Disconnected;

        public int TotalEventsReceived { get; private set; }
        public int ReconnectAttempts   { get; private set; }

        // ─────────────────────────────────────────────────────────────────────────
        // Private
        // ─────────────────────────────────────────────────────────────────────────

        // Thread-safe inbound queue — background thread writes, main thread reads
        private readonly ConcurrentQueue<string> _inboundQueue = new();

        // Control signals for background task
        private CancellationTokenSource _cts;
        private ClientWebSocket         _ws;

        // Heartbeat state (tracked on main thread via queued messages)
        private float   _lastPongTime;
        private float   _lastPingTime;
        private bool    _awaitingPong;

        private static readonly byte[] PingMsg =
            Encoding.UTF8.GetBytes("{\"type\":\"ping\"}");

        // ─────────────────────────────────────────────────────────────────────────
        // Lifecycle
        // ─────────────────────────────────────────────────────────────────────────

        private void Start()
        {
            if (autoConnect) Connect();
        }

        private void Update()
        {
            DrainInbound();
            TickHeartbeat();
        }

        private void OnDestroy() => Disconnect();

        private void OnApplicationQuit() => Disconnect();

        // ─────────────────────────────────────────────────────────────────────────
        // Public API
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>Open the WebSocket connection. Safe to call multiple times.</summary>
        public void Connect()
        {
            if (State == ConnectionState.Connected || State == ConnectionState.Connecting)
                return;

            ReconnectAttempts = 0;
            _cts = new CancellationTokenSource();
            State = ConnectionState.Connecting;
            _ = ConnectLoop(_cts.Token);
        }

        /// <summary>Close the WebSocket cleanly. Stops all reconnect attempts.</summary>
        public void Disconnect()
        {
            _cts?.Cancel();
            _ws?.Abort();
            _ws?.Dispose();
            _ws = null;
            State = ConnectionState.Disconnected;
        }

        /// <summary>Send raw JSON to the server (main thread or background).</summary>
        public async void SendRaw(string json)
        {
            if (_ws == null || _ws.State != WebSocketState.Open) return;
            var bytes = Encoding.UTF8.GetBytes(json);
            try { await _ws.SendAsync(new ArraySegment<byte>(bytes),
                WebSocketMessageType.Text, true, _cts?.Token ?? CancellationToken.None); }
            catch (Exception e) { LogVerbose($"[WS] Send failed: {e.Message}"); }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Connection loop (background task)
        // ─────────────────────────────────────────────────────────────────────────

        private async Task ConnectLoop(CancellationToken ct)
        {
            float delay = reconnectBaseDelay;

            while (!ct.IsCancellationRequested)
            {
                // Check attempt limit
                if (reconnectMaxAttempts > 0 && ReconnectAttempts >= reconnectMaxAttempts)
                {
                    QueueMainThread(() => { State = ConnectionState.Failed; OnConnectionFailed?.Invoke(); });
                    return;
                }

                try
                {
                    QueueMainThread(() => State = ReconnectAttempts == 0
                        ? ConnectionState.Connecting : ConnectionState.Reconnecting);

                    _ws?.Dispose();
                    _ws = new ClientWebSocket();

                    LogVerbose($"[WS] Connecting to {wsUrl} (attempt {ReconnectAttempts + 1})");
                    await _ws.ConnectAsync(new Uri(wsUrl), ct);

                    // Subscribe to worlds
                    string subMsg = BuildSubscribeMsg(worldSlugs);
                    var subBytes  = Encoding.UTF8.GetBytes(subMsg);
                    await _ws.SendAsync(new ArraySegment<byte>(subBytes),
                        WebSocketMessageType.Text, true, ct);

                    QueueMainThread(() =>
                    {
                        State = ConnectionState.Connected;
                        ReconnectAttempts = 0;
                        _lastPongTime = Time.unscaledTime;
                        _lastPingTime = Time.unscaledTime;
                        _awaitingPong = false;
                        OnConnected?.Invoke();
                    });

                    delay = reconnectBaseDelay; // reset backoff on success
                    await ReceiveLoop(ct);      // blocks until disconnect
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    // Clean disconnect — stop loop
                    return;
                }
                catch (Exception e)
                {
                    string reason = e.Message;
                    LogVerbose($"[WS] Error: {reason}");
                    QueueMainThread(() => OnDisconnected?.Invoke(reason));
                }

                ReconnectAttempts++;
                float actualDelay = delay;
                await Task.Delay(TimeSpan.FromSeconds(actualDelay), CancellationToken.None);
                delay = Mathf.Min(delay * 2f, reconnectMaxDelay);
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Receive loop (background)
        // ─────────────────────────────────────────────────────────────────────────

        private async Task ReceiveLoop(CancellationToken ct)
        {
            var buf    = new byte[receiveBufferBytes];
            var seg    = new ArraySegment<byte>(buf);
            var sb     = new System.Text.StringBuilder(receiveBufferBytes);

            while (!ct.IsCancellationRequested && _ws.State == WebSocketState.Open)
            {
                sb.Clear();
                WebSocketReceiveResult result;

                do
                {
                    result = await _ws.ReceiveAsync(seg, ct);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure,
                            "Server closed", CancellationToken.None);
                        QueueMainThread(() => OnDisconnected?.Invoke("Server closed"));
                        return;
                    }

                    sb.Append(Encoding.UTF8.GetString(buf, 0, result.Count));

                } while (!result.EndOfMessage);

                string raw = sb.ToString();
                if (!string.IsNullOrEmpty(raw))
                    _inboundQueue.Enqueue(raw);
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Main-thread drain
        // ─────────────────────────────────────────────────────────────────────────

        private void DrainInbound()
        {
            int drained = 0;
            while (drained < maxDrainPerFrame && _inboundQueue.TryDequeue(out string raw))
            {
                drained++;
                ParseAndDispatch(raw);
            }
        }

        private void ParseAndDispatch(string raw)
        {
            try
            {
                // Fast-path: detect control messages before full parse
                if (raw.Contains("\"type\":\"pong\""))
                {
                    _lastPongTime = Time.unscaledTime;
                    _awaitingPong = false;
                    return;
                }
                if (raw.Contains("\"type\":\"subscribed\""))
                    return;

                // Full parse for WorldEvent
                var evt = JsonUtility.FromJson<WorldEventDto>(raw);
                if (string.IsNullOrEmpty(evt?.@event)) return;

                TotalEventsReceived++;
                OnEventReceived?.Invoke(evt);
            }
            catch (Exception e)
            {
                LogVerbose($"[WS] Parse error: {e.Message} raw={raw[..Mathf.Min(80, raw.Length)]}");
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Heartbeat (main thread)
        // ─────────────────────────────────────────────────────────────────────────

        private void TickHeartbeat()
        {
            if (State != ConnectionState.Connected) return;

            float now = Time.unscaledTime;

            // Send ping
            if (!_awaitingPong && now - _lastPingTime >= pingIntervalSeconds)
            {
                _lastPingTime = now;
                _awaitingPong = true;
                _ = SendPingAsync();
            }

            // Pong timeout → treat as disconnect
            if (_awaitingPong && now - _lastPingTime > pongTimeoutSeconds)
            {
                LogVerbose("[WS] Pong timeout — reconnecting");
                _awaitingPong = false;
                State = ConnectionState.Reconnecting;
                _ws?.Abort();
            }
        }

        private async Task SendPingAsync()
        {
            if (_ws?.State != WebSocketState.Open) return;
            try { await _ws.SendAsync(new ArraySegment<byte>(PingMsg),
                WebSocketMessageType.Text, true, _cts?.Token ?? CancellationToken.None); }
            catch { /* ignore send failure — ReceiveLoop will detect disconnect */ }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Helpers
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Enqueues an action to run on the main thread via the inbound queue.
        /// We abuse the string queue by using a wrapper — in practice call this
        /// only from the background Task since MonoBehaviour methods must run on main.
        /// </summary>
        private readonly ConcurrentQueue<Action> _mainThreadQueue = new();

        private void QueueMainThread(Action a) => _mainThreadQueue.Enqueue(a);

        // Make sure main thread actions are actually drained
        private new void Update_Extension()
        {
            while (_mainThreadQueue.TryDequeue(out var a)) { try { a(); } catch { } }
        }

        // Override Update to also drain mainThreadQueue
        // (Unity doesn't allow override of Unity messages, so we call it manually)
        private void LateUpdate() => Update_Extension();

        private static string BuildSubscribeMsg(string[] slugs)
        {
            var sb = new System.Text.StringBuilder();
            sb.Append("{\"type\":\"subscribe\",\"worlds\":[");
            for (int i = 0; i < slugs.Length; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append('"'); sb.Append(slugs[i]); sb.Append('"');
            }
            sb.Append("]}");
            return sb.ToString();
        }

        private void LogVerbose(string msg)
        {
            if (verboseLog) Debug.Log(msg);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // WorldEventDto — JsonUtility-compatible
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Wire format of a WorldEvent broadcast from unityWs.ts.
    /// { event, worldSlug, tick, ts, payload }
    ///
    /// JsonUtility cannot deserialise nested dictionaries, so payload is left
    /// as a raw JSON string. EventDispatcher extracts individual fields from it.
    /// </summary>
    [Serializable]
    public class WorldEventDto
    {
        public string @event;     // e.g. "territory_capture"
        public string worldSlug;
        public int    tick;
        public long   ts;         // Unix ms
        // payload is deserialized as raw JSON by EventDispatcher using MiniJSON/JsonUtility tricks
        public string payloadRaw; // populated by EventDispatcher.EnrichPayload if needed
    }
}
