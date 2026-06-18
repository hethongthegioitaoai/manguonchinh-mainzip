---
name: Schema export naming conventions
description: Drizzle ORM schema exports dùng camelCase, không phải snake_case — tránh build error
---

## Rule
Khi import từ `@workspace/db/schema`, dùng camelCase cho tên bảng:
- `guildMembers` — không phải `guild_members`
- `characterFaction` — không phải `character_faction`
- `characterAchievements` — không phải `character_achievements`
- `dailyLogins` — không phải `daily_logins`
- `dungeonRuns` — không phải `dungeon_runs`
- `clanWars` — không phải `clan_wars`
- `pvpRankings` — không phải `pvp_rankings`

**Why:** Drizzle schema files export variable names dùng camelCase (`export const guildMembers = pgTable("guild_members", ...)`), nhưng tên bảng DB thực tế là snake_case. esbuild sẽ báo lỗi "No matching export" nếu dùng sai tên.

**How to apply:** Khi viết route mới, luôn grep schema file để xác nhận tên export trước khi import.
