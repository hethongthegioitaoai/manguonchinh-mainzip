/**
 * Phase 65C — Frontend Subscription Layer
 *
 * useWorldEvents(worldSlug) connects to /ws/unity, subscribes to a world,
 * and delivers canonical WorldEvents in realtime.
 *
 * On reconnect: fetches missed events from /api/unity/event-stream/:worldSlug
 * so no events are lost even if the WS dropped.
 *
 * Returns:
 *   events       — recent events buffer (last 100)
 *   latestEvent  — most recent event
 *   connected    — WS connection state
 *   stats        — events/sec and total count
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface WorldEvent {
  id?:       string;
  event:     string;
  worldSlug: string;
  tick:      number;
  ts:        number;
  payload:   Record<string, unknown>;
}

interface Stats {
  total:      number;
  perSec:     number;
  lastEventTs: number | null;
}

interface UseWorldEventsReturn {
  events:      WorldEvent[];
  latestEvent: WorldEvent | null;
  connected:   boolean;
  stats:       Stats;
  clearEvents: () => void;
}

const MAX_BUFFER = 100;
const WS_URL = () => {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/ws/unity`;
};

export function useWorldEvents(worldSlug: string | null): UseWorldEventsReturn {
  const [events, setEvents]         = useState<WorldEvent[]>([]);
  const [latestEvent, setLatest]    = useState<WorldEvent | null>(null);
  const [connected, setConnected]   = useState(false);
  const [stats, setStats]           = useState<Stats>({ total: 0, perSec: 0, lastEventTs: null });

  const wsRef        = useRef<WebSocket | null>(null);
  const retryTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTsRef    = useRef<number>(0);
  const countRef     = useRef<number>(0);
  const rateTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCount   = useRef(0);
  const mountedRef   = useRef(true);

  /* ── Catch-up: fetch missed events since lastTs ── */
  const catchUp = useCallback(async (slug: string) => {
    if (lastTsRef.current === 0) return;
    try {
      const r = await fetch(`/api/unity/event-stream/${slug}?sinceTs=${lastTsRef.current + 1}&limit=200`);
      if (!r.ok) return;
      const data = await r.json();
      if (!mountedRef.current) return;
      const evts: WorldEvent[] = data.events ?? [];
      if (evts.length > 0) {
        setEvents(prev => [...prev, ...evts].slice(-MAX_BUFFER));
        const last = evts[evts.length - 1];
        setLatest(last);
        lastTsRef.current = last.ts;
      }
    } catch {}
  }, []);

  /* ── Connect to WS ── */
  const connect = useCallback((slug: string) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const ws = new WebSocket(WS_URL());
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      retryCount.current = 0;
      ws.send(JSON.stringify({ type: "subscribe", worlds: [slug] }));
      setConnected(true);
      // Catch up on missed events
      catchUp(slug);
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(e.data);
        // Skip meta messages (subscribed, pong)
        if (data.type === "subscribed" || data.type === "pong") return;
        // Canonical events have `event` field
        if (!data.event) return;
        const evt = data as WorldEvent;
        lastTsRef.current = Math.max(lastTsRef.current, evt.ts);
        countRef.current += 1;
        setLatest(evt);
        setEvents(prev => [...prev, evt].slice(-MAX_BUFFER));
        setStats(s => ({ ...s, total: s.total + 1, lastEventTs: evt.ts }));
      } catch {}
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      // Exponential backoff: 1s, 2s, 4s, 8s, max 15s
      const delay = Math.min(1000 * 2 ** retryCount.current, 15000);
      retryCount.current += 1;
      retryTimer.current = setTimeout(() => {
        if (mountedRef.current) connect(slug);
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [catchUp]);

  /* ── Effect: connect/disconnect on worldSlug change ── */
  useEffect(() => {
    mountedRef.current = true;
    if (!worldSlug) return;

    connect(worldSlug);

    // Events/sec rate counter
    rateTimer.current = setInterval(() => {
      setStats(s => ({ ...s, perSec: countRef.current }));
      countRef.current = 0;
    }, 1000);

    return () => {
      mountedRef.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (rateTimer.current)  clearInterval(rateTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [worldSlug, connect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLatest(null);
    setStats({ total: 0, perSec: 0, lastEventTs: null });
  }, []);

  return { events, latestEvent, connected, stats, clearEvents };
}
