# Phase 7.4 — Heatmap Overlays

Five runtime overlay modes driven entirely by live `GET /api/unity/map-state/:worldSlug` data. No placeholder values — every score derives from a real DB column.

---

## Overlay Modes

| Key | Mode       | DB source field(s)                              | Domain       |
|-----|------------|-------------------------------------------------|--------------|
| `0` | None       | —                                               | —            |
| `1` | Population | `territory.population`                          | 0 → dynamic max |
| `2` | Security   | `territory.security`                            | 0 – 100      |
| `3` | Food       | `npc.hunger` per territory (inverted)           | 0 – 100      |
| `4` | Military   | `army.soldiers × army.power` per territory      | 0 → dynamic max |
| `5` | Prosperity | `territory.prosperity`                          | 0 – 100      |
| `H` | Toggle     | on/off last active overlay                      | —            |

---

## Exact Colour Formulas

All overlays use the same interpolation function:

```
t     = Mathf.Clamp01( InverseLerp(domainMin, domainMax, rawValue) )
colour = Color.Lerp(lowColor, highColor, t)
alpha  = overlayAlpha  (default 0.62, Inspector-configurable)
```

`SmoothStep` is applied to `t` during transitions only, not to the steady-state colour.

### 1 — Population

```
domainMin = 0
domainMax = max( territory.population ) across all territories in snapshot  (≥ 1)
t         = territory.population / domainMax

lowColor  = #1e3a5f   RGBA(0.118, 0.227, 0.373, α)   dark navy
highColor = #22d3ee   RGBA(0.133, 0.827, 0.933, α)   bright cyan
```

Dynamic max means the highest-population territory always renders full cyan regardless of absolute size.

### 2 — Security

```
domainMin = 0
domainMax = 100   (fixed — DB column security 0-100)
t         = territory.security / 100

lowColor  = #ef4444   RGBA(0.937, 0.267, 0.267, α)   red      (matches Phase 7.3 securityCritical)
highColor = #22c55e   RGBA(0.133, 0.773, 0.333, α)   green    (matches Phase 7.3 securityHigh)
```

Identical palette to the Phase 7.3 security dot so the two indicators agree visually.

### 3 — Food Availability

```
domainMin = 0
domainMax = 100   (fixed)

rawHunger = average npc.hunger for NPCs where npc.territoryId == territory.id
          = 50  (neutral fallback when no NPCs are present in the territory)

foodScore = 100 − rawHunger          // invert: high hunger = low food
t         = foodScore / 100

lowColor  = #ef4444   RGBA(0.937, 0.267, 0.267, α)   red    (scarce)
highColor = #84cc16   RGBA(0.518, 0.800, 0.086, α)   lime   (abundant)
```

Source: `npc.hunger` (integer 0–100) from `npcs[]` array in map-state response (limit 300 NPCs per world). NPCs with `npc.territoryId == null` are excluded from all territory averages.

### 4 — Military Strength

```
strength(territory) = Σ ( army.soldiers × army.power )
                        for all armies where army.currentTerritoryId == territory.id

domainMin = 0
domainMax = max( strength ) across all territories in snapshot  (≥ 1)
t         = strength(territory) / domainMax

lowColor  = #1a1a2e   RGBA(0.102, 0.102, 0.180, α)   near-black  (no military presence)
highColor = #ef4444   RGBA(0.937, 0.267, 0.267, α)   red         (maximum force)
```

Territories with no stationed army receive `strength = 0` → renders near-black.  
`army.power` is computed server-side as `soldiers × morale/100 × training/10 × supply/100 × 10`.

### 5 — Prosperity

```
domainMin = 0
domainMax = 100   (fixed — DB column prosperity 0-100)
t         = territory.prosperity / 100

lowColor  = #8b5cf6   RGBA(0.545, 0.361, 0.965, α)   violet   (matches faction palette[10])
highColor = #eab308   RGBA(0.918, 0.702, 0.031, α)   gold     (matches faction palette[5])
```

---

## Colour Gradient Reference

```
Mode        Low (#hex)   Mid (t=0.5)   High (#hex)
──────────  ──────────   ───────────   ──────────
Population  #1e3a5f      #205498       #22d3ee
Security    #ef4444      #89b944       #22c55e
Food        #ef4444      #ba9228       #84cc16
Military    #1a1a2e      #88162e       #ef4444
Prosperity  #8b5cf6      #ba7281       #eab308
```

Mid-gradient hex computed as `Color.Lerp(low, high, 0.5f)` converted to hex.

---

## Runtime Switching

### Mode change sequence

```
SetMode(newMode)
  │
  ├── PreviousMode = ActiveMode
  ├── ActiveMode   = newMode
  ├── OnModeChanged?.Invoke(newMode)              // subscribers update their UI
  ├── Stop running transition coroutine (if any)
  ├── ComputeAndApply(lastState, newMode)         // immediate score recompute
  ├── StartCoroutine(TransitionIn / TransitionToNone)
  └── legendUI?.Refresh(newMode, GetLegendData(newMode))
```

Score recomputation is synchronous (< 1 ms for 300 territories + 300 NPCs). No async needed.

### Toggle (key H)

```
H pressed:
  if ActiveMode != None → SetMode(None)
  else                  → SetMode(PreviousMode ?? Prosperity)
```

---

## Smooth Transitions

Uses `Mathf.SmoothStep(0, 1, elapsed / duration)` — the ease-in/ease-out curve removes the linear ramp artefact that is visible when overlays have very different saturations.

### TransitionIn

```
for each frame until elapsed >= transitionDuration:
    t       = SmoothStep(0, 1, elapsed / duration)
    blended = Color.Lerp(startColor[id], targetColor[id], t)
    MPB.SetColor(_Color, blended)
    sr.SetPropertyBlock(MPB)
```

### TransitionToNone

```
for each frame until elapsed >= transitionDuration:
    t     = SmoothStep(0, 1, elapsed / duration)
    color = startColor[id]
    color.a = Lerp(overlayAlpha, 0, t)
    MPB.SetColor(_Color, color)
    sr.SetPropertyBlock(MPB)

// After completion: SetActive(false) on all HeatmapLayer SpriteRenderers
```

Default `transitionDuration = 0.35s`. Configurable in Inspector.

---

## Legend Generation

`HeatmapManager.GetLegendData(mode)` returns a `LegendData` struct with:

| Field         | Type                      | Purpose                          |
|---------------|---------------------------|----------------------------------|
| `Title`       | string                    | Overlay name for label           |
| `Unit`        | string                    | "%" / "people" / "force"        |
| `FixedDomain` | bool                      | true = 0-100; false = 0-dynMax  |
| `Stops`       | `(Color, string)[]`       | 3 gradient stops with labels     |

`HeatmapLegendUI.Refresh(mode, data)`:
1. Sets `titleLabel.text`
2. Builds a 256px `Texture2D` gradient from `stops[0].color → stops[^1].color` and assigns to `gradientBar.texture`
3. Updates `stopLabels[0..2]` text and colour
4. Fades the `legendPanel` CanvasGroup in (`alpha=1`) or out (`alpha=0`)

---

## Prefab & Material Setup

### HeatmapLayer child object

Add a child `SpriteRenderer` named exactly **`"HeatmapLayer"`** to each Territory prefab.

```
Territory_Village.prefab
├── TileBase            SpriteRenderer
├── TerrainOverlay      SpriteRenderer
├── OwnerBorder         SpriteRenderer
├── ProsperityRing      SpriteRenderer
├── SecurityDot         SpriteRenderer
├── StateOverlay        SpriteRenderer
├── HeatmapLayer        SpriteRenderer   ← ADD THIS
├── Canvas (World Space)
│   ├── NameLabel
│   └── OwnerLabel
└── SelectionGlow       SpriteRenderer
```

### HeatmapLayer settings

| Property       | Value                                   |
|----------------|-----------------------------------------|
| Sprite         | A plain white square (1×1 or 32×32 px) |
| Material       | `Mat_Heatmap` (see below)              |
| Sorting Layer  | `TerritoryFX`                          |
| Order in Layer | `7` (above StateOverlay at 5)           |
| Initial alpha  | 0 / `SetActive(false)`                 |

### `Mat_Heatmap` material

| Property   | Value                         |
|------------|-------------------------------|
| Shader     | `Sprites/Default`             |
| Blend Mode | Multiply **or** Alpha Blend   |

Use **Alpha Blend** (`Sprites/Default`) to show the heatmap as a semi-transparent tint on top of the tile. Use **Multiply** if you want the territory art to show through with a colour cast effect.

Colour is set at runtime exclusively via `MaterialPropertyBlock` — the shared material is never modified. Zero material instances are created regardless of territory count.

---

## Wiring (MapManager)

```csharp
public class MapManager : MonoBehaviour
{
    public WorldLoader           loader;
    public TerritoryRendererPool pool;
    public HeatmapManager        heatmap;

    private void Start()
    {
        loader.OnStateRefreshed += OnState;
    }

    private void OnState(MapStateDto state)
    {
        pool.SyncFromState(state.territories);
        heatmap.RefreshData(state);          // recomputes if overlay is active
    }
}
```

`heatmap.RefreshData()` is a no-op when `ActiveMode == None`, so there is no cost when no overlay is shown.

---

## Keyboard Shortcut Reference

| Key       | Action                              |
|-----------|-------------------------------------|
| `0`       | Clear overlay (None)                |
| `1`       | Population overlay                  |
| `2`       | Security overlay                    |
| `3`       | Food overlay                        |
| `4`       | Military overlay                    |
| `5`       | Prosperity overlay                  |
| `H`       | Toggle last active overlay on/off   |

Numpad 0–5 also supported (`KeyCode.Keypad0` … `KeyCode.Keypad5`).

---

## File List

| File                                | Purpose                                         |
|-------------------------------------|-------------------------------------------------|
| `UnityClient/HeatmapManager.cs`     | Manager + `TerritoryRendererPool` + `LegendData` + `HeatmapLegendUI` |
| `UnityClient/TerritoryRenderer.cs`  | Tile renderer (Phase 7.3) — owns `HeatmapLayer` child |
| `UnityClient/WorldLoader.cs`        | Data source (Phase 7.2)                         |
| `docs/PHASE7_4_HEATMAPS.md`         | This document                                   |

---

## No Placeholder Assumptions

Every field name in this document corresponds to a real column returned by
`GET /api/unity/map-state/:worldSlug` as audited in Phase 7.2:

- `territory.population` — `territories.population` (integer)
- `territory.security`   — `territories.security` (integer 0-100)
- `territory.prosperity` — `territories.prosperity` (integer 0-100)
- `npc.hunger`           — `npc_cores.hunger` (integer 0-100)
- `army.soldiers`        — `military_forces.total_soldiers` (integer)
- `army.power`           — `military_forces.military_power` (float)
- `army.currentTerritoryId` — `military_forces.current_territory_id` (uuid)
