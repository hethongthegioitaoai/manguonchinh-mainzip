namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Represents one faction from GET /api/unity/map-state/:worldSlug → factions[].
    ///
    /// DB source: npc_factions table (lib/db/src/schema/npcFactions.ts)
    /// Selected fields: id, name, type, influence, treasury
    /// </summary>
    [System.Serializable]
    public class FactionDto
    {
        // ── Identity ────────────────────────────────────────────────────────────

        /// <summary>UUID primary key. Cross-reference with TerritoryDto.ownerId.</summary>
        public string id;

        /// <summary>Display name (e.g. "Đế Quốc Phương Bắc").</summary>
        public string name;

        // ── Classification ──────────────────────────────────────────────────────

        /// <summary>
        /// Faction archetype. Known values include:
        /// "merchant_guild" | "empire" | "clan" | "order" | "alliance" | "tribe"
        /// Used to select faction banner art and AI behaviour profile.
        /// </summary>
        public string type;

        // ── Economy ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Gold treasury. Drives recruitment and diplomacy decisions.
        /// Coalesced to 0 server-side (never null).
        /// </summary>
        public int treasury;

        // ── Geopolitics ─────────────────────────────────────────────────────────

        /// <summary>
        /// Influence score. Higher = more political weight in diplomacy events.
        /// Coalesced to 0 server-side (never null).
        /// </summary>
        public int influence;
    }
}
