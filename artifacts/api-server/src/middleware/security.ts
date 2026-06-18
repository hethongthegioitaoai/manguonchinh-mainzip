import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { RequestHandler, Request, Response, NextFunction } from "express";

/* ─── Helmet (security headers) ─── */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // disabled để không chặn FE dev
  crossOriginEmbedderPolicy: false,
});

/* ─── Global rate limiter: 300 req / 15 phút ─── */
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
  skip: (req: Request) => req.path.startsWith("/_"),
});

/* ─── Auth endpoints: 15 req / 15 phút ─── */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút." },
});

/* ─── API write endpoints: 60 req / 1 phút ─── */
export const writeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều thao tác. Vui lòng chậm lại." },
});

/* ─── SQL injection + XSS pattern detector ─── */
const SQL_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|UNION|EXEC)\b)/i,
  /(-{2}|\/\*|\*\/)/,
  /('\s*(OR|AND)\s*'?\d*\s*[=<>!])/i,
  /(SLEEP\s*\(|WAITFOR\s+DELAY)/i,
];
const XSS_PATTERNS = [
  /<script[\s\S]*?>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
];

function scanValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return (
    SQL_PATTERNS.some(p => p.test(value)) ||
    XSS_PATTERNS.some(p => p.test(value))
  );
}

function deepScan(obj: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  if (typeof obj === "string") return scanValue(obj);
  if (Array.isArray(obj)) return obj.some(v => deepScan(v, depth + 1));
  if (obj && typeof obj === "object") return Object.values(obj).some(v => deepScan(v, depth + 1));
  return false;
}

export const inputSanitizer: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const suspicious = deepScan(req.body) || deepScan(req.query);
  if (suspicious) {
    return res.status(400).json({ error: "Dữ liệu không hợp lệ." });
  }
  next();
};

/* ─── Honeypot: tự block scanner ─── */
const HONEYPOT = new Set([
  "/admin.php", "/.env", "/wp-admin", "/wp-login.php", "/phpmyadmin",
  "/config.php", "/.git/config", "/backup.sql", "/xmlrpc.php", "/.htaccess",
]);
const bannedIPs = new Map<string, number>();

export const honeypot: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (HONEYPOT.has(req.path.toLowerCase())) {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
    bannedIPs.set(ip, Date.now() + 3600_000);
    return res.status(404).json({ error: "Not found." });
  }
  next();
};

export const ipBanCheck: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  const until = bannedIPs.get(ip);
  if (until) {
    if (Date.now() > until) { bannedIPs.delete(ip); return next(); }
    return res.status(403).json({ error: "Truy cập bị từ chối." });
  }
  next();
};

/* ─── Suspicious user-agent block ─── */
const BAD_UAS = [/sqlmap/i, /nmap/i, /nikto/i, /masscan/i, /nuclei/i, /burpsuite/i, /dirbuster/i, /acunetix/i];

export const uaGuard: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const ua = req.headers["user-agent"] ?? "";
  if (BAD_UAS.some(p => p.test(ua))) {
    return res.status(403).json({ error: "Truy cập bị từ chối." });
  }
  next();
};

/* ─── Áp dụng tất cả ─── */
import type { Express } from "express";
export function applySecurityMiddleware(app: Express) {
  app.use(helmetMiddleware);
  app.use(ipBanCheck);
  app.use(honeypot);
  app.use(uaGuard);
  app.use(globalRateLimit);
  app.use(inputSanitizer);
  console.log("[SECURITY] ✅ Multi-layer security middleware applied");
}
