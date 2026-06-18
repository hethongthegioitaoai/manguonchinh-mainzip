/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          BẢO MẬT VÀ CHỐNG HACK HỆ THỐNG — AI WORLD SYSTEM          ║
 * ║          Multi-Layer Security & Anti-Attack Middleware Suite         ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Cách dùng trong Express app:
 *   const security = require('./BẢOMẬTVÀCHỐNGHACKHỆTHỐNG.JS');
 *   security.applyAll(app);          // áp dụng toàn bộ tầng bảo mật
 *   security.applyLayer(app, 'rate-limit');  // áp dụng từng tầng riêng
 *
 * Các tầng bảo mật (theo thứ tự ưu tiên):
 *   Layer 1  — Security Headers (CORS, CSP, HSTS, X-Frame, etc.)
 *   Layer 2  — Rate Limiting (global + per-endpoint)
 *   Layer 3  — Brute-Force Protection (login throttle)
 *   Layer 4  — SQL Injection Detection & Block
 *   Layer 5  — XSS & Script Injection Filter
 *   Layer 6  — Path Traversal Guard
 *   Layer 7  — Request Size & Body Validator
 *   Layer 8  — IP Blacklist & Suspicious Origin Block
 *   Layer 9  — Honeypot Trap (auto-ban scanners)
 *   Layer 10 — Session Integrity Validator
 *   Layer 11 — Payload Anomaly Detector
 *   Layer 12 — Security Event Logger & Alerting
 */

"use strict";
const crypto = require("crypto");

/* ─────────────────────────────────────────────────────────────
   CẤU HÌNH TOÀN CỤC
───────────────────────────────────────────────────────────── */
const CONFIG = {
  rateLimitWindowMs:   15 * 60 * 1000,  // 15 phút
  rateLimitMax:        200,              // requests tối đa / window
  loginLimitMax:       10,               // login attempts tối đa / 15 phút
  requestMaxBodyBytes: 10 * 1024 * 1024, // 10 MB
  banDurationMs:       60 * 60 * 1000,  // 1 giờ ban sau honeypot
  suspiciousThreshold: 5,               // số lần vi phạm trước khi ban IP
  logToConsole:        true,
  blockMode:           true,            // true = block, false = log only
};

/* ─────────────────────────────────────────────────────────────
   STORAGE IN-MEMORY (thay bằng Redis cho production scale)
───────────────────────────────────────────────────────────── */
const store = {
  rateLimit:  new Map(), // ip → { count, resetAt }
  loginLimit: new Map(), // ip → { count, resetAt }
  banned:     new Map(), // ip → bannedUntil timestamp
  violations: new Map(), // ip → violation count
  honeypotHits: new Set(), // ips đã vào honeypot
};

/* ─────────────────────────────────────────────────────────────
   LAYER 12 — SECURITY EVENT LOGGER
───────────────────────────────────────────────────────────── */
const events = [];
function logEvent(type, ip, detail, req) {
  const entry = {
    time:      new Date().toISOString(),
    type,
    ip,
    url:       req ? req.originalUrl : null,
    method:    req ? req.method : null,
    userAgent: req ? req.headers["user-agent"] : null,
    detail,
  };
  events.push(entry);
  if (events.length > 1000) events.shift(); // giữ 1000 entry gần nhất
  if (CONFIG.logToConsole) {
    console.warn(`[SECURITY][${type}] ${ip} — ${detail}`);
  }
}

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function addViolation(ip, req, reason) {
  const count = (store.violations.get(ip) ?? 0) + 1;
  store.violations.set(ip, count);
  logEvent("VIOLATION", ip, `${reason} [#${count}]`, req);
  if (count >= CONFIG.suspiciousThreshold) {
    store.banned.set(ip, Date.now() + CONFIG.banDurationMs);
    logEvent("AUTO_BAN", ip, `Banned after ${count} violations`, req);
  }
}

function isBanned(ip) {
  const until = store.banned.get(ip);
  if (!until) return false;
  if (Date.now() > until) { store.banned.delete(ip); return false; }
  return true;
}

/* ─────────────────────────────────────────────────────────────
   LAYER 1 — SECURITY HEADERS
───────────────────────────────────────────────────────────── */
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options",  "nosniff");
  res.setHeader("X-Frame-Options",          "SAMEORIGIN");
  res.setHeader("X-XSS-Protection",         "1; mode=block");
  res.setHeader("Referrer-Policy",           "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy",        "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy",   "same-origin");
  res.setHeader("Strict-Transport-Security",     "max-age=31536000; includeSubDomains; preload");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' wss: https:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
    ].join("; ")
  );
  // Xóa header lộ thông tin server
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");
  next();
}

/* ─────────────────────────────────────────────────────────────
   LAYER 2 — RATE LIMITING (global)
───────────────────────────────────────────────────────────── */
function rateLimitMiddleware(req, res, next) {
  const ip  = getClientIP(req);
  const now = Date.now();
  const rec = store.rateLimit.get(ip);

  if (!rec || now > rec.resetAt) {
    store.rateLimit.set(ip, { count: 1, resetAt: now + CONFIG.rateLimitWindowMs });
    return next();
  }
  rec.count++;
  if (rec.count > CONFIG.rateLimitMax) {
    addViolation(ip, req, "Rate limit exceeded");
    if (CONFIG.blockMode) {
      res.setHeader("Retry-After", Math.ceil((rec.resetAt - now) / 1000));
      return res.status(429).json({
        error: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
        retryAfter: Math.ceil((rec.resetAt - now) / 1000),
      });
    }
  }
  next();
}

/* ─────────────────────────────────────────────────────────────
   LAYER 3 — BRUTE FORCE PROTECTION (login endpoints)
───────────────────────────────────────────────────────────── */
function bruteForceProtection(req, res, next) {
  const loginPaths = ["/api/auth", "/api/login", "/login", "/auth"];
  const isLogin    = loginPaths.some(p => req.path.startsWith(p));
  if (!isLogin || req.method !== "POST") return next();

  const ip  = getClientIP(req);
  const now = Date.now();
  const rec = store.loginLimit.get(ip);

  if (!rec || now > rec.resetAt) {
    store.loginLimit.set(ip, { count: 1, resetAt: now + CONFIG.rateLimitWindowMs });
    return next();
  }
  rec.count++;
  if (rec.count > CONFIG.loginLimitMax) {
    addViolation(ip, req, "Brute-force login attempt");
    if (CONFIG.blockMode) {
      return res.status(429).json({ error: "Quá nhiều lần đăng nhập thất bại. Tài khoản bị khóa tạm thời." });
    }
  }
  next();
}

/* ─────────────────────────────────────────────────────────────
   LAYER 4 — SQL INJECTION DETECTION
───────────────────────────────────────────────────────────── */
const SQL_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION|CAST)\b)/i,
  /(-{2}|\/\*|\*\/|;\s*(DROP|SELECT|INSERT|UPDATE|DELETE))/i,
  /('\s*(OR|AND)\s*'?\d*\s*[=<>!])/i,
  /(xp_cmdshell|sp_executesql|INFORMATION_SCHEMA|sys\.tables)/i,
  /(\bOR\b\s+\d+\s*=\s*\d+|\bAND\b\s+\d+\s*=\s*\d+)/i,
  /(SLEEP\s*\(|BENCHMARK\s*\(|WAITFOR\s+DELAY)/i,
  /(\bLOAD_FILE\b|\bINTO\s+OUTFILE\b|\bINTO\s+DUMPFILE\b)/i,
];

function scanForSQL(value) {
  if (typeof value !== "string") return false;
  return SQL_PATTERNS.some(p => p.test(value));
}

function deepScan(obj, depth = 0) {
  if (depth > 5) return false;
  if (typeof obj === "string") return scanForSQL(obj);
  if (Array.isArray(obj)) return obj.some(v => deepScan(v, depth + 1));
  if (obj && typeof obj === "object") return Object.values(obj).some(v => deepScan(v, depth + 1));
  return false;
}

function sqlInjectionGuard(req, res, next) {
  const targets = [req.body, req.query, req.params];
  const found   = targets.some(t => deepScan(t));
  if (found) {
    const ip = getClientIP(req);
    addViolation(ip, req, "SQL Injection attempt detected");
    if (CONFIG.blockMode) {
      return res.status(400).json({ error: "Yêu cầu chứa dữ liệu không hợp lệ." });
    }
  }
  next();
}

/* ─────────────────────────────────────────────────────────────
   LAYER 5 — XSS & SCRIPT INJECTION FILTER
───────────────────────────────────────────────────────────── */
const XSS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=\s*["']?[^"']*["']?/gi,
  /<\s*(iframe|object|embed|applet|meta|link)\s/gi,
  /expression\s*\(/gi,
  /vbscript\s*:/gi,
  /data\s*:\s*text\/html/gi,
  /&#x?[0-9a-f]+;/gi,
];

function scanForXSS(value) {
  if (typeof value !== "string") return false;
  return XSS_PATTERNS.some(p => p.test(value));
}

function deepXSSScan(obj, depth = 0) {
  if (depth > 5) return false;
  if (typeof obj === "string") return scanForXSS(obj);
  if (Array.isArray(obj)) return obj.some(v => deepXSSScan(v, depth + 1));
  if (obj && typeof obj === "object") return Object.values(obj).some(v => deepXSSScan(v, depth + 1));
  return false;
}

function xssGuard(req, res, next) {
  const targets = [req.body, req.query];
  const found   = targets.some(t => deepXSSScan(t));
  if (found) {
    const ip = getClientIP(req);
    addViolation(ip, req, "XSS/Script injection attempt detected");
    if (CONFIG.blockMode) {
      return res.status(400).json({ error: "Dữ liệu chứa nội dung không được phép." });
    }
  }
  next();
}

/* ─────────────────────────────────────────────────────────────
   LAYER 6 — PATH TRAVERSAL GUARD
───────────────────────────────────────────────────────────── */
const PATH_TRAVERSAL = [
  /\.\.[\/\\]/,
  /\.\.[\/\\].*\.\.[\/\\]/,
  /%2e%2e[%2f%5c]/gi,
  /etc\/passwd/i,
  /etc\/shadow/i,
  /proc\/self/i,
  /windows\/system32/i,
  /\.env$/i,
  /\.git\//i,
];

function pathTraversalGuard(req, res, next) {
  const url = decodeURIComponent(req.originalUrl || req.url || "");
  const found = PATH_TRAVERSAL.some(p => p.test(url));
  if (found) {
    const ip = getClientIP(req);
    addViolation(ip, req, `Path traversal attempt: ${url}`);
    if (CONFIG.blockMode) {
      return res.status(403).json({ error: "Truy cập bị từ chối." });
    }
  }
  next();
}

/* ─────────────────────────────────────────────────────────────
   LAYER 7 — REQUEST SIZE & BODY VALIDATOR
───────────────────────────────────────────────────────────── */
function requestSizeGuard(req, res, next) {
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLength > CONFIG.requestMaxBodyBytes) {
    const ip = getClientIP(req);
    addViolation(ip, req, `Oversized request: ${contentLength} bytes`);
    if (CONFIG.blockMode) {
      return res.status(413).json({ error: "Kích thước yêu cầu vượt quá giới hạn cho phép." });
    }
  }
  next();
}

/* ─────────────────────────────────────────────────────────────
   LAYER 8 — IP BLACKLIST & SUSPICIOUS ORIGIN BLOCK
───────────────────────────────────────────────────────────── */
const BLACKLISTED_IPS = new Set([
  // Thêm IP cần block thủ công tại đây
  // "1.2.3.4",
]);

const SUSPICIOUS_USER_AGENTS = [
  /sqlmap/i, /nmap/i, /nikto/i, /masscan/i, /zgrab/i, /dirbuster/i,
  /nuclei/i, /burpsuite/i, /nessus/i, /openvas/i, /metasploit/i,
  /hydra/i, /medusa/i, /wpscan/i, /acunetix/i, /appscan/i,
  /python-requests\/[0-9]/i, /go-http-client/i, /libwww-perl/i,
  /curl\/[0-9]/i, /wget\/[0-9]/i,
];

function ipAndUAGuard(req, res, next) {
  const ip = getClientIP(req);
  const ua = req.headers["user-agent"] || "";

  if (BLACKLISTED_IPS.has(ip) || isBanned(ip)) {
    logEvent("BLOCKED_IP", ip, "IP is blacklisted or banned", req);
    return res.status(403).json({ error: "Truy cập bị từ chối." });
  }

  const suspiciousUA = SUSPICIOUS_USER_AGENTS.some(p => p.test(ua));
  if (suspiciousUA) {
    addViolation(ip, req, `Suspicious user agent: ${ua.slice(0, 80)}`);
    if (CONFIG.blockMode) {
      return res.status(403).json({ error: "Truy cập bị từ chối." });
    }
  }
  next();
}

function banIP(ip, reason) {
  BLACKLISTED_IPS.add(ip);
  logEvent("MANUAL_BAN", ip, reason || "Manual ban", null);
}

function unbanIP(ip) {
  BLACKLISTED_IPS.delete(ip);
  store.banned.delete(ip);
  store.violations.delete(ip);
}

/* ─────────────────────────────────────────────────────────────
   LAYER 9 — HONEYPOT TRAP
───────────────────────────────────────────────────────────── */
const HONEYPOT_PATHS = [
  "/admin.php", "/.env", "/wp-admin", "/wp-login.php", "/phpmyadmin",
  "/config.php", "/.git/config", "/backup.sql", "/dump.sql",
  "/server-status", "/xmlrpc.php", "/actuator", "/.aws/credentials",
  "/api/v1/admin/secret", "/.htaccess", "/web.config",
];

function honeypotMiddleware(req, res, next) {
  const path = req.path.toLowerCase();
  const isHoneypot = HONEYPOT_PATHS.some(p => path === p || path.startsWith(p));
  if (isHoneypot) {
    const ip = getClientIP(req);
    store.honeypotHits.add(ip);
    store.banned.set(ip, Date.now() + CONFIG.banDurationMs);
    logEvent("HONEYPOT_TRIGGERED", ip, `Path: ${req.path}`, req);
    return res.status(404).json({ error: "Not found." });
  }
  next();
}

/* ─────────────────────────────────────────────────────────────
   LAYER 10 — SESSION INTEGRITY VALIDATOR
───────────────────────────────────────────────────────────── */
function sessionIntegrityCheck(req, res, next) {
  if (!req.session) return next();
  const ip = getClientIP(req);
  const ua = req.headers["user-agent"] || "";

  // Bind session to IP + UA fingerprint hash
  const fingerprint = crypto
    .createHash("sha256")
    .update(ip + ua)
    .digest("hex")
    .slice(0, 16);

  if (!req.session._fp) {
    req.session._fp = fingerprint;
  } else if (req.session._fp !== fingerprint && req.session.userId) {
    logEvent("SESSION_HIJACK_ATTEMPT", ip, "Session fingerprint mismatch", req);
    req.session.destroy(() => {});
    if (CONFIG.blockMode) {
      return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." });
    }
  }
  next();
}

/* ─────────────────────────────────────────────────────────────
   LAYER 11 — PAYLOAD ANOMALY DETECTOR
───────────────────────────────────────────────────────────── */
const ANOMALY_PATTERNS = [
  /\$\{[^}]*\}/,       // Template injection ${...}
  /\{\{[^}]*\}\}/,     // Template injection {{...}}
  /\$\([^)]*\)/,       // Command substitution $(...)
  /`[^`]*`/,           // Backtick command execution
  /\|\s*(nc|bash|sh|cmd|powershell)/i, // Pipe to shell
  /;\s*(cat|ls|pwd|id|whoami|uname)/i, // Command chain
  /(eval|exec|system|passthru|shell_exec|popen)\s*\(/i, // Code execution
  /base64_decode\s*\(/i,
  /\\\x[0-9a-f]{2}/i,  // Hex encoding
];

function payloadAnomalyDetector(req, res, next) {
  const checkString = str => ANOMALY_PATTERNS.some(p => p.test(str));
  const deepCheck = obj => {
    if (typeof obj === "string") return checkString(obj);
    if (Array.isArray(obj)) return obj.some(deepCheck);
    if (obj && typeof obj === "object") return Object.values(obj).some(deepCheck);
    return false;
  };

  if (deepCheck(req.body) || deepCheck(req.query)) {
    const ip = getClientIP(req);
    addViolation(ip, req, "Payload anomaly / injection attempt");
    if (CONFIG.blockMode) {
      return res.status(400).json({ error: "Dữ liệu không hợp lệ." });
    }
  }
  next();
}

/* ─────────────────────────────────────────────────────────────
   HELPER: INPUT SANITIZER (dùng trong routes)
───────────────────────────────────────────────────────────── */
function sanitize(input) {
  if (typeof input !== "string") return input;
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();
}

function sanitizeObject(obj) {
  if (typeof obj === "string") return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === "object") {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) clean[k] = sanitizeObject(v);
    return clean;
  }
  return obj;
}

/* ─────────────────────────────────────────────────────────────
   CRYPTOGRAPHIC UTILITIES
───────────────────────────────────────────────────────────── */
const CRYPTO_UTILS = {
  hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return { hash, salt, full: `${salt}:${hash}` };
  },

  verifyPassword(password, stored) {
    const [salt, hash] = stored.split(":");
    const attempt = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
  },

  generateToken(length = 32) {
    return crypto.randomBytes(length).toString("hex");
  },

  generateCSRFToken() {
    return crypto.randomBytes(32).toString("base64url");
  },

  hashData(data, algorithm = "sha256") {
    return crypto.createHash(algorithm).update(JSON.stringify(data)).digest("hex");
  },

  encryptAES(plaintext, key) {
    const keyBuf = crypto.createHash("sha256").update(key).digest();
    const iv     = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", keyBuf, iv);
    const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return iv.toString("hex") + ":" + enc.toString("hex");
  },

  decryptAES(ciphertext, key) {
    const [ivHex, encHex] = ciphertext.split(":");
    const keyBuf = crypto.createHash("sha256").update(key).digest();
    const iv     = Buffer.from(ivHex, "hex");
    const enc    = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuf, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  },
};

/* ─────────────────────────────────────────────────────────────
   ADMIN API — xem security stats
───────────────────────────────────────────────────────────── */
function securityAdminRouter() {
  const express = require("express");
  const r = express.Router();

  r.get("/api/__security/stats", (req, res) => {
    const adminToken = req.headers["x-admin-token"];
    if (!adminToken || adminToken !== process.env.SECURITY_ADMIN_TOKEN) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    res.json({
      banned:      Array.from(store.banned.entries()).map(([ip, until]) => ({ ip, until: new Date(until) })),
      violations:  Array.from(store.violations.entries()).map(([ip, c]) => ({ ip, count: c })),
      honeypotHits: Array.from(store.honeypotHits),
      recentEvents: events.slice(-50),
      rateLimitActive: store.rateLimit.size,
    });
  });

  r.post("/api/__security/ban", (req, res) => {
    const adminToken = req.headers["x-admin-token"];
    if (!adminToken || adminToken !== process.env.SECURITY_ADMIN_TOKEN) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const { ip, reason } = req.body;
    banIP(ip, reason);
    res.json({ ok: true, banned: ip });
  });

  r.post("/api/__security/unban", (req, res) => {
    const adminToken = req.headers["x-admin-token"];
    if (!adminToken || adminToken !== process.env.SECURITY_ADMIN_TOKEN) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    const { ip } = req.body;
    unbanIP(ip);
    res.json({ ok: true, unbanned: ip });
  });

  return r;
}

/* ─────────────────────────────────────────────────────────────
   APPLY ALL LAYERS
───────────────────────────────────────────────────────────── */
function applyAll(app) {
  console.log("[SECURITY] Áp dụng hệ thống bảo mật 12 tầng...");
  app.use(securityHeaders);        // Layer 1
  app.use(ipAndUAGuard);           // Layer 8 (sớm để block bad actors nhanh)
  app.use(honeypotMiddleware);     // Layer 9
  app.use(requestSizeGuard);       // Layer 7
  app.use(rateLimitMiddleware);    // Layer 2
  app.use(bruteForceProtection);   // Layer 3
  app.use(pathTraversalGuard);     // Layer 6
  app.use(sqlInjectionGuard);      // Layer 4
  app.use(xssGuard);               // Layer 5
  app.use(payloadAnomalyDetector); // Layer 11
  app.use(sessionIntegrityCheck);  // Layer 10
  app.use(securityAdminRouter());  // Layer 12 admin API
  console.log("[SECURITY] ✅ 12 tầng bảo mật đã kích hoạt");
}

function applyLayer(app, layer) {
  const map = {
    "headers":        securityHeaders,
    "rate-limit":     rateLimitMiddleware,
    "brute-force":    bruteForceProtection,
    "sql-injection":  sqlInjectionGuard,
    "xss":            xssGuard,
    "path-traversal": pathTraversalGuard,
    "size-guard":     requestSizeGuard,
    "ip-guard":       ipAndUAGuard,
    "honeypot":       honeypotMiddleware,
    "session":        sessionIntegrityCheck,
    "anomaly":        payloadAnomalyDetector,
  };
  const mw = map[layer];
  if (!mw) throw new Error(`Không tìm thấy layer: ${layer}. Các layer hợp lệ: ${Object.keys(map).join(", ")}`);
  app.use(mw);
}

module.exports = {
  applyAll,
  applyLayer,
  securityHeaders,
  rateLimitMiddleware,
  bruteForceProtection,
  sqlInjectionGuard,
  xssGuard,
  pathTraversalGuard,
  requestSizeGuard,
  ipAndUAGuard,
  honeypotMiddleware,
  sessionIntegrityCheck,
  payloadAnomalyDetector,
  securityAdminRouter,
  sanitize,
  sanitizeObject,
  crypto: CRYPTO_UTILS,
  banIP,
  unbanIP,
  getSecurityEvents: () => [...events],
  getStore:          () => ({ banned: store.banned, violations: store.violations }),
  CONFIG,
};
