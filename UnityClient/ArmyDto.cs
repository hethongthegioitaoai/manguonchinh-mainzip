using System.Collections.Generic;

namespace AiWorldSystem.Unity
{
    /// <summary>
    /// One entry in the recent position trail of an army.
    /// Stored as JSONB in military_forces.recent_positions.
    /// </summary>
    [System.Serializable]
    public class ArmyPositionDto
    {
        /// <summary>Logical X (percentage of map width, same space as TerritoryDto.x).</summary>
        public float x;

        /// <summary>Logical Y (percentage of map height, same space as TerritoryDto.y).</summary>
        public float y;

        /// <summary>Simulation tick at which the army occupied this position.</summary>
        public int tick;
    }

    /// <summary>
    /// Represents one military force from GET /api/unity/map-state/:worldSlug → armies[].
    ///
    /// DB source: military_forces table (lib/db/src/schema/militaryForces.ts)
    /// Joined via: npc_governments → territories (to resolve world scope)
    ///
    /// Movement state machine: idle → moving → arrived | sieging → idle
    /// </summary>
    [System.Serializable]
    public class ArmyDto
    {
        // ── Identity ────────────────────────────────────────────────────────────

        /// <summary>UUID primary key (military_forces.id).</summary>
        public string id;

        /// <summary>
        /// Display name. Server generates "Army-{id[0..5]}" when armyName is blank.
        /// </summary>
        public string name;

        // ── Home territory ──────────────────────────────────────────────────────

        /// <summary>
        /// UUID of the territory this army was recruited in (home base).
        /// Maps to TerritoryDto.id in MapStateDto.territories.
        /// </summary>
        public string territoryId;

        // ── Movement ────────────────────────────────────────────────────────────

        /// <summary>
        /// UUID of the territory the army is currently standing in.
        /// Equals territoryId when idle.
        /// </summary>
        public string currentTerritoryId;

        /// <summary>
        /// UUID of the march destination. Null when idle or arrived.
        /// </summary>
        public string targetTerritoryId;

        /// <summary>
        /// March completion 0.0–1.0. Use for interpolated icon position.
        /// Lerp between currentTerritoryId.pos and targetTerritoryId.pos.
        /// </summary>
        public float movementProgress;

        /// <summary>
        /// State machine value. One of: "idle" | "moving" | "arrived" | "sieging"
        /// Defined in ArmyMovementStatus (militaryForces.ts).
        /// </summary>
        public string movementStatus;

        /// <summary>
        /// Ordered breadcrumb trail — most recent entry is the current position.
        /// May be empty (default []) when the army has never moved.
        /// </summary>
        public List<ArmyPositionDto> recentPositions;

        // ── Combat stats ────────────────────────────────────────────────────────

        /// <summary>Total headcount of soldiers.</summary>
        public int soldiers;

        /// <summary>
        /// Computed combat power = soldiers × morale/100 × training/10 × supply/100 × 10.
        /// Use for strength bar and battle outcome prediction.
        /// </summary>
        public float power;

        /// <summary>Morale 0–100 (stored as REAL). Below 30 triggers retreat logic.</summary>
        public float morale;

        /// <summary>Supply level 0–100 (stored as REAL). Below 20 triggers attrition.</summary>
        public float supply;
    }
}
