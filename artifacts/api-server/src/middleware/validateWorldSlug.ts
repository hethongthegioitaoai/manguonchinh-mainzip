/**
 * Centralized :worldSlug validation middleware.
 *
 * Register on any router via:
 *   router.param("worldSlug", validateWorldSlug);
 *
 * On invalid slug → HTTP 404:
 *   { error: "World not found", validWorlds: ["cultivation", ...] }
 *
 * Valid worlds are cached for 60 s to avoid a DB round-trip on every request.
 * Call invalidateWorldSlugCache() whenever a world is created or deleted.
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { customWorlds } from "@workspace/db/schema";

interface WorldCacheEntry {
  slugs:    string[];
  expiresAt: number;
}

let _cache: WorldCacheEntry | null = null;
const CACHE_TTL_MS = 60_000;

async function getValidSlugs(): Promise<string[]> {
  const now = Date.now();
  if (_cache && now < _cache.expiresAt) return _cache.slugs;

  const rows  = await db.select({ slug: customWorlds.slug }).from(customWorlds);
  const slugs = rows.map(r => r.slug);
  _cache = { slugs, expiresAt: now + CACHE_TTL_MS };
  return slugs;
}

/** Call this after creating or deleting a world so the next request re-queries. */
export function invalidateWorldSlugCache(): void {
  _cache = null;
}

/**
 * Express param-style handler.
 * Usage: router.param("worldSlug", validateWorldSlug);
 */
export async function validateWorldSlug(
  req:       Request,
  res:       Response,
  next:      NextFunction,
  worldSlug: string,
): Promise<void> {
  try {
    const validWorlds = await getValidSlugs();

    if (!validWorlds.includes(worldSlug)) {
      res.status(404).json({
        error:       "World not found",
        validWorlds,
      });
      return;
    }

    next();
  } catch (err) {
    console.error("[validateWorldSlug] DB error:", err);
    next(err);
  }
}
