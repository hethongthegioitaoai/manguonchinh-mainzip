namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Represents one territory row from GET /api/unity/map-state/:worldSlug → territories[].
    ///
    /// DB source: territories table (lib/db/src/schema/territories.ts)
    /// Joined with: npc_factions (owner name resolution)
    /// </summary>
    [System.Serializable]
    public class TerritoryDto
    {
        // ── Identity ────────────────────────────────────────────────────────────

        /// <summary>UUID primary key — stable across refreshes.</summary>
        public string id;

        /// <summary>Display name (e.g. "Làng Thanh Bình").</summary>
        public string name;

        // ── Classification ──────────────────────────────────────────────────────

        /// <summary>
        /// One of: "village" | "district" | "city" | "farmland" | "harbor"
        /// Use this to select the correct tile prefab.
        /// </summary>
        public string type;

        /// <summary>
        /// One of: "plains" | "forest" | "mountain" | "desert" | "swamp" | "sea"
        /// Drives movement cost and visual overlay.
        /// </summary>
        public string terrain;

        /// <summary>
        /// Operational status — normally "active".
        /// Future values may include "destroyed" or "contested".
        /// </summary>
        public string status;

        // ── Map position ────────────────────────────────────────────────────────

        /// <summary>Logical X coordinate, integer 5–95 (percentage of map width).</summary>
        public int x;

        /// <summary>Logical Y coordinate, integer 5–95 (percentage of map height).</summary>
        public int y;

        // ── Stats ───────────────────────────────────────────────────────────────

        /// <summary>Current population headcount.</summary>
        public int population;

        /// <summary>Prosperity index 0–100. Drives harvest multiplier and UI colour.</summary>
        public int prosperity;

        /// <summary>Security index 0–100. Affects crime/unrest mechanics.</summary>
        public int security;

        // ── Ownership ───────────────────────────────────────────────────────────

        /// <summary>
        /// Display name of the owning faction. Null when unowned.
        /// Resolved server-side from npc_factions.name.
        /// </summary>
        public string owner;

        /// <summary>
        /// UUID of the owning faction (npc_factions.id). Null when unowned.
        /// Use this to look up the full FactionDto in MapStateDto.factions.
        /// </summary>
        public string ownerId;
    }
}
