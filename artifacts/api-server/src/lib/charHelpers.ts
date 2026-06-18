import { db } from "@workspace/db";
import { characters } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export function getCharGold(char: { stats: unknown }): number {
  return (char.stats as any)?.gold ?? 0;
}

export function getCharWorldSlug(char: { stats: unknown }): string {
  return (char.stats as any)?.world_slug ?? "cultivation";
}

export function getCharStat(char: { stats: unknown }, key: string, fallback: number = 0): number {
  return (char.stats as any)?.[key] ?? fallback;
}

export async function setCharGold(charId: string, stats: unknown, newGold: number) {
  await db.update(characters)
    .set({ stats: { ...(stats as object), gold: newGold } })
    .where(eq(characters.id, charId));
}
