import { Router } from "express";
import { db } from "@workspace/db";
import { caravans, caravanRaids, characters } from "@workspace/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { isAuthenticated } from "../auth/replitAuth.js";

const router = Router();

const ROUTES = [
  { from: "cultivation", to: "cyberpunk",  label: "Tu Tiên → Cyberpunk",  risk: 55, travelHours: 6  },
  { from: "cyberpunk",   to: "cultivation",label: "Cyberpunk → Tu Tiên",  risk: 55, travelHours: 6  },
  { from: "cyberpunk",   to: "wasteland",  label: "Cyberpunk → Hoang Phế",risk: 70, travelHours: 8  },
  { from: "wasteland",   to: "cyberpunk",  label: "Hoang Phế → Cyberpunk",risk: 70, travelHours: 8  },
  { from: "cultivation", to: "wasteland",  label: "Tu Tiên → Hoang Phế",  risk: 80, travelHours: 10 },
  { from: "wasteland",   to: "cultivation",label: "Hoang Phế → Tu Tiên",  risk: 80, travelHours: 10 },
  { from: "cultivation", to: "cyberpunk",  label: "Vòng 3 thế giới",      risk: 90, travelHours: 24, roundTrip: true },
];

const CARGO_TYPES = [
  { id: "herbs",       label: "Linh Dược",        baseValue: 120 },
  { id: "ore",         label: "Kim Loại Hiếm",    baseValue: 200 },
  { id: "data_chips",  label: "Chip Dữ Liệu",     baseValue: 180 },
  { id: "weapons",     label: "Vũ Khí Cổ",        baseValue: 250 },
  { id: "food",        label: "Thực Phẩm Đặc Sản",baseValue: 80  },
  { id: "artifacts",   label: "Di Vật Cổ",        baseValue: 350 },
  { id: "crystals",    label: "Tinh Thể Năng Lượng",baseValue: 300 },
];

const EVENTS = [
  "Con đường đầy sương mù bí ẩn, đội thương nhân phải dò từng bước.",
  "Một cơn bão tố đột ngột ập xuống, nhưng đội caravan kiên cường vượt qua.",
  "Phát hiện một con đường tắt bí mật qua khe núi, tiết kiệm được nhiều giờ đi đường.",
  "Gặp một đội thương nhân khác đang gặp khó khăn, quyết định giúp đỡ và nhận được thông tin quý giá.",
  "Bóng tối ở vùng biên giới khiến không khí căng thẳng, nhưng lính bảo vệ đã xua đuổi được nguy hiểm.",
  "Tìm thấy một kho báu nhỏ bỏ hoang bên đường, thêm được ít vàng cho chuyến hàng.",
  "Thời tiết thuận lợi, gió thổi xuôi chiều — chuyến đi nhanh hơn dự kiến.",
  "Đội trinh sát phát hiện dấu hiệu của cướp đường, quyết định đi vòng để tránh né.",
];

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateNarrative(fromWorld: string, toWorld: string, guards: number, cargo: any[], riskLevel: number): string {
  const routeDesc: Record<string, string> = {
    "cultivation-cyberpunk": "con đường xuyên qua lớp màn tu tiên vào thế giới neon",
    "cyberpunk-cultivation": "hành lang công nghệ dẫn vào vùng linh khí cổ xưa",
    "cyberpunk-wasteland":   "xa lộ bỏ hoang đầy bụi phóng xạ",
    "wasteland-cyberpunk":   "đường mòn hoang mạc dẫn về ánh đèn thành phố",
    "cultivation-wasteland": "con đường nguy hiểm nhất qua vùng hoang phế",
    "wasteland-cultivation": "hành trình trở về từ đất chết",
  };
  const routeKey = `${fromWorld}-${toWorld}`;
  const route    = routeDesc[routeKey] ?? "con đường bí ẩn giữa các thế giới";
  const event1   = pickRandom(EVENTS);
  const event2   = pickRandom(EVENTS.filter(e => e !== event1));
  const cargoNames = cargo.map((c: any) => c.label).slice(0, 3).join(", ");
  const guardDesc  = guards >= 5 ? "đội vệ binh hùng mạnh" : guards >= 2 ? "vài lính bảo vệ" : "không có lính hộ tống";
  const riskDesc   = riskLevel >= 80 ? "cực kỳ nguy hiểm" : riskLevel >= 60 ? "khá rủi ro" : "tương đối an toàn";
  return `Đoàn caravan khởi hành từ ${fromWorld === "cultivation" ? "Tu Tiên" : fromWorld === "cyberpunk" ? "Cyberpunk" : "Hoang Phế"} với hàng hóa gồm ${cargoNames || "các vật phẩm quý"}, cùng với ${guardDesc}. Chuyến hành trình theo ${route} được đánh giá là ${riskDesc}. ${event1} ${event2} Cuối cùng, đoàn caravan hoàn thành sứ mệnh sau nhiều gian nan.`;
}

/* GET /api/caravans/:worldSlug */
router.get("/caravans/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const all = await db.select().from(caravans)
      .where(eq(caravans.worldSlug, worldSlug))
      .orderBy(desc(caravans.createdAt))
      .limit(50);
    const raids = await db.select().from(caravanRaids).orderBy(desc(caravanRaids.raidedAt)).limit(30);

    const travelingNow = all.filter(c => c.status === "traveling");
    const arrived      = all.filter(c => c.status === "arrived");
    const raided       = all.filter(c => c.status === "raided");

    res.json({ caravans: all, raids, travelingNow: travelingNow.length, arrived: arrived.length, raided: raided.length, routes: ROUTES, cargoTypes: CARGO_TYPES });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/caravans/dispatch/:worldSlug */
router.post("/caravans/dispatch/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const { fromWorld, toWorld, cargoIds, guards } = req.body as {
      fromWorld: string; toWorld: string; cargoIds: string[]; guards: number;
    };

    const route = ROUTES.find(r => r.from === fromWorld && r.to === toWorld);
    if (!route) return res.status(400).json({ error: "Tuyến đường không tồn tại" });

    const cargo = CARGO_TYPES.filter(c => (cargoIds ?? []).includes(c.id))
      .map(c => ({ ...c, quantity: Math.floor(Math.random() * 10) + 5 }));
    if (cargo.length === 0) return res.status(400).json({ error: "Cần chọn ít nhất 1 loại hàng hóa" });

    const guardCount   = Math.max(0, Math.min(10, guards ?? 0));
    const riskLevel    = Math.max(10, route.risk - guardCount * 4);
    const goldReward   = cargo.reduce((s, c) => s + c.baseValue * c.quantity, 0) + guardCount * 50;
    const arrivesAt    = new Date(Date.now() + route.travelHours * 60 * 60 * 1000);
    const aiNarrative  = generateNarrative(fromWorld, toWorld, guardCount, cargo, riskLevel);

    const [newCaravan] = await db.insert(caravans).values({
      leaderId:    "npc-system",
      leaderName:  `NPC Thương Nhân ${Math.floor(Math.random() * 900) + 100}`,
      worldSlug,
      fromWorld,
      toWorld,
      cargo,
      guards:      guardCount,
      status:      "traveling",
      route:       route.label,
      aiNarrative,
      goldReward,
      riskLevel,
      arrivesAt,
    }).returning();

    res.json({ message: `Đoàn caravan đã khởi hành theo tuyến ${route.label}!`, caravan: newCaravan });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/caravans/simulate/:worldSlug — move traveling → arrived or raided */
router.post("/caravans/simulate/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const traveling = await db.select().from(caravans)
      .where(and(eq(caravans.worldSlug, worldSlug), eq(caravans.status, "traveling")));

    let arrived = 0, raided = 0;
    for (const c of traveling) {
      const roll = Math.random() * 100;
      if (roll < (c.riskLevel ?? 50)) {
        /* caravan raided */
        await db.update(caravans).set({ status: "raided", raidedAt: new Date() }).where(eq(caravans.id, c.id));
        const lootQty = Math.floor(Math.random() * 3) + 1;
        const loot    = (c.cargo as any[]).slice(0, lootQty);
        await db.insert(caravanRaids).values({
          caravanId: c.id,
          raiderId:  "npc-bandit",
          raiderName:`Băng Cướp ${pickRandom(["Bóng Tối","Máu Lửa","Sóng Thần","Hắc Long","Sắt Thép"])}`,
          success:   1,
          loot,
          battleLog: `Caravan bị tấn công bất ngờ. Đội vệ binh kháng cự dũng cảm nhưng thất bại. Loot bị cướp: ${loot.map((l: any) => l.label).join(", ")}.`,
        });
        raided++;
      } else {
        await db.update(caravans).set({ status: "arrived", arrivedAt: new Date() }).where(eq(caravans.id, c.id));
        arrived++;
      }
    }
    res.json({ message: `Mô phỏng xong: ${arrived} caravan đến nơi, ${raided} bị cướp.`, arrived, raided });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/caravans/auto-dispatch/:worldSlug — auto spawn + simulate */
router.post("/caravans/auto-dispatch/:worldSlug", async (req, res) => {
  try {
    const { worldSlug } = req.params;
    const worldRoutes = ROUTES.slice(0, 6);
    const count = Math.floor(Math.random() * 3) + 2;
    let spawned = 0;

    for (let i = 0; i < count; i++) {
      const route     = pickRandom(worldRoutes);
      const cargoPick = [pickRandom(CARGO_TYPES), pickRandom(CARGO_TYPES)].filter((c, i, a) => a.findIndex(x => x.id === c.id) === i);
      const guards    = Math.floor(Math.random() * 6);
      const riskLevel = Math.max(10, route.risk - guards * 4);
      const goldReward= cargoPick.reduce((s, c) => s + c.baseValue * 8, 0) + guards * 50;
      const cargo     = cargoPick.map(c => ({ ...c, quantity: Math.floor(Math.random() * 10) + 5 }));
      const arrivesAt = new Date(Date.now() + route.travelHours * 60 * 60 * 1000);
      const aiNarrative = generateNarrative(route.from, route.to, guards, cargo, riskLevel);

      await db.insert(caravans).values({
        leaderId: "npc-auto",
        leaderName: `Thương Đoàn ${["Vàng Bạc","Gió Đông","Sao Rơi","Hổ Phong","Long Hải","Thiên Lý"][i % 6]}`,
        worldSlug, fromWorld: route.from, toWorld: route.to, cargo, guards,
        status: "traveling", route: route.label, aiNarrative, goldReward, riskLevel, arrivesAt,
      });
      spawned++;
    }

    /* immediate simulate */
    const traveling = await db.select().from(caravans)
      .where(and(eq(caravans.worldSlug, worldSlug), eq(caravans.status, "traveling")));
    let arrived = 0, raidedCount = 0;
    for (const c of traveling) {
      const roll = Math.random() * 100;
      if (roll < (c.riskLevel ?? 50)) {
        await db.update(caravans).set({ status: "raided", raidedAt: new Date() }).where(eq(caravans.id, c.id));
        const loot = (c.cargo as any[]).slice(0, 2);
        await db.insert(caravanRaids).values({
          caravanId: c.id, raiderId: "npc-bandit",
          raiderName: `Băng Cướp ${pickRandom(["Bóng Tối","Máu Lửa","Sóng Thần","Hắc Long","Sắt Thép"])}`,
          success: 1, loot,
          battleLog: `Caravan bị tấn công. Loot bị cướp: ${loot.map((l: any) => l.label).join(", ")}.`,
        });
        raidedCount++;
      } else {
        await db.update(caravans).set({ status: "arrived", arrivedAt: new Date() }).where(eq(caravans.id, c.id));
        arrived++;
      }
    }

    res.json({ message: `Tạo ${spawned} caravan → ${arrived} đến nơi, ${raidedCount} bị cướp.`, spawned, arrived, raided: raidedCount });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
