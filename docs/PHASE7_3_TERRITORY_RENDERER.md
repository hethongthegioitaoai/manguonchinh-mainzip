# Phase 7.3 — Territory Renderer

Unity rendering architecture for AI World System territories. Every visual property derives from real DB fields — no placeholder assumptions.

---

## DB Field → Visual Mapping

All fields originate from `GET /api/unity/map-state/:worldSlug → territories[]`.  
DB source: `territories` table (`lib/db/src/schema/territories.ts`).

| DB Field     | DB Type              | Visual Output                                   |
|--------------|----------------------|-------------------------------------------------|
| `type`       | varchar(32)          | Base tile sprite variant (5 prefab types)       |
| `terrain`    | varchar(32)          | Additive overlay tint colour                    |
| `status`     | varchar(32)          | State machine → active / abandoned / ruins      |
| `x`          | integer 5–95         | World position X = x/100 × mapWidth             |
| `y`          | integer 5–95         | World position Z = y/100 × mapHeight            |
| `population` | integer              | Tile localScale via AnimationCurve              |
| `prosperity` | integer 0–100        | Prosperity ring fill + colour lerp              |
| `security`   | integer 0–100        | Security dot colour + icon sprite               |
| `ownerId`    | uuid (nullable)      | Border ring colour — deterministic hash palette |
| `owner`      | string (nullable)    | Owner label text (hidden when null)             |
| `name`       | varchar(128)         | Name label text                                 |

---

## Rendering Architecture

```
MapManager (GameObject)
│
├── TerritoryRendererPool  (MonoBehaviour)
│     Instantiates and pools TerritoryRenderer per territory id.
│     Receives MapStateDto from WorldLoader.OnStateRefreshed.
│     Creates / updates / destroys tiles as the world changes.
│
└── Territory_{type}_{id[0..5]}  (pooled GameObjects)
      TerritoryRenderer  (MonoBehaviour)
      │
      ├── [SpriteRenderer]  TileBase          type sprite
      ├── [SpriteRenderer]  TerrainOverlay    additive tint quad
      ├── [SpriteRenderer]  OwnerBorder       faction-coloured ring
      ├── [SpriteRenderer]  ProsperityRing    arc fill 0-100 %
      ├── [SpriteRenderer]  SecurityDot       coloured dot + icon
      ├── [SpriteRenderer]  StateOverlay      ruins / abandoned overlay
      ├── [TextMeshProUGUI] NameLabel         territory name
      ├── [TextMeshProUGUI] OwnerLabel        faction name
      └── [SpriteRenderer]  SelectionGlow     disabled by default
```

---

## Prefab Structure

Five prefab variants, one per `type` value. Use prefab variants in Unity so shared visuals stay in one base prefab.

```
Territory_Base.prefab              ← base prefab (all child objects)
├── Territory_Village.prefab       variant — village sprite
├── Territory_District.prefab      variant — district sprite
├── Territory_City.prefab          variant — city sprite  (larger base scale)
├── Territory_Farmland.prefab      variant — farmland sprite
└── Territory_Harbor.prefab        variant — harbor sprite
```

### Child Object layout (all prefabs share this structure)

```
Territory_Base (root)
 ├─ TileBase            SpriteRenderer  Layer: Territory       Order: 0
 ├─ TerrainOverlay      SpriteRenderer  Layer: Territory       Order: 1   BlendMode: Additive
 ├─ OwnerBorder         SpriteRenderer  Layer: Territory       Order: 2   (annular ring sprite)
 ├─ ProsperityRing      SpriteRenderer  Layer: TerritoryUI     Order: 3   (arc fill shader)
 ├─ SecurityDot         SpriteRenderer  Layer: TerritoryUI     Order: 4   anchor: top-right
 ├─ StateOverlay        SpriteRenderer  Layer: TerritoryFX     Order: 5   BlendMode: Multiply
 ├─ Canvas (World Space)
 │   ├─ NameLabel       TextMeshProUGUI
 │   └─ OwnerLabel      TextMeshProUGUI  (SetActive false when no owner)
 └─ SelectionGlow       SpriteRenderer  Layer: TerritoryFX     Order: 6   (SetActive false)
```

---

## Material Strategy

No new materials are created per territory. All colour variation uses **MaterialPropertyBlock** to avoid material instance allocation.

### Materials (shared, not per-instance)

| Material                  | Shader                    | Used for                          |
|---------------------------|---------------------------|-----------------------------------|
| `Mat_TerritoryBase`       | Sprites/Default           | TileBase                          |
| `Mat_TerrainOverlay`      | Sprites/Additive          | TerrainOverlay tint quads         |
| `Mat_OwnerBorder`         | Sprites/Default           | OwnerBorder (colour via MPB)      |
| `Mat_ProsperityRing`      | Custom/ArcFill            | ProsperityRing (fill via MPB)     |
| `Mat_SecurityDot`         | Sprites/Default           | SecurityDot (colour via MPB)      |
| `Mat_StateOverlay`        | Sprites/Multiply          | Ruins / abandoned overlay         |
| `Mat_SelectionGlow`       | Sprites/Additive          | Selection highlight               |

### ArcFill shader (ProsperityRing)

Minimal custom shader that reads `_FillAmount` (0.0–1.0) from the MPB and clips the ring sprite to show only `fill * 360°`. Can be implemented as a URP Shader Graph or a simple HLSL shader:

```hlsl
// ArcFill.shader — simplified excerpt
float angle = atan2(uv.y - 0.5, uv.x - 0.5);          // -π .. π
float normalised = (angle + PI) / TWO_PI;               // 0 .. 1
clip(_FillAmount - normalised);                         // discard beyond fill
return lerp(_EmptyColor, _FillColor, _FillAmount);
```

Alternatively use a **Radial Fill Image** on a UI canvas (Unity built-in) — set `Image.fillAmount = prosperity / 100f` and `Image.color = lerp(empty, full, fill)`.

---

## Visual Rules per Feature

### 1 — Owner Faction Colour

**Source field:** `ownerId` (uuid, nullable)  
**Algorithm:** Replicates `server factionColor()` exactly — sum of all char codes mod 12 → 12-colour palette.  
**Null ownerId:** Renders `#374151` (neutral dark grey).

```csharp
// TerritoryRenderer.FactionColor() — exact replica of server logic
int sum = 0;
foreach (char c in ownerId) sum += c;
return factionPalette[sum % 12];
```

Applied via `MaterialPropertyBlock` on `OwnerBorder` SpriteRenderer. Zero material instances created.

---

### 2 — Population Size Scaling

**Source field:** `population` (integer, seeded 200–2000, can grow beyond)  
**Mechanism:** `AnimationCurve` (Inspector-configurable) maps population → `transform.localScale`.

Default curve (set in Inspector):

| Population | Scale |
|-----------|-------|
| 0         | 0.4×  |
| 500       | 0.7×  |
| 1 000     | 1.0×  |
| 2 500     | 1.4×  |
| 5 000     | 1.8×  |

Hard clamp: `[minScale=0.4, maxScale=2.0]`. Configurable per scene without code changes.

---

### 3 — Prosperity Ring

**Source field:** `prosperity` (integer 0–100)  
**Mechanism:** Arc fill sprite + `_FillAmount` shader uniform via MPB.  
**Colour:** Lerps from `prosperityEmpty` (dark grey) to `prosperityFull` (gold `#f5d730`) based on fill.

| Range | Appearance          |
|-------|---------------------|
| 0     | Empty dark ring     |
| 1–49  | Red-orange partial  |
| 50–74 | Yellow partial      |
| 75–99 | Gold mostly filled  |
| 100   | Full bright gold    |

Ring is hidden (`SetActive(false)`) when `status` is `ruins` or `destroyed`.

---

### 4 — Security Indicator

**Source field:** `security` (integer 0–100)  
**Mechanism:** Small dot SpriteRenderer in top-right corner of tile. Colour and sprite icon change by threshold.

| security value | Level    | Colour    | Hex      |
|---------------|----------|-----------|---------|
| 0–24          | Critical | Red       | #ef4444  |
| 25–49         | Low      | Orange    | #f97316  |
| 50–74         | Medium   | Yellow    | #eab308  |
| 75–100        | High     | Green     | #22c55e  |

Icons: shield outline (critical) → half shield (low) → shield (medium) → shield-check (high).

---

### 5 — Territory State (ruins / abandoned / active)

**Source fields:** `status` (varchar), `population` (integer), `ownerId` (uuid?)

**State classification logic (deterministic from DB data):**

```
status == "ruins" or "destroyed"        → Ruins
status == "abandoned"                   → Abandoned
ownerId == null AND population == 0     → Abandoned   (derived state)
otherwise                               → Active
```

| State     | TileBase tint        | StateOverlay                | ProsperityRing | OwnerBorder |
|-----------|----------------------|-----------------------------|----------------|-------------|
| Active    | White (1,1,1,1)      | Disabled                    | Visible        | Faction col |
| Abandoned | Grey (0.55,0.55,0.55)| Faded grey vignette 45% α   | Visible        | Neutral col |
| Ruins     | Dark (0.30,0.28,0.27)| Burn/crumble texture 65% α  | Hidden         | Neutral col |

StateOverlay uses **Multiply** blend mode so the tile art shows through with a colour cast.

---

## TerritoryRendererPool — Usage

```csharp
// On your MapManager MonoBehaviour:
public WorldLoader        loader;
public TerritoryRendererPool pool;

private void Start()
{
    loader.OnStateRefreshed += OnMapState;
}

private void OnMapState(MapStateDto state)
{
    pool.SyncFromState(state.territories);
}
```

`SyncFromState()` is **idempotent**:
- New territory ids → Instantiate + `Apply()`
- Existing ids → `Apply()` (dirty update only)
- Removed ids → `Destroy()`

---

## Integration with WorldLoader

```csharp
// Full wiring example
var loader = GetComponent<WorldLoader>();
var pool   = GetComponent<TerritoryRendererPool>();

loader.OnStateRefreshed += (state) =>
{
    pool.SyncFromState(state.territories);

    // Optionally update faction colour registry for cross-referencing
    foreach (var faction in state.factions)
        FactionColorRegistry.Register(faction.id, faction.name);
};
```

---

## Sorting Layers (recommended)

```
Sorting Layer order (back to front):
  Background      — sky / ground plane
  Territory       — TileBase, TerrainOverlay, OwnerBorder
  TerritoryUI     — ProsperityRing, SecurityDot
  TerritoryFX     — StateOverlay, SelectionGlow
  Armies          — army movement icons
  Players         — player agent icons
  NPCs            — NPC dots
  UI              — world-space labels
```

---

## File List

| File                                   | Purpose                                    |
|----------------------------------------|--------------------------------------------|
| `UnityClient/TerritoryRenderer.cs`     | Per-tile MonoBehaviour + pool manager      |
| `UnityClient/TerritoryDto.cs`          | Data model (Phase 7.2)                     |
| `UnityClient/WorldLoader.cs`           | Data source — polls map-state (Phase 7.2)  |
| `docs/PHASE7_3_TERRITORY_RENDERER.md`  | This document                              |

---

## No Placeholder Assumptions

Every threshold, colour, and field name in this document maps to:
- A real column in `territories` or `npc_factions` PostgreSQL tables
- The exact field names returned by `GET /api/unity/map-state/:worldSlug`
- The exact `factionColor()` algorithm in `artifacts/api-server/src/routes/worldMap.ts`

No mock data. No hardcoded territory lists. All state derived at runtime from the live backend response.
