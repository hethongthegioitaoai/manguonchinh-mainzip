import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import { logger } from "../lib/logger.js";
import connectPg from "connect-pg-simple";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

let oidcConfig: client.Configuration | null = null;
let oidcConfigExpiry = 0;

async function getOidcConfig() {
  const now = Date.now();
  if (!oidcConfig || now > oidcConfigExpiry) {
    oidcConfig = await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
    oidcConfigExpiry = now + 3600 * 1000;
  }
  return oidcConfig;
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await db
    .insert(users)
    .values({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: claims["email"],
        firstName: claims["first_name"],
        lastName: claims["last_name"],
        profileImageUrl: claims["profile_image_url"],
        updatedAt: new Date(),
      },
    });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  function getRealDomain(req: any): string {
    // Vite proxy sets changeOrigin:true so req.hostname = "localhost"
    // Use REPLIT_DEV_DOMAIN env var for the real public domain
    const envDomain = process.env.REPLIT_DEV_DOMAIN;
    if (envDomain) return envDomain;
    const fwdHost = req.headers["x-forwarded-host"];
    if (fwdHost) return Array.isArray(fwdHost) ? fwdHost[0] : fwdHost;
    return req.hostname;
  }

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const domain = getRealDomain(req);
    ensureStrategy(domain);
    passport.authenticate(`replitauth:${domain}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    const domain = getRealDomain(req);
    ensureStrategy(domain);
    passport.authenticate(`replitauth:${domain}`, (err: any, user: any, info: any) => {
      if (err) {
        logger.error({ err }, "OIDC callback error");
        return res.redirect(`/login?error=${encodeURIComponent(err.message ?? "auth_error")}`);
      }
      if (!user) {
        logger.warn({ info }, "OIDC callback no user");
        return res.redirect(`/login?error=${encodeURIComponent(JSON.stringify(info) ?? "no_user")}`);
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          logger.error({ loginErr }, "Session login error");
          return res.redirect(`/login?error=${encodeURIComponent(loginErr.message ?? "login_failed")}`);
        }
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    const domain = getRealDomain(req);
    req.logout(async () => {
      const config = await getOidcConfig();
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `https://${domain}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export async function getAuthUser(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user;
}
