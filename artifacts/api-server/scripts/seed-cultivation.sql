-- Phase 7.2B: Full cultivation world seed
-- Targets: territories>=10, NPCs>=100, factions>=3, armies>=3
-- Idempotent: DELETE existing data first then re-insert

BEGIN;

-- ─── 0. Clear existing cultivation data ─────────────────────────────────────
DELETE FROM military_forces
  WHERE territory_id IN (SELECT id FROM territories WHERE world_slug='cultivation');
DELETE FROM npc_faction_members
  WHERE npc_id IN (SELECT id FROM npc_cores WHERE world_slug='cultivation');
DELETE FROM npc_governments
  WHERE territory_id IN (SELECT id FROM territories WHERE world_slug='cultivation');
DELETE FROM npc_factions WHERE world_slug='cultivation';
DELETE FROM npc_cores WHERE world_slug='cultivation';
DELETE FROM territories WHERE world_slug='cultivation';

-- ─── 1. Territories (12) ─────────────────────────────────────────────────────
INSERT INTO territories (world_slug, name, type, population, prosperity, security, x, y, terrain, status) VALUES
  ('cultivation', 'Thiên Kiếm Sơn',   'mountain',  1500,  72, 65, 20, 15, 'mountain', 'active'),
  ('cultivation', 'Linh Châu Thị',    'district',  4200,  80, 70, 45, 20, 'plains',   'active'),
  ('cultivation', 'Hắc Thủy Cảng',   'harbor',    3100,  68, 55, 70, 25, 'coastal',  'active'),
  ('cultivation', 'Ngọc Điền Thôn',   'farmland',  1800,  60, 75, 35, 50, 'plains',   'active'),
  ('cultivation', 'Huyết Lăng Phủ',   'district',  2900,  55, 40, 60, 55, 'forest',   'active'),
  ('cultivation', 'Cổ Pháp Thư Viện', 'temple',    800,   85, 80, 25, 35, 'mountain', 'active'),
  ('cultivation', 'Phong Lôi Bình Nguyên', 'farmland', 2200, 65, 60, 50, 70, 'plains', 'active'),
  ('cultivation', 'Dương Châu Trấn',  'village',   900,   58, 72, 75, 60, 'plains',   'active'),
  ('cultivation', 'Vạn Kiếm Cốc',    'village',   1100,  50, 45, 15, 65, 'forest',   'active'),
  ('cultivation', 'Lôi Trạch Đầm',   'village',   700,   42, 38, 80, 80, 'swamp',    'active'),
  ('cultivation', 'Bạch Ngọc Kinh',  'district',  5500,  90, 85, 50, 10, 'plains',   'active'),
  ('cultivation', 'Âm Hỏa Hoang Địa','wasteland', 300,   20, 15, 85, 90, 'desert',   'ruins');

-- ─── 2. Factions (3) ────────────────────────────────────────────────────────
INSERT INTO npc_factions (world_slug, name, type, treasury, reputation, influence, military_power) VALUES
  ('cultivation', 'Thiên Long Môn',    'warrior_clan',   5000, 80, 70, 85),
  ('cultivation', 'Ngũ Hành Thương Hội', 'merchant_guild', 12000, 65, 85, 30),
  ('cultivation', 'Huyền Âm Giáo',    'secret_society', 3000, 40, 60, 60);

-- ─── 3. Assign faction ownership to some territories ────────────────────────
UPDATE territories SET owner_faction_id = (SELECT id FROM npc_factions WHERE world_slug='cultivation' AND name='Thiên Long Môn')
  WHERE world_slug='cultivation' AND name IN ('Thiên Kiếm Sơn','Vạn Kiếm Cốc','Bạch Ngọc Kinh');

UPDATE territories SET owner_faction_id = (SELECT id FROM npc_factions WHERE world_slug='cultivation' AND name='Ngũ Hành Thương Hội')
  WHERE world_slug='cultivation' AND name IN ('Hắc Thủy Cảng','Linh Châu Thị','Dương Châu Trấn');

UPDATE territories SET owner_faction_id = (SELECT id FROM npc_factions WHERE world_slug='cultivation' AND name='Huyền Âm Giáo')
  WHERE world_slug='cultivation' AND name IN ('Huyết Lăng Phủ','Lôi Trạch Đầm');

-- ─── 4. NPCs (100) ──────────────────────────────────────────────────────────
-- Named leaders (12)
INSERT INTO npc_cores (world_slug, name, age, occupation, money, energy, hunger, happiness, life_stage, territory_id) VALUES
  ('cultivation', 'Hư Vô Lão Nhân',     312, 'Hiền Giả',       850, 60, 30, 75, 'elder',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Cổ Pháp Thư Viện')),
  ('cultivation', 'Thiên Long Môn Chủ', 180, 'Môn Phái Chủ',  3000, 85, 20, 70, 'adult',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Bạch Ngọc Kinh')),
  ('cultivation', 'Hắc Thị Chủ Tiêu',   45, 'Thương Nhân',    2000, 80, 65, 40, 'adult',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Linh Châu Thị')),
  ('cultivation', 'Huyết Kiếm Dạ La',   28, 'Kiếm Khách',      150, 95, 40, 55, 'adult',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Vạn Kiếm Cốc')),
  ('cultivation', 'Linh Trà Cô Nương',   22, 'Dược Sư',         300, 70, 55, 80, 'adult',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Cổ Pháp Thư Viện')),
  ('cultivation', 'Ngọc Long Tướng Quân',55, 'Đại Tướng',      1200, 90, 25, 65, 'adult',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Thiên Kiếm Sơn')),
  ('cultivation', 'Huyền Âm Giáo Chủ',  95, 'Giáo Chủ',       2500, 50, 20, 45, 'elder',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Huyết Lăng Phủ')),
  ('cultivation', 'Kim Bào Tri Phủ',     63, 'Quan Lại',        800, 65, 35, 60, 'adult',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Linh Châu Thị')),
  ('cultivation', 'Phong Vân Thương Nhân',38,'Thương Nhân',     500, 75, 50, 55, 'adult',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Hắc Thủy Cảng')),
  ('cultivation', 'Lôi Pháo Võ Sư',     42, 'Võ Sư',           400, 88, 30, 65, 'adult',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Phong Lôi Bình Nguyên')),
  ('cultivation', 'Mộc Lan Nông Phu',    35, 'Nông Dân',        120, 80, 60, 70, 'adult',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Ngọc Điền Thôn')),
  ('cultivation', 'Hải Vương Hoa Tiêu',  50, 'Thuyền Trưởng',  600, 85, 45, 60, 'adult',
    (SELECT id FROM territories WHERE world_slug='cultivation' AND name='Hắc Thủy Cảng'));

-- Bulk NPCs (88 rows) — spread across all 11 active territories
INSERT INTO npc_cores (world_slug, name, age, occupation, money, energy, hunger, happiness, life_stage, territory_id)
SELECT
  'cultivation',
  CASE (gs % 22)
    WHEN 0  THEN 'Kiếm Đồ ' || gs
    WHEN 1  THEN 'Thương Nhân ' || gs
    WHEN 2  THEN 'Nông Dân ' || gs
    WHEN 3  THEN 'Lính ' || gs
    WHEN 4  THEN 'Dược Sư ' || gs
    WHEN 5  THEN 'Tu Sĩ ' || gs
    WHEN 6  THEN 'Thợ Rèn ' || gs
    WHEN 7  THEN 'Ngư Dân ' || gs
    WHEN 8  THEN 'Học Giả ' || gs
    WHEN 9  THEN 'Hộ Vệ ' || gs
    WHEN 10 THEN 'Tiêu Sư ' || gs
    WHEN 11 THEN 'Thương Nhân ' || (gs+100)
    WHEN 12 THEN 'Lãnh Chúa ' || gs
    WHEN 13 THEN 'Dân Thường ' || gs
    WHEN 14 THEN 'Vũ Khí Sư ' || gs
    WHEN 15 THEN 'Thám Tử ' || gs
    WHEN 16 THEN 'Mục Đồng ' || gs
    WHEN 17 THEN 'Chiến Binh ' || gs
    WHEN 18 THEN 'Thợ Nhuộm ' || gs
    WHEN 19 THEN 'Tình Báo ' || gs
    WHEN 20 THEN 'Nhà Sư ' || gs
    ELSE         'Dân Thường ' || (gs+200)
  END,
  15 + (gs % 60),
  CASE (gs % 8)
    WHEN 0 THEN 'Kiếm Khách'
    WHEN 1 THEN 'Thương Nhân'
    WHEN 2 THEN 'Nông Dân'
    WHEN 3 THEN 'Hộ Vệ'
    WHEN 4 THEN 'Dược Sư'
    WHEN 5 THEN 'Tu Sĩ'
    WHEN 6 THEN 'Thợ Rèn'
    ELSE        'Ngư Dân'
  END,
  50 + (gs * 7 % 500),
  40 + (gs * 13 % 60),
  10 + (gs * 11 % 70),
  30 + (gs * 17 % 70),
  CASE WHEN (gs % 60) < 18 THEN 'child'
       WHEN (gs % 60) > 55 THEN 'elder'
       ELSE 'adult' END,
  (SELECT id FROM territories
   WHERE world_slug='cultivation' AND status='active'
   ORDER BY name
   LIMIT 1 OFFSET (gs % 11))
FROM generate_series(1, 88) AS gs;

-- ─── 5. NPC personalities for all NPCs ──────────────────────────────────────
INSERT INTO npc_personalities (npc_core_id, kindness, greed, bravery, intelligence, curiosity)
SELECT id,
  ROUND(CAST(0.1 + (EXTRACT(EPOCH FROM created_at) * 0.0001 % 0.9) AS numeric), 2),
  ROUND(CAST(0.1 + (EXTRACT(EPOCH FROM created_at) * 0.00013 % 0.9) AS numeric), 2),
  ROUND(CAST(0.1 + (EXTRACT(EPOCH FROM created_at) * 0.00017 % 0.9) AS numeric), 2),
  ROUND(CAST(0.1 + (EXTRACT(EPOCH FROM created_at) * 0.00019 % 0.9) AS numeric), 2),
  ROUND(CAST(0.1 + (EXTRACT(EPOCH FROM created_at) * 0.00023 % 0.9) AS numeric), 2)
FROM npc_cores WHERE world_slug='cultivation'
ON CONFLICT DO NOTHING;

-- ─── 6. Faction membership — assign named NPCs to factions ──────────────────
INSERT INTO npc_faction_members (faction_id, npc_id, role, joined_at)
SELECT
  (SELECT id FROM npc_factions WHERE world_slug='cultivation' AND name='Thiên Long Môn'),
  id, 'leader', now()
FROM npc_cores WHERE world_slug='cultivation' AND name='Thiên Long Môn Chủ';

INSERT INTO npc_faction_members (faction_id, npc_id, role, joined_at)
SELECT
  (SELECT id FROM npc_factions WHERE world_slug='cultivation' AND name='Thiên Long Môn'),
  id, 'member', now()
FROM npc_cores WHERE world_slug='cultivation' AND name IN ('Huyết Kiếm Dạ La','Ngọc Long Tướng Quân','Lôi Pháo Võ Sư');

INSERT INTO npc_faction_members (faction_id, npc_id, role, joined_at)
SELECT
  (SELECT id FROM npc_factions WHERE world_slug='cultivation' AND name='Ngũ Hành Thương Hội'),
  id, 'leader', now()
FROM npc_cores WHERE world_slug='cultivation' AND name='Hắc Thị Chủ Tiêu';

INSERT INTO npc_faction_members (faction_id, npc_id, role, joined_at)
SELECT
  (SELECT id FROM npc_factions WHERE world_slug='cultivation' AND name='Ngũ Hành Thương Hội'),
  id, 'member', now()
FROM npc_cores WHERE world_slug='cultivation' AND name IN ('Phong Vân Thương Nhân','Hải Vương Hoa Tiêu','Kim Bào Tri Phủ');

INSERT INTO npc_faction_members (faction_id, npc_id, role, joined_at)
SELECT
  (SELECT id FROM npc_factions WHERE world_slug='cultivation' AND name='Huyền Âm Giáo'),
  id, 'leader', now()
FROM npc_cores WHERE world_slug='cultivation' AND name='Huyền Âm Giáo Chủ';

INSERT INTO npc_faction_members (faction_id, npc_id, role, joined_at)
SELECT
  (SELECT id FROM npc_factions WHERE world_slug='cultivation' AND name='Huyền Âm Giáo'),
  id, 'member', now()
FROM npc_cores WHERE world_slug='cultivation' AND name IN ('Linh Trà Cô Nương','Hư Vô Lão Nhân');

-- Update faction leader_npc_id
UPDATE npc_factions SET leader_npc_id = (SELECT id FROM npc_cores WHERE world_slug='cultivation' AND name='Thiên Long Môn Chủ')
  WHERE world_slug='cultivation' AND name='Thiên Long Môn';
UPDATE npc_factions SET leader_npc_id = (SELECT id FROM npc_cores WHERE world_slug='cultivation' AND name='Hắc Thị Chủ Tiêu')
  WHERE world_slug='cultivation' AND name='Ngũ Hành Thương Hội';
UPDATE npc_factions SET leader_npc_id = (SELECT id FROM npc_cores WHERE world_slug='cultivation' AND name='Huyền Âm Giáo Chủ')
  WHERE world_slug='cultivation' AND name='Huyền Âm Giáo';

-- ─── 7. Governments (one per active territory) ──────────────────────────────
INSERT INTO npc_governments (territory_id, gov_type, treasury, approval_rate, tax_rate)
SELECT id,
  CASE type
    WHEN 'district'  THEN 'imperial_court'
    WHEN 'mountain'  THEN 'sect_hierarchy'
    WHEN 'harbor'    THEN 'merchant_council'
    WHEN 'temple'    THEN 'theocracy'
    WHEN 'farmland'  THEN 'village_council'
    ELSE                  'village_council'
  END,
  200 + (EXTRACT(EPOCH FROM created_at)::int % 800),
  50 + (EXTRACT(EPOCH FROM created_at)::int % 40),
  5  + (EXTRACT(EPOCH FROM created_at)::int % 15)
FROM territories
WHERE world_slug='cultivation' AND status='active';

-- Assign leaders to governments
UPDATE npc_governments SET leader_npc_id = (
  SELECT nc.id FROM npc_cores nc
  WHERE nc.territory_id = npc_governments.territory_id
    AND nc.world_slug = 'cultivation'
  ORDER BY nc.money DESC
  LIMIT 1
)
WHERE territory_id IN (SELECT id FROM territories WHERE world_slug='cultivation');

-- ─── 8. Military forces (one per government = 11 armies) ────────────────────
INSERT INTO military_forces (government_id, territory_id, army_name, total_soldiers, morale, training_level, supply_level, military_power)
SELECT
  g.id,
  g.territory_id,
  CASE (ROW_NUMBER() OVER () % 8)
    WHEN 0 THEN 'Thiên Kiếm Vệ'
    WHEN 1 THEN 'Ngọc Long Quân'
    WHEN 2 THEN 'Huyền Thiết Đội'
    WHEN 3 THEN 'Phong Lôi Vệ'
    WHEN 4 THEN 'Hắc Giáp Quân'
    WHEN 5 THEN 'Linh Tiêu Đội'
    WHEN 6 THEN 'Bạch Hổ Doanh'
    ELSE        'Thanh Long Quân'
  END,
  30 + (EXTRACT(EPOCH FROM g.created_at)::int % 70),
  50 + (EXTRACT(EPOCH FROM g.created_at)::int % 40),
  ROUND(CAST(1.0 + (EXTRACT(EPOCH FROM g.created_at)::int % 30) / 10.0 AS numeric), 1),
  60 + (EXTRACT(EPOCH FROM g.created_at)::int % 40),
  ROUND(CAST(
    (30 + (EXTRACT(EPOCH FROM g.created_at)::int % 70)) *
    ((50 + (EXTRACT(EPOCH FROM g.created_at)::int % 40)) / 100.0) *
    (1.0 + (EXTRACT(EPOCH FROM g.created_at)::int % 30) / 10.0) *
    ((60 + (EXTRACT(EPOCH FROM g.created_at)::int % 40)) / 100.0)
  AS numeric), 1)
FROM npc_governments g
WHERE g.territory_id IN (SELECT id FROM territories WHERE world_slug='cultivation' AND status='active');

-- ─── 9. Seed initial NPC memories ───────────────────────────────────────────
INSERT INTO npc_core_memories (npc_core_id, event, importance)
SELECT id,
  name || ' bắt đầu cuộc hành trình tu luyện tại ' || world_slug,
  5
FROM npc_cores WHERE world_slug='cultivation';

COMMIT;

-- ─── Verification counts ─────────────────────────────────────────────────────
SELECT 'territories'     AS entity, COUNT(*) AS count FROM territories     WHERE world_slug='cultivation'
UNION ALL
SELECT 'npc_cores',                 COUNT(*)          FROM npc_cores        WHERE world_slug='cultivation'
UNION ALL
SELECT 'npc_factions',              COUNT(*)          FROM npc_factions     WHERE world_slug='cultivation'
UNION ALL
SELECT 'npc_governments',           COUNT(*)          FROM npc_governments  WHERE territory_id IN (SELECT id FROM territories WHERE world_slug='cultivation')
UNION ALL
SELECT 'military_forces',           COUNT(*)          FROM military_forces  WHERE territory_id IN (SELECT id FROM territories WHERE world_slug='cultivation')
ORDER BY entity;
