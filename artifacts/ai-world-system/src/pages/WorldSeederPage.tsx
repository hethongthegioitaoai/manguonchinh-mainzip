import { useState, useCallback } from "react";
import { Link } from "wouter";

/* ─── Types ──────────────────────────────────────────────── */
interface StepResult { step: string; ok: boolean; msg: string; ts: string }

const WORLDS = [
  { slug: "cultivation", label: "Tu Tiên" },
  { slug: "cyberpunk",   label: "Cyberpunk" },
  { slug: "zombie",      label: "Hoang Phế" },
];

/* ─── Helpers ────────────────────────────────────────────── */
async function apiPost(path: string, body?: object): Promise<{ ok: boolean; data: any }> {
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, data };
  } catch (e: any) {
    return { ok: false, data: { error: e.message } };
  }
}

function now() { return new Date().toLocaleTimeString("vi-VN"); }

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
export default function WorldSeederPage() {
  const [worldSlug, setWorldSlug] = useState("cultivation");
  const [tickCount, setTickCount] = useState(50);
  const [log, setLog] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);
  const [ticksDone, setTicksDone] = useState(0);

  const push = useCallback((step: string, ok: boolean, msg: string) => {
    setLog(prev => [{ step, ok, msg, ts: now() }, ...prev]);
  }, []);

  /* ── Individual seed steps ── */
  async function seedDefaults() {
    const { ok, data } = await apiPost("/api/simulation/seed-defaults");
    push("Seed Defaults (3 worlds)", ok, ok ? data.message : data.error ?? "Lỗi");
  }

  async function seedTerritories() {
    const { ok, data } = await apiPost(`/api/territories/seed/${worldSlug}`);
    push(`Seed Territories [${worldSlug}]`, ok, ok ? data.message : data.error ?? "Lỗi");
  }

  async function seedWorldMap() {
    const { ok, data } = await apiPost(`/api/world-map/${worldSlug}/seed`);
    push(`Seed WorldMap coords [${worldSlug}]`, ok, ok ? (data.message ?? JSON.stringify(data)) : data.error ?? "Lỗi");
  }

  async function seedNPCs() {
    const { ok, data } = await apiPost(`/api/npc-core/seed/${worldSlug}`);
    push(`Seed NPCs [${worldSlug}]`, ok, ok ? data.message : data.error ?? "Lỗi");
  }

  async function seedPolicies() {
    const { ok, data } = await apiPost("/api/npc-policy/seed");
    push("Seed Policies", ok, ok ? (data.message ?? "Done") : data.error ?? "Lỗi");
  }

  async function establishMilitary() {
    const { ok, data } = await apiPost(`/api/military/establish/${worldSlug}`);
    push(`Establish Military [${worldSlug}]`, ok, ok ? (data.message ?? `Armies: ${data.established ?? "?"}`): data.error ?? "Lỗi (cần đăng nhập)");
  }

  async function runTick() {
    const { ok, data } = await apiPost(`/api/simulation/tick/${worldSlug}`);
    return { ok, data };
  }

  async function runNTicks(n: number) {
    setRunning(true);
    setTicksDone(0);
    push(`Bắt đầu chạy ${n} ticks…`, true, "");
    let successCount = 0;
    for (let i = 0; i < n; i++) {
      const { ok, data } = await runTick();
      if (ok) successCount++;
      else {
        push(`Tick ${i + 1} FAILED`, false, data.error ?? "Lỗi");
        break;
      }
      setTicksDone(i + 1);
    }
    push(`Hoàn thành ${successCount}/${n} ticks`, successCount > 0, `Tick thứ ${successCount} xong`);
    setRunning(false);
  }

  async function runStressTest(n: number) {
    setRunning(true);
    push(`Stress Test ${n} ticks…`, true, "");
    const { ok, data } = await apiPost(`/api/simulation/stress-test/${worldSlug}`, { ticks: n });
    push(`Stress Test ${n} ticks`, ok, ok
      ? `✓ Ticks: ${data.ticks}, Crashes: ${data.crashes ?? 0}, Negative: ${data.negativeValues ?? 0}`
      : data.error ?? "Lỗi (cần đăng nhập)");
    setRunning(false);
  }

  /* ── Full auto sequence ── */
  async function fullAutoSeed() {
    setRunning(true);
    setLog([]);
    push("▶ FULL AUTO SEED BẮT ĐẦU", true, `World: ${worldSlug}`);

    // Step 1: Seed defaults
    { const { ok, data } = await apiPost("/api/simulation/seed-defaults");
      push("1. Seed Defaults", ok, ok ? data.message : data.error ?? "Lỗi"); }

    // Step 2: Territories
    { const { ok, data } = await apiPost(`/api/territories/seed/${worldSlug}`);
      push("2. Seed Territories", ok, ok ? data.message : data.error ?? "Lỗi"); }

    // Step 3: WorldMap coords
    { const { ok, data } = await apiPost(`/api/world-map/${worldSlug}/seed`);
      push("3. Seed WorldMap", ok, ok ? (data.message ?? "OK") : data.error ?? "Lỗi"); }

    // Step 4: NPCs
    { const { ok, data } = await apiPost(`/api/npc-core/seed/${worldSlug}`);
      push("4. Seed NPCs", ok, ok ? data.message : data.error ?? "Lỗi"); }

    // Step 5: Military
    { const { ok, data } = await apiPost(`/api/military/establish/${worldSlug}`);
      push("5. Establish Military", ok, ok ? (data.message ?? `OK`) : data.error ?? "Lỗi (cần đăng nhập)"); }

    // Step 6: Policies
    { const { ok, data } = await apiPost("/api/npc-policy/seed");
      push("6. Seed Policies", ok, ok ? (data.message ?? "OK") : data.error ?? "Không cần thiết"); }

    // Step 7: Run ticks
    push(`7. Chạy ${tickCount} ticks…`, true, "");
    let success = 0;
    for (let i = 0; i < tickCount; i++) {
      const { ok, data } = await runTick();
      if (ok) { success++; setTicksDone(i + 1); }
      else { push(`Tick ${i + 1} lỗi`, false, data.error ?? "Lỗi"); break; }
    }
    push(`7. Ticks hoàn thành: ${success}/${tickCount}`, success > 0, "");
    push("✅ SEED HOÀN TẤT", true, `Thế giới ${worldSlug} đã sẵn sàng!`);
    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-black text-gray-100" style={{ fontFamily: "monospace" }}>

      {/* Header */}
      <div className="border-b border-cyan-900/50 px-4 py-2 flex items-center gap-3">
        <Link href="/dashboard">
          <span className="text-cyan-500 hover:text-cyan-300 text-sm cursor-pointer">← Dashboard</span>
        </Link>
        <span className="text-cyan-400 font-bold text-base tracking-widest">🌱 WORLD SEEDER</span>
        <span className="text-gray-600 text-xs ml-2">Seed thế giới và chạy ticks để quan sát</span>
      </div>

      <div className="flex gap-4 p-4" style={{ height: "calc(100vh - 56px)" }}>

        {/* ── LEFT: Controls ── */}
        <div className="w-80 flex flex-col gap-3 shrink-0">

          {/* World selector */}
          <div className="bg-gray-950 border border-cyan-900/50 rounded-lg p-3">
            <div className="text-cyan-400 text-xs font-bold mb-2">🌍 CHỌN THẾ GIỚI</div>
            <div className="flex flex-col gap-1.5">
              {WORLDS.map(w => (
                <button key={w.slug}
                  onClick={() => setWorldSlug(w.slug)}
                  className={`text-left px-3 py-2 rounded border text-sm transition-colors ${
                    worldSlug === w.slug
                      ? "border-cyan-500 bg-cyan-900/20 text-cyan-300"
                      : "border-gray-800 text-gray-500 hover:border-gray-600"
                  }`}>
                  {w.label} <span className="text-gray-600 text-xs ml-1">({w.slug})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Auto Full Seed */}
          <div className="bg-gray-950 border border-green-900/50 rounded-lg p-3">
            <div className="text-green-400 text-xs font-bold mb-2">⚡ FULL AUTO SEED</div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-500 text-xs">Số ticks:</span>
              <input type="number" min={1} max={500} value={tickCount}
                onChange={e => setTickCount(Number(e.target.value))}
                className="w-20 bg-gray-900 border border-gray-700 text-cyan-300 text-xs px-2 py-1 rounded"/>
            </div>
            <button
              onClick={fullAutoSeed}
              disabled={running}
              className="w-full py-2 rounded border border-green-600 bg-green-900/20 text-green-300 text-sm font-bold hover:bg-green-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {running ? `Đang chạy… (tick ${ticksDone}/${tickCount})` : "▶ FULL SEED + TICK"}
            </button>
            <p className="text-gray-600 text-xs mt-1.5">
              Thứ tự: Defaults → Territories → Map → NPCs → Military → Policies → Ticks
            </p>
          </div>

          {/* Individual steps */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs font-bold mb-2">🔧 TỪNG BƯỚC</div>
            <div className="flex flex-col gap-1.5">
              {[
                { label: "1. Seed Defaults (3 worlds)", fn: seedDefaults, color: "blue" },
                { label: "2. Seed Territories", fn: seedTerritories, color: "cyan" },
                { label: "3. Seed WorldMap coords", fn: seedWorldMap, color: "cyan" },
                { label: "4. Seed NPCs", fn: seedNPCs, color: "purple" },
                { label: "5. Establish Military ⚠ (cần login)", fn: establishMilitary, color: "red" },
                { label: "6. Seed Policies", fn: seedPolicies, color: "yellow" },
              ].map(({ label, fn, color }) => (
                <button key={label}
                  onClick={fn}
                  disabled={running}
                  className={`text-left px-2 py-1.5 rounded border text-xs hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-${color}-900 text-${color}-400 bg-${color}-950/20`}
                  style={{ borderColor: color === "blue" ? "#1e3a5f" : color === "cyan" ? "#164e63" : color === "purple" ? "#3b1f6b" : color === "red" ? "#7f1d1d" : color === "yellow" ? "#713f12" : "#374151" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tick runner */}
          <div className="bg-gray-950 border border-orange-900/50 rounded-lg p-3">
            <div className="text-orange-400 text-xs font-bold mb-2">⏩ CHẠY TICKS (cần login)</div>
            <div className="grid grid-cols-2 gap-1.5">
              {[10, 50, 100, 200].map(n => (
                <button key={n}
                  onClick={() => runNTicks(n)}
                  disabled={running}
                  className="py-1.5 rounded border border-orange-800 text-orange-400 text-xs hover:bg-orange-900/20 disabled:opacity-40 disabled:cursor-not-allowed">
                  {n} ticks
                </button>
              ))}
            </div>
            {running && ticksDone > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Tiến trình</span>
                  <span>{ticksDone}/{tickCount}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all"
                    style={{ width: `${(ticksDone / tickCount) * 100}%` }}/>
                </div>
              </div>
            )}
          </div>

          {/* Stress test */}
          <div className="bg-gray-950 border border-red-900/50 rounded-lg p-3">
            <div className="text-red-400 text-xs font-bold mb-2">💀 STRESS TEST (cần login)</div>
            <div className="flex gap-1.5">
              {[200, 500].map(n => (
                <button key={n}
                  onClick={() => runStressTest(n)}
                  disabled={running}
                  className="flex-1 py-1.5 rounded border border-red-800 text-red-400 text-xs hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed">
                  {n} ticks
                </button>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
            <div className="text-gray-400 text-xs font-bold mb-2">🔗 QUAN SÁT</div>
            <div className="flex flex-col gap-1">
              {[
                { href: "/political-map", label: "🗺 Political Map" },
                { href: "/simulation-analytics", label: "📊 Simulation Analytics" },
                { href: "/npcs", label: "👥 NPC List" },
              ].map(({ href, label }) => (
                <Link key={href} href={href}>
                  <span className="block px-2 py-1 text-cyan-500 hover:text-cyan-300 text-xs cursor-pointer hover:bg-cyan-900/10 rounded">
                    {label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Log ── */}
        <div className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-xs font-bold">📋 NHẬT KÝ THỰC THI</span>
            {log.length > 0 && (
              <button onClick={() => setLog([])}
                className="text-gray-600 hover:text-gray-400 text-xs">Xóa</button>
            )}
          </div>

          {log.length === 0 && (
            <div className="text-gray-600 text-sm text-center mt-20">
              Bấm "FULL SEED + TICK" để bắt đầu<br/>
              <span className="text-gray-700 text-xs mt-1 block">Kết quả sẽ hiện ở đây</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            {log.map((item, i) => (
              <div key={i}
                className={`flex items-start gap-2 px-2 py-1.5 rounded text-xs border ${
                  item.ok
                    ? "border-green-900/50 bg-green-950/20"
                    : "border-red-900/50 bg-red-950/20"
                }`}>
                <span className={item.ok ? "text-green-400 shrink-0" : "text-red-400 shrink-0"}>
                  {item.ok ? "✓" : "✗"}
                </span>
                <span className={`font-bold shrink-0 ${item.ok ? "text-green-300" : "text-red-300"}`}
                  style={{ minWidth: 160 }}>
                  {item.step}
                </span>
                <span className="text-gray-400 flex-1">{item.msg}</span>
                <span className="text-gray-700 shrink-0">{item.ts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
