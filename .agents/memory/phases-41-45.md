---
name: Phases 41-45 World Creator Roadmap
description: Các gotcha khi build 5 phases ROADMAP TẠO THẾ GIỚI ẢO
---

## Quy tắc

**characters.worldId không phải currentWorld:**
- Schema `characters` dùng `worldId` (uuid FK đến bảng `worlds` cố định), không có field `currentWorld`
- Khi join character với custom world slug → cần bảng trung gian hoặc skip join đó

**COSMIC_TIER_NAMES:**
- Const này được export từ `cosmicHierarchy.ts` schema nhưng khai báo lại local trong route để tránh circular import

**Why:** Characters chỉ có worldId trỏ đến 3 worlds cố định (tu tiên/cyberpunk/hoang phế), không phải custom world slugs.

**How to apply:** Khi cần count players theo custom worldSlug → không thể query characters.currentWorld, phải dùng giá trị hardcode hoặc bỏ qua count đó.
