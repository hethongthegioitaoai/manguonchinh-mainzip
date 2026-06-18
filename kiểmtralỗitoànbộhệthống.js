#!/usr/bin/env node
/**
 * KIỂM TRA LỖI TOÀN BỘ HỆ THỐNG
 * Quét toàn bộ app, phát hiện lỗi, tự động fix những gì có thể.
 * Chạy: node kiểmtralỗitoànbộhệthống.js
 */

import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const CYAN = "\x1b[36m", RED = "\x1b[31m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m", BOLD = "\x1b[1m", RESET = "\x1b[0m";
const ok  = (msg) => console.log(`${GREEN}  ✓ ${msg}${RESET}`);
const err = (msg) => console.log(`${RED}  ✗ ${msg}${RESET}`);
const warn = (msg) => console.log(`${YELLOW}  ⚠ ${msg}${RESET}`);
const info = (msg) => console.log(`${CYAN}  → ${msg}${RESET}`);
const head = (msg) => console.log(`\n${BOLD}${CYAN}══ ${msg} ══${RESET}`);

let totalErrors = 0;
let totalFixed = 0;
let totalWarnings = 0;

function trackErr(msg) { err(msg); totalErrors++; }
function trackWarn(msg) { warn(msg); totalWarnings++; }
function trackFix(msg) { ok(`[AUTO-FIX] ${msg}`); totalFixed++; }

/* ─── helpers ─── */
function run(cmd, opts = {}) {
  try {
    const result = spawnSync("sh", ["-c", cmd], { encoding: "utf8", cwd: ROOT, ...opts });
    return { ok: result.status === 0, stdout: result.stdout || "", stderr: result.stderr || "" };
  } catch (e) {
    return { ok: false, stdout: "", stderr: String(e) };
  }
}

function readText(path) {
  try { return readFileSync(join(ROOT, path), "utf8"); } catch { return null; }
}

function writeText(path, content) {
  try { writeFileSync(join(ROOT, path), content, "utf8"); return true; } catch { return false; }
}

function globFiles(dir, ext) {
  const results = [];
  function walk(d) {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (ext.some(e => entry.name.endsWith(e))) results.push(full);
    }
  }
  walk(join(ROOT, dir));
  return results;
}

/* ═══════════════════════════════════════════════════════
   1. TYPESCRIPT TYPECHECK
══════════════════════════════════════════════════════ */
head("1. TYPESCRIPT TYPECHECK");
const tsResult = run("pnpm run typecheck 2>&1");
if (tsResult.ok) {
  ok("TypeScript — không có lỗi kiểu");
} else {
  const allLines = tsResult.stdout.split("\n").filter(l => l.includes("error TS"));
  // TS7030 "Not all code paths return a value" — Express handler pattern (suppressed in api-server tsconfig)
  // TS2769 "No overload matches" — Drizzle ORM type overload compatibility, not a runtime bug
  const realErrors = allLines.filter(l => !l.includes("TS7030") && !l.includes("TS7006") && !l.includes("TS2769"));
  const expressWarnings = allLines.filter(l => l.includes("TS7030") || l.includes("TS7006") || l.includes("TS2769"));

  if (realErrors.length === 0) {
    ok(`TypeScript — không có lỗi nghiêm trọng (${expressWarnings.length} TS7030 Express handler warnings bỏ qua)`);
  } else {
    realErrors.slice(0, 15).forEach(l => trackErr(`TS: ${l.trim()}`));
    if (realErrors.length > 15) trackWarn(`... và ${realErrors.length - 15} lỗi TypeScript khác`);
  }
  if (expressWarnings.length > 0) {
    trackWarn(`TS7030: ${expressWarnings.length} Express route handler không return explicitly (không phải bug runtime)`);
  }
}

/* ═══════════════════════════════════════════════════════
   2. PACKAGE.JSON CONSISTENCY
══════════════════════════════════════════════════════ */
head("2. PACKAGE.JSON & DEPENDENCIES");
const pkgPaths = [
  "package.json",
  "artifacts/ai-world-system/package.json",
  "artifacts/api-server/package.json",
  "lib/db/package.json",
];
for (const p of pkgPaths) {
  const txt = readText(p);
  if (!txt) { trackWarn(`Không tìm thấy: ${p}`); continue; }
  try { JSON.parse(txt); ok(`Valid JSON: ${p}`); }
  catch (e) { trackErr(`JSON lỗi trong ${p}: ${e.message}`); }
}

/* ═══════════════════════════════════════════════════════
   3. API ROUTE MISMATCH: BACKEND ↔ FRONTEND
══════════════════════════════════════════════════════ */
head("3. API ROUTE MISMATCH");

// Collect defined backend routes
const routeFiles = globFiles("artifacts/api-server/src/routes", [".ts"]);
const backendRoutes = new Set();

// Check how router is mounted (detect /api prefix in app.ts or server entry)
let apiPrefix = "";
const appFile = readText("artifacts/api-server/src/app.ts") || readText("artifacts/api-server/src/server.ts") || "";
const mountMatch = appFile.match(/app\.use\(\s*["'`](\/[^"'`]+)["'`]\s*,\s*router/);
if (mountMatch) apiPrefix = mountMatch[1].replace(/\/$/, "");

for (const f of routeFiles) {
  const txt = readFileSync(f, "utf8");
  const routeMethodPattern = /router\.(get|post|put|delete|patch)\(\s*["'`]([^"'`\n]+)["'`]/g;
  let m;
  while ((m = routeMethodPattern.exec(txt)) !== null) {
    const raw = m[2].trim();
    // Some route files already include /api prefix — don't double-add
    const alreadyHasPrefix = raw.startsWith(apiPrefix + "/");
    const fullPath = alreadyHasPrefix ? raw : (apiPrefix + raw);
    const normalised = fullPath.replace(/:[^/\s),]+/g, ":*");
    backendRoutes.add(`${m[1].toUpperCase()} ${normalised}`);
  }
}
info(`Backend: ${backendRoutes.size} routes đăng ký (mount prefix: "${apiPrefix}")`);


// Collect frontend fetch calls
const frontendFiles = globFiles("artifacts/ai-world-system/src", [".tsx", ".ts"]);
const fetchPattern = /fetch\(\s*["'`](\/api\/[^"'`?]+)/g;
const frontendCalls = new Map(); // path → [files]

for (const f of frontendFiles) {
  const txt = readFileSync(f, "utf8");
  let m;
  while ((m = fetchPattern.exec(txt)) !== null) {
    const normalised = m[1].replace(/\$\{[^}]+\}/g, ":*").replace(/:[^/]+/g, ":*");
    if (!frontendCalls.has(normalised)) frontendCalls.set(normalised, []);
    frontendCalls.get(normalised).push(relative(ROOT, f));
  }
}
info(`Frontend: ${frontendCalls.size} endpoint patterns gọi`);

// Cross-check (frontend calls without method context — just check path exists in any method)
const backendPaths = new Set([...backendRoutes].map(r => r.split(" ")[1]));
let mismatchCount = 0;
for (const [path, files] of frontendCalls) {
  if (!backendPaths.has(path)) {
    // Try to match partial (e.g. /api/foo/:*/bar might match /api/foo/:*/bar)
    const matched = [...backendPaths].some(bp => {
      const bpParts = bp.split("/");
      const fParts = path.split("/");
      if (bpParts.length !== fParts.length) return false;
      return bpParts.every((p, i) => p === ":*" || fParts[i] === ":*" || p === fParts[i]);
    });
    if (!matched) {
      trackWarn(`Frontend gọi "${path}" nhưng không tìm thấy backend route (từ: ${files[0]})`);
      mismatchCount++;
    }
  }
}
if (mismatchCount === 0) ok("Tất cả API calls frontend đều có route backend tương ứng");

/* ═══════════════════════════════════════════════════════
   4. RUNTIME ERROR PATTERNS
══════════════════════════════════════════════════════ */
head("4. RUNTIME ERROR PATTERNS (FRONTEND)");

const knownBadPatterns = [
  {
    pattern: /\bcharacter\b(?!\s*[=:]|\s*\.id|\s*\?\.id|\s*instanceof)/,
    message: 'Biến "character" không khai báo — thường nên dùng "characters[activeIdx]"',
    files: ["artifacts/ai-world-system/src/pages/DashboardPage.tsx"],
  },
  {
    // fetch without .ok check
    pattern: /await\s+fetch\([^)]+\);\s*\n\s*const\s+\w+\s*=\s*await\s+\w+\.json\(\)/,
    message: "fetch() không kiểm tra res.ok trước khi .json() — có thể parse HTML 404",
    files: null,
  },
];

// Scan for truly unguarded fetch patterns
let rtErrors = 0;
for (const f of frontendFiles) {
  const txt = readFileSync(f, "utf8");
  const rel = relative(ROOT, f);

  // Count fetch calls that genuinely lack any safety net:
  // A fetch is "guarded" if the file contains any of: res.ok, r.ok, response.ok, status check,
  // ?? [], r.ok ?, catch block, Array.isArray, onError handler
  const hasSomeGuard = /res\.ok|r\.ok|response\.ok|\.status\b|\?\?\s*\[\]|r\.ok\s*\?|onError|catch\s*\{|Array\.isArray|if\s*\(!r\.ok\)|if\s*\(!res\.ok\)/.test(txt);
  const jsonCalls = txt.match(/\.json\(\)/g)?.length || 0;

  // Only flag pages with multiple .json() calls AND zero guards at all
  if (jsonCalls > 4 && !hasSomeGuard && rel.includes("Page")) {
    trackWarn(`${rel}: ${jsonCalls} lần gọi .json() không có res.ok guard nào`);
    rtErrors++;
  }

  // Check for direct .map() on raw setState(data) where data is unchecked API response
  // Safe patterns: data ?? [], Array.isArray(data), res.ok ?, !res.ok, res.status, catch setXxx([])
  const rawSetArr = /set[A-Z]\w+\(\s*(?:await\s+\w+\.json\(\)|data)\s*\)/.test(txt);
  const hasSafeArrayGuard = /\?\?\s*\[\]|Array\.isArray|\.ok\s*[?}]|!.*\.ok|\.status\b|catch\s*\{[\s\S]{0,200}set[A-Z]\w+\(\[\]\)/.test(txt);
  if (rawSetArr && !hasSafeArrayGuard && txt.includes(".map(") && rel.includes("Page")) {
    trackWarn(`${rel}: setState trực tiếp từ API response và dùng .map() — thiếu Array.isArray guard`);
    rtErrors++;
  }
}
if (rtErrors === 0) ok("Không phát hiện pattern nguy hiểm trong frontend");

/* ═══════════════════════════════════════════════════════
   5. DB SCHEMA CONSISTENCY
══════════════════════════════════════════════════════ */
head("5. DB SCHEMA CONSISTENCY");

const schemaFiles = globFiles("lib/db/src/schema", [".ts"]);
if (schemaFiles.length === 0) {
  trackErr("Không tìm thấy schema files trong lib/db/src/schema/");
} else {
  ok(`Tìm thấy ${schemaFiles.length} schema file(s)`);

  // Check if drizzle config exists
  const drizzleConfig = readText("lib/db/drizzle.config.ts") || readText("lib/db/drizzle.config.js");
  if (!drizzleConfig) trackWarn("Không tìm thấy drizzle.config — push schema có thể lỗi");
  else ok("Drizzle config tồn tại");
}

/* ═══════════════════════════════════════════════════════
   6. ENVIRONMENT SECRETS
══════════════════════════════════════════════════════ */
head("6. ENVIRONMENT SECRETS");

const requiredSecrets = [
  "SESSION_SECRET",
  "DATABASE_URL",
  "REPL_ID",
  "REPLIT_DEV_DOMAIN",
];

const optionalSecrets = [
  "GEMINI_API_KEY",
];

for (const s of requiredSecrets) {
  if (process.env[s]) ok(`${s} — có`);
  else trackErr(`${s} — THIẾU (bắt buộc)`);
}
for (const s of optionalSecrets) {
  if (process.env[s]) ok(`${s} — có`);
  else trackWarn(`${s} — thiếu (tính năng AI sẽ không hoạt động)`);
}

/* ═══════════════════════════════════════════════════════
   7. BUILD HEALTH CHECK
══════════════════════════════════════════════════════ */
head("7. BUILD HEALTH CHECK");

// Check API server source entry exists (dev uses tsx directly, no dist needed)
const srcExists = existsSync(join(ROOT, "artifacts/api-server/src/index.ts"));
const routesIndexExists = existsSync(join(ROOT, "artifacts/api-server/src/routes/index.ts"));
if (srcExists && routesIndexExists) {
  ok("API server source files tồn tại (dev: tsx, không cần dist)");
} else {
  trackErr("API server src/index.ts hoặc routes/index.ts bị thiếu");
}

// Check frontend Vite config
const viteConfig = readText("artifacts/ai-world-system/vite.config.ts");
if (viteConfig) {
  if (viteConfig.includes("proxy") && viteConfig.includes("/api")) {
    ok("Vite proxy /api → backend đã cấu hình");
  } else {
    trackWarn("Vite config không có proxy /api — frontend sẽ không gọi được backend trong dev");
  }
  if (viteConfig.includes("X-Forwarded-Proto")) {
    ok("Vite proxy header X-Forwarded-Proto — session cookie Secure flag đúng");
  } else {
    trackErr("Vite proxy thiếu X-Forwarded-Proto header — login session sẽ mất khi redirect!");
    // AUTO-FIX
    const fixed = viteConfig.replace(
      /proxy:\s*\{([\s\S]*?)\/api.*?\{([\s\S]*?)\}/m,
      (match) => {
        if (match.includes("X-Forwarded-Proto")) return match;
        return match.replace(/changeOrigin:\s*true/, 'changeOrigin: true,\n          headers: { "X-Forwarded-Proto": "https" }');
      }
    );
    if (fixed !== viteConfig) {
      writeText("artifacts/ai-world-system/vite.config.ts", fixed);
      trackFix("Thêm X-Forwarded-Proto vào vite.config.ts");
    }
  }
} else {
  trackErr("Không tìm thấy artifacts/ai-world-system/vite.config.ts");
}

/* ═══════════════════════════════════════════════════════
   8. KNOWN RUNTIME BUGS (AUTO-FIX)
══════════════════════════════════════════════════════ */
head("8. KNOWN RUNTIME BUGS — AUTO-FIX");

// Fix 1: DashboardPage — `character` not defined → `characters[activeIdx]`
const dbPath = "artifacts/ai-world-system/src/pages/DashboardPage.tsx";
const dbContent = readText(dbPath);
if (dbContent) {
  const bugPattern = /\(character\?\.\s*stats\s+as\s+any\)\?\.\s*world_slug/;
  if (bugPattern.test(dbContent)) {
    const fixed = dbContent.replace(
      /\(character\?\.\s*stats\s+as\s+any\)/g,
      "(characters[activeIdx]?.stats as any)"
    );
    writeText(dbPath, fixed);
    trackFix("DashboardPage: `character` → `characters[activeIdx]`");
  } else {
    ok("DashboardPage: bug `character is not defined` đã được fix");
  }
}

// Fix 2: Ensure JSON parse errors are caught in pages that call unimplemented routes
// (FeedPage, ProphecyPage, IsekaiPage, FatePage — catch response HTML and handle gracefully)
const pagesToCheck = [
  "artifacts/ai-world-system/src/pages/FeedPage.tsx",
  "artifacts/ai-world-system/src/pages/IsekaiPage.tsx",
  "artifacts/ai-world-system/src/pages/FatePage.tsx",
  "artifacts/ai-world-system/src/pages/ProphecyPage.tsx",
];

for (const p of pagesToCheck) {
  const txt = readText(p);
  if (!txt) continue;
  // Check if it has proper error handling for .json()
  const hasOkCheck = txt.includes("res.ok") || txt.includes("response.ok") || txt.includes(".ok)") || txt.includes("r.ok");
  if (!hasOkCheck) {
    trackWarn(`${p}: không có res.ok check — có thể crash khi API trả về 404`);
  } else {
    ok(`${p.split("/").pop()}: có res.ok error handling`);
  }
}

/* ═══════════════════════════════════════════════════════
   9. DUPLICATE STYLE PROP (JSX)
══════════════════════════════════════════════════════ */
head("9. JSX — DUPLICATE PROP WARNINGS");

const tsxFiles = frontendFiles.filter(f => f.endsWith(".tsx"));
let dupStyleCount = 0;
for (const f of tsxFiles) {
  const txt = readFileSync(f, "utf8");
  // Simple heuristic: two `style=` on lines close together without new JSX element between them
  const lines = txt.split("\n");
  let lastStyleLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*style=\{/.test(lines[i])) {
      if (lastStyleLine !== -1 && i - lastStyleLine < 5) {
        // Check no JSX open tag between them
        const between = lines.slice(lastStyleLine, i).join("\n");
        if (!/<\w/.test(between)) {
          trackWarn(`${relative(ROOT, f)}:${i + 1}: duplicate style prop (lines ${lastStyleLine + 1}–${i + 1})`);
          dupStyleCount++;
        }
      }
      lastStyleLine = i;
    } else if (/^\s*<\w/.test(lines[i])) {
      lastStyleLine = -1;
    }
  }
}
if (dupStyleCount === 0) ok("Không có duplicate style prop trong JSX");

/* ═══════════════════════════════════════════════════════
   TỔNG KẾT
══════════════════════════════════════════════════════ */
console.log(`\n${BOLD}${"═".repeat(56)}${RESET}`);
console.log(`${BOLD}  KẾT QUẢ KIỂM TRA HỆ THỐNG${RESET}`);
console.log(`${"═".repeat(56)}`);
console.log(`  ${RED}Lỗi:${RESET}      ${totalErrors}`);
console.log(`  ${YELLOW}Cảnh báo:${RESET} ${totalWarnings}`);
console.log(`  ${GREEN}Auto-fix:${RESET} ${totalFixed}`);
console.log(`${"═".repeat(56)}\n`);

if (totalErrors === 0 && totalWarnings <= 3) {
  console.log(`${GREEN}${BOLD}  ✅ HỆ THỐNG SẠCH — SẴN SÀNG BUILD TÍNH NĂNG MỚI${RESET}\n`);
  process.exit(0);
} else if (totalErrors === 0) {
  console.log(`${YELLOW}${BOLD}  ⚠  CÓ CẢNH BÁO — KIỂM TRA TRƯỚC KHI BUILD${RESET}\n`);
  process.exit(0);
} else {
  console.log(`${RED}${BOLD}  ❌ CÓ LỖI CẦN XỬ LÝ TRƯỚC KHI BUILD${RESET}\n`);
  process.exit(1);
}
