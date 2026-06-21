using System.Collections.Generic;

namespace AiWorldSystem.Unity
{
    /// <summary>
    /// Root response from GET /api/unity/map-state/:worldSlug
    /// </summary>
    [System.Serializable]
    public class MapStateDto
    {
        /// <summary>World identifier slug (e.g. "tu-tien", "cyberpunk")</summary>
        public string worldSlug;

        /// <summary>Server timestamp — Unix milliseconds (UTC)</summary>
        public long ts;

        public List<TerritoryDto> territories;
        public List<FactionDto>   factions;
        public List<ArmyDto>      armies;
        public List<NpcMapDto>    npcs;
        public List<HistoryDto>   recentHistory;
    }

    /// <summary>
    /// Lightweight NPC entry embedded in the map-state response.
    /// Full NPC data lives in /api/unity/world-state/:worldSlug.
    /// </summary>
    [System.Serializable]
    public class NpcMapDto
    {
        public string id;
        public string name;
        public string occupation;
        /// <summary>UUID of the territory this NPC currently occupies. Null if unassigned.</summary>
        public string territoryId;
        /// <summary>0–100</summary>
        public int    energy;
        /// <summary>0–100</summary>
        public int    hunger;
        /// <summary>0–100</summary>
        public int    happiness;
        /// <summary>Current AI goal text. Null when idle.</summary>
        public string currentGoal;
    }

    /// <summary>
    /// One entry from world_history joined into the map-state response.
    /// </summary>
    [System.Serializable]
    public class HistoryDto
    {
        public int    tick;
        public string eventType;
        public string title;
        /// <summary>
        /// Raw JSON actors array from the DB (string[] or object[]).
        /// Deserialize with JsonUtility or Newtonsoft as needed.
        /// </summary>
        public string actors;
        public string createdAt;
    }
}
