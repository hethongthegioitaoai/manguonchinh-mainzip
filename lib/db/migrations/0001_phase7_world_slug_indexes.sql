-- Phase 7.1A — Database Index Hardening
-- Adds missing world_slug indexes on npc_factions and npc_cores,
-- and territory_id FK index on military_forces.
--
-- NOTE: military_forces has no world_slug column. World filtering is done
-- via JOIN territories ON military_forces.territory_id = territories.id
-- WHERE territories.world_slug = '...'. Adding territory_id index enables
-- the planner to use an index nested loop join instead of hash join.
--
-- Safe to re-run: uses IF NOT EXISTS throughout.

-- 1. npc_factions(world_slug)
CREATE INDEX IF NOT EXISTS npc_factions_world_slug_idx
  ON public.npc_factions USING btree (world_slug);

-- 2. npc_cores(world_slug)
CREATE INDEX IF NOT EXISTS npc_cores_world_slug_idx
  ON public.npc_cores USING btree (world_slug);

-- 3. military_forces(territory_id)  — FK join to territories.world_slug
CREATE INDEX IF NOT EXISTS military_forces_territory_id_idx
  ON public.military_forces USING btree (territory_id);

-- 4. military_forces(government_id) — FK join to npc_governments
CREATE INDEX IF NOT EXISTS military_forces_government_id_idx
  ON public.military_forces USING btree (government_id);
