import { Router } from "express";
import { db } from "@workspace/db";
import {
  customWorlds, worldFrameworks, worldSimState, worldSimLog,
  territories, npcCores, npcFactions, militaryForces, npcGovernments,
  worldEventLog, worldHistory, worldSnapshots,
  territoryLogs,
} from "@workspace/db/schema";
import { eq, and, count, sql } from "drizzle-orm";

const router = Router();

/* ─── World definitions ─── */
const WORLD_DEFS = [
  { slug: "cultivation",  name: "Tiên Giới",               genre: "xianxia",   theme: "Tu Tiên — Cõi Tiên Thánh" },
  { slug: "cyberpunk",    name: "Neon Megacity 2087",       genre: "cyberpunk", theme: "Cyberpunk — Đô Thị Neon 2087" },
  { slug: "wasteland",    name: "Hoang Địa Tàn Thế",        genre: "wasteland", theme: "Wasteland — Hậu Tận Thế Ký" },
  { slug: "medieval",     name: "Vương Triều Trung Cổ",     genre: "fantasy",   theme: "Medieval Fantasy — Vương Triều Thần Thánh" },
  { slug: "scifi",        name: "Liên Bang Ngân Hà",        genre: "scifi",     theme: "Sci-Fi — Liên Bang Thiên Hà 3047" },
];

/* ─── Territory templates (rotated to get 20 per world) ─── */
const TERR_TYPES = ["village","city","farmland","harbor","district","fortress","mine","village","city","farmland","harbor","district","fortress","mine","village","city","farmland","district","fortress","mine"];
const TERR_NAME_PREFIXES: Record<string, string[]> = {
  cultivation: ["Thanh Vân","Thiên Long","Huyền Phong","Tử Tiêu","Bạch Ngọc","Kim Quang","Ngọc Hoàng","Hắc Hổ","Thái Cực","Linh Sơn","Vô Cực","Lôi Ẩn","Thần Phong","Cổ Đại","Bảo Tháp","Thiên Đình","Địa Phủ","Vân Hải","Long Vương","Phượng Hoàng"],
  cyberpunk:   ["Sector-7","NeoTokyo","ByteHaven","Glitch","Ironwire","CyberHub","DataPort","NightCity","CoreZone","PixelDen","GhostNet","SteelPlex","NeonBase","ChromeTag","QuantumNode","SynthWard","HoloZone","VoidPlex","RedChip","DarkNet"],
  wasteland:   ["Dustfall","Ashfield","Ruingate","Scrapyard","Deadzone","Ironruin","Blastpeak","Smokehaven","Toxicridge","Gravelbend","Bloodsand","Ashpeak","Cinder","Wastecrag","Burnhaven","Slagpit","Doomreach","Grimholt","Frostbile","Hellcrest"],
  medieval:    ["Ironkeep","Goldshire","Stonegate","Rivermoor","Highfield","Ashford","Thornwall","Coldbrook","Sunhaven","Brightmoor","Oakveil","Clearwater","Ravenmoor","Stonehelm","Willowbrook","Irondale","Silverfall","Blackwood","Grimholt","Dunmore"],
  scifi:       ["Colony-Α","Station-Β","Nexus-Γ","Outpost-Δ","Hub-Ε","Platform-Ζ","Base-Η","Relay-Θ","Port-Ι","Dome-Κ","Core-Λ","Ring-Μ","Sector-Ν","Grid-Ξ","Node-Ο","Array-Π","Chamber-Ρ","Vault-Σ","Beacon-Τ","Forge-Υ"],
};
const FACTION_NAMES: Record<string, Array<{name:string;type:string}>> = {
  cultivation: [{name:"Thiên Đạo Môn",type:"light"},{name:"Ma Giáo Huyết Tông",type:"dark"}],
  cyberpunk:   [{name:"NetRunner Syndicate",type:"neutral"},{name:"IronCorp Security",type:"dark"}],
  wasteland:   [{name:"Wasteland Survivors",type:"neutral"},{name:"Iron Raiders",type:"dark"}],
  medieval:    [{name:"Order of the Silver Dawn",type:"light"},{name:"Shadow Brotherhood",type:"dark"}],
  scifi:       [{name:"Galactic Federation",type:"light"},{name:"Void Collective",type:"dark"}],
};
const ARMY_NAMES: Record<string, string[]> = {
  cultivation: ["Thiên Kiếm Đội","Huyết Ma Quân"],
  cyberpunk:   ["Ghost Protocol","Neon Strikeforce"],
  wasteland:   ["Dust Raiders","Iron Militia"],
  medieval:    ["Silver Knights","Shadow Blades"],
  scifi:       ["Nova Fleet","Void Legion"],
};
const OCCUPATIONS = ["Thương Nhân","Chiến Binh","Học Giả","Nông Dân","Thợ Thủ Công","Thám Tử","Bác Sĩ","Kỹ Sư","Nghệ Nhân","Tu Sĩ"];
const NPC_PREFIXES: Record<string, string[]> = {
  cultivation: ["Thiên","Long","Huyền","Tử","Bạch","Kim","Ngọc","Hắc","Thái","Linh"],
  cyberpunk:   ["Zero","Byte","Glitch","Neon","Ghost","Flux","Hex","Razor","Volt","Pixel"],
  wasteland:   ["Ash","Dust","Grim","Iron","Scar","Rust","Bone","Crag","Blaze","Vex"],
  medieval:    ["Sir","Lord","Dame","Elder","Brother","Sister","Master","Knight","Baron","Duke"],
  scifi:       ["Unit-","Alpha-","Beta-","Delta-","Echo-","Sigma-","Omega-","Nova-","Zeta-","Tau-"],
};

/* ─── Event pool (same as stressTest, no Gemini) ─── */
const EVENT_POOL = [
  { type:"economic_boom",      name:"Thịnh Vượng Kinh Tế",   dEconomy:+12,dMood:+8, dStability:+5, dPop:+30  },
  { type:"economic_recession", name:"Suy Thoái Kinh Tế",      dEconomy:-10,dMood:-10,dStability:-8, dPop:-20  },
  { type:"political_crisis",   name:"Khủng Hoảng Chính Trị",  dEconomy:-8, dMood:-12,dStability:-15,dPop:0    },
  { type:"rebellion",          name:"Nổi Loạn Dân Chúng",     dEconomy:-15,dMood:-5, dStability:-20,dPop:-50  },
  { type:"natural_wonder",     name:"Kỳ Quan Thiên Nhiên",    dEconomy:+5, dMood:+15,dStability:+3, dPop:+10  },
  { type:"plague",             name:"Dịch Bệnh Hoành Hành",   dEconomy:-12,dMood:-18,dStability:-10,dPop:-80  },
  { type:"harvest_festival",   name:"Lễ Hội Thu Hoạch",       dEconomy:+8, dMood:+20,dStability:+5, dPop:+15  },
  { type:"ancient_discovery",  name:"Khám Phá Cổ Đại",        dEconomy:+10,dMood:+12,dStability:+2, dPop:0    },
  { type:"trade_boom",         name:"Buôn Bán Phồn Thịnh",    dEconomy:+15,dMood:+10,dStability:+5, dPop:+20  },
  { type:"hero_born",          name:"Anh Hùng Xuất Hiện",     dEconomy:+2, dMood:+18,dStability:+8, dPop:0    },
  { type:"villain_rises",      name:"Ma Đầu Trỗi Dậy",        dEconomy:-5, dMood:-14,dStability:-12,dPop:-30  },
  { type:"peace_treaty",       name:"Hòa Ước Ký Kết",         dEconomy:+5, dMood:+15,dStability:+18,dPop:0    },
  { type:"migration_wave",     name:"Làn Sóng Di Dân",        dEconomy:+3, dMood:-3, dStability:-5, dPop:+150 },
];

function clamp(v:number,mn:number,mx:number){ return Math.max(mn,Math.min(mx,v)); }
function rand(min:number,max:number){ return Math.random()*(max-min)+min; }
function randInt(min:number,max:number){ return Math.floor(rand(min,max+1)); }

/* ─── In-memory tick (no Gemini, no DB per tick) ─── */
interface SimState {
  population:number; economyScore:number; avgMood:number; stability:number; totalTicks:number;
}
interface TickResult {
  state:SimState; eventType:string|null; eventName:string|null; dPop:number; dEconomy:number; dMood:number; dStability:number;
}
function tickWorld(state:SimState): TickResult {
  let dPop=Math.round(rand(-5,15)),dEconomy=rand(-2,3),dMood=rand(-3,3),dStability=rand(-2,2);
  let eventType:string|null=null,eventName:string|null=null;
  dEconomy+=(50-state.economyScore)*0.03; dMood+=(60-state.avgMood)*0.03; dStability+=(70-state.stability)*0.03;
  if(Math.random()<0.28){
    const ev=EVENT_POOL[Math.floor(Math.random()*EVENT_POOL.length)];
    dPop+=ev.dPop; dEconomy+=ev.dEconomy; dMood+=ev.dMood; dStability+=ev.dStability;
    eventType=ev.type; eventName=ev.name;
  }
  return {
    state:{
      population:Math.max(0,state.population+dPop),
      economyScore:clamp(state.economyScore+dEconomy,0,100),
      avgMood:clamp(state.avgMood+dMood,0,100),
      stability:clamp(state.stability+dStability,0,100),
      totalTicks:state.totalTicks+1,
    },
    eventType,eventName,dPop,dEconomy,dMood,dStability,
  };
}

/* ─── Seed one world ─── */
async function seedWorld(def: typeof WORLD_DEFS[0]): Promise<{
  worldId: string;
  territoryIds: string[];
  factionIds: string[];
  armyIds: string[];
  npcCount: number;
}> {
  const { slug, name, genre, theme } = def;

  /* 1. customWorlds — upsert */
  await db.delete(customWorlds).where(eq(customWorlds.slug, slug)).catch(()=>{});
  const [world] = await db.insert(customWorlds).values({
    slug, name, genre,
    description: `Test world — ${theme}`,
    isPublic: true,
  }).onConflictDoNothing().returning();

  const worldId = world?.id ?? (await db.select({id:customWorlds.id}).from(customWorlds).where(eq(customWorlds.slug,slug)))[0].id;

  /* 2. worldFrameworks */
  await db.insert(worldFrameworks).values({ worldSlug:slug, theme, loreRules:"Auto-generated test world." }).onConflictDoNothing();

  /* 3. worldSimState */
  await db.insert(worldSimState).values({
    worldSlug:slug, worldName:name, theme,
    population:1000, economyScore:50, avgMood:60, stability:70,
  }).onConflictDoNothing();

  /* 4. Territories — 20 per world */
  const existingTerrs = await db.select({id:territories.id}).from(territories).where(eq(territories.worldSlug,slug));
  const existingCount = existingTerrs.length;
  const prefixes = TERR_NAME_PREFIXES[slug] ?? TERR_NAME_PREFIXES.medieval;
  const territoryIds: string[] = existingTerrs.map(t=>t.id);

  for(let i=existingCount; i<20; i++){
    const type = TERR_TYPES[i % TERR_TYPES.length];
    const [t] = await db.insert(territories).values({
      worldSlug: slug,
      name: `${prefixes[i % prefixes.length]} ${type.charAt(0).toUpperCase()+type.slice(1)}`,
      type,
      population: randInt(100,3000),
      prosperity: randInt(30,85),
      security: randInt(30,80),
      x: (i % 5)*20 + randInt(0,15),
      y: Math.floor(i/5)*20 + randInt(0,15),
      terrain: ["plains","mountains","forest","desert","swamp"][i%5],
    }).returning();
    if(t) {
      territoryIds.push(t.id);
      await db.insert(territoryLogs).values({ territoryId:t.id, event:`${t.name} được thành lập trong thế giới ${name}.` });
    }
  }

  /* 5. Factions — 2 per world */
  const existingFactions = await db.select({id:npcFactions.id}).from(npcFactions).where(eq(npcFactions.worldSlug,slug));
  const factionIds: string[] = existingFactions.map(f=>f.id);
  const factionDefs = FACTION_NAMES[slug] ?? FACTION_NAMES.medieval;
  for(let i=factionIds.length; i<2; i++){
    const fd = factionDefs[i] ?? { name:`Faction ${i+1}`, type:"neutral" };
    const [f] = await db.insert(npcFactions).values({
      worldSlug:slug, name:fd.name, type:fd.type,
      treasury:randInt(1000,10000), reputation:randInt(40,80),
      militaryPower:randInt(20,80),
    }).returning();
    if(f) factionIds.push(f.id);
  }

  /* 6. Assign half territories to each faction */
  if(factionIds.length>=2){
    for(let i=0;i<territoryIds.length;i++){
      const fid = factionIds[i%2];
      await db.update(territories).set({ownerFactionId:fid}).where(eq(territories.id,territoryIds[i]));
    }
  }

  /* 7. Governments — one per territory (required for army FK) */
  const existingGovs = await db.select({id:npcGovernments.id,tid:npcGovernments.territoryId})
    .from(npcGovernments)
    .innerJoin(territories,eq(npcGovernments.territoryId,territories.id))
    .where(eq(territories.worldSlug,slug));
  const govMap = new Map(existingGovs.map(g=>[g.tid,g.id]));
  /* Create governments for the 2 territories that will host armies */
  const armyTerritoryIds = [
    territoryIds[0],
    territoryIds[Math.floor(territoryIds.length/2)] ?? territoryIds[0],
  ];
  for(const tid of armyTerritoryIds){
    if(!govMap.has(tid)){
      const [g] = await db.insert(npcGovernments).values({
        territoryId:tid, govType:"village_council",
        treasury:randInt(500,5000), approvalRate:randInt(40,80), taxRate:randInt(5,20),
      }).returning();
      if(g) govMap.set(tid,g.id);
    }
  }

  /* 8. Armies — 2 per world (one per faction, using army territories) */
  const existingArmies = await db.select({id:militaryForces.id}).from(militaryForces)
    .innerJoin(territories,eq(militaryForces.territoryId,territories.id))
    .where(eq(territories.worldSlug,slug));
  const armyIds: string[] = existingArmies.map(a=>a.id);
  const armyDefs = ARMY_NAMES[slug] ?? ["Army A","Army B"];

  for(let i=armyIds.length; i<2; i++){
    const tid = armyTerritoryIds[i] ?? armyTerritoryIds[0];
    const govId = govMap.get(tid);
    if(!govId) continue;
    const [a] = await db.insert(militaryForces).values({
      governmentId: govId,
      territoryId: tid,
      armyName: armyDefs[i] ?? `${name} Army ${i+1}`,
      totalSoldiers: randInt(200,2000),
      morale: randInt(50,90),
      supplyLevel: randInt(60,100),
      militaryPower: randInt(30,90),
    }).returning();
    if(a) armyIds.push(a.id);
  }

  /* 8. NPCs — 100 per world */
  const existingNpcs = await db.select({id:npcCores.id}).from(npcCores).where(eq(npcCores.worldSlug,slug));
  let npcCount = existingNpcs.length;
  const npcPfx = NPC_PREFIXES[slug] ?? NPC_PREFIXES.medieval;

  const npcBatch: Array<typeof npcCores.$inferInsert> = [];
  for(let i=npcCount; i<100; i++){
    const occ = OCCUPATIONS[i%OCCUPATIONS.length];
    const pfx = npcPfx[Math.floor(i/10)%npcPfx.length];
    npcBatch.push({
      worldSlug: slug,
      name: `${pfx}${slug==="scifi"||slug==="cyberpunk"?i+1:""}${slug!=="scifi"&&slug!=="cyberpunk"?" "+occ:""}`,
      occupation: occ,
      money: randInt(50,5000),
      energy: randInt(60,100),
      territoryId: territoryIds[i%territoryIds.length] ?? null,
    });
    if(npcBatch.length>=50){
      await db.insert(npcCores).values(npcBatch);
      npcCount+=npcBatch.length; npcBatch.length=0;
    }
  }
  if(npcBatch.length>0){ await db.insert(npcCores).values(npcBatch); npcCount+=npcBatch.length; }

  return { worldId, territoryIds, factionIds, armyIds, npcCount };
}

/* ─── Run 1000 ticks for one world, batch-writing to DB ─── */
interface WorldRunResult {
  slug: string;
  ticks: number;
  durationMs: number;
  finalState: SimState;
  anomalies: string[];
  eventCount: number;
  historyCount: number;
  snapshotCount: number;
  logCount: number;
  ticksPerSecond: number;
}

async function runWorldTicks(slug: string, tickCount: number, progressCb?: (pct:number)=>void): Promise<WorldRunResult> {
  const t0 = Date.now();
  const [stateRow] = await db.select().from(worldSimState).where(eq(worldSimState.worldSlug,slug));
  let state: SimState = {
    population: stateRow?.population ?? 1000,
    economyScore: stateRow?.economyScore ?? 50,
    avgMood: stateRow?.avgMood ?? 60,
    stability: stateRow?.stability ?? 70,
    totalTicks: stateRow?.totalTicks ?? 0,
  };

  const initState = { ...state };
  const anomalies: string[] = [];

  /* Batch accumulators */
  const simLogBatch:   Array<typeof worldSimLog.$inferInsert>  = [];
  const eventLogBatch: Array<typeof worldEventLog.$inferInsert> = [];
  const histBatch:     Array<typeof worldHistory.$inferInsert>  = [];
  const snapBatch:     Array<typeof worldSnapshots.$inferInsert>  = [];

  const FLUSH_EVERY = 100;
  const PROGRESS_EVERY = Math.max(100, Math.floor(tickCount/10));
  const TS_BASE = Date.now();

  async function flush(){
    if(simLogBatch.length)   { await db.insert(worldSimLog).values([...simLogBatch]);   simLogBatch.length=0;   }
    if(eventLogBatch.length) { await db.insert(worldEventLog).values([...eventLogBatch]); eventLogBatch.length=0; }
    if(histBatch.length)     { await db.insert(worldHistory).values([...histBatch]);     histBatch.length=0;     }
    if(snapBatch.length)     { await db.insert(worldSnapshots).values([...snapBatch]);   snapBatch.length=0;     }
  }

  let totalEvents=0, totalHistory=0, totalSnaps=0;

  for(let t=1; t<=tickCount; t++){
    const result = tickWorld(state);
    state = result.state;

    /* world_sim_log — every tick */
    simLogBatch.push({
      worldSlug:slug, tickNumber:state.totalTicks+t,
      eventType: result.eventType ?? "tick",
      eventName: result.eventName ?? "Tick Bình Thường",
      summary: `Pop:${state.population} Eco:${state.economyScore.toFixed(1)} Mood:${state.avgMood.toFixed(1)} Stab:${state.stability.toFixed(1)}`,
      deltaPopulation: result.dPop, deltaEconomy: result.dEconomy,
      deltaMood: result.dMood, deltaStability: result.dStability,
    });

    /* world_event_log — every event roll */
    if(result.eventType){
      eventLogBatch.push({
        worldSlug:slug, tick:t, event:result.eventType,
        payload:{ name:result.eventName, dPop:result.dPop, dEconomy:result.dEconomy },
        ts: TS_BASE + t,
      });
      totalEvents++;
    }

    /* world_history — 15% chance */
    if(result.eventType && Math.random()<0.15){
      histBatch.push({
        worldSlug:slug, tick:t, eventType:result.eventType,
        title: result.eventName ?? "Sự Kiện Lịch Sử",
        description: `[${slug.toUpperCase()}] Tick ${t}: ${result.eventName}. Population ${state.population.toLocaleString()}.`,
        actors:{},
      });
      totalHistory++;
    }

    /* world_snapshots — every 100 ticks */
    if(t%100===0){
      snapBatch.push({
        worldSlug:slug, tick:t,
        data:{
          territories:[], factions:[], armies:[],
          aggregates:{
            totalPop:state.population, avgEconomy:state.economyScore,
            avgMood:state.avgMood, avgStability:state.stability,
          },
        },
      });
      totalSnaps++;
    }

    /* Anomaly detection */
    if(state.population>initState.population*15 && !anomalies.find(a=>a.includes("DÂN SỐ")))
      anomalies.push(`[Tick ${t}] ⚠️ DÂN SỐ TĂNG VÔ HẠN: ${state.population.toLocaleString()}`);
    if(state.population<10 && initState.population>100 && !anomalies.find(a=>a.includes("TUYỆT CHỦNG")))
      anomalies.push(`[Tick ${t}] 💀 TUYỆT CHỦNG: Dân số chỉ còn ${state.population}`);
    if(state.economyScore>=99 && t>100 && !anomalies.find(a=>a.includes("TIỀN")))
      anomalies.push(`[Tick ${t}] 💰 ECONOMY MAX: ${state.economyScore.toFixed(1)}`);
    if(state.economyScore<3 && t>50 && !anomalies.find(a=>a.includes("SỤP ĐỔ")))
      anomalies.push(`[Tick ${t}] 📉 THỊ TRƯỜNG SỤP ĐỔ: economy=${state.economyScore.toFixed(1)}`);
    if(state.stability<5 && t>100 && !anomalies.find(a=>a.includes("CHÍNH PHỦ")))
      anomalies.push(`[Tick ${t}] 🏛️ CHÍNH PHỦ SUP ĐỔ: stability=${state.stability.toFixed(1)}`);

    /* Flush every FLUSH_EVERY ticks */
    if(t%FLUSH_EVERY===0) await flush();

    /* Progress callback */
    if(t%PROGRESS_EVERY===0 && progressCb) progressCb(Math.round(t/tickCount*100));
  }
  await flush();

  /* Update world_sim_state */
  await db.update(worldSimState).set({
    totalTicks: (stateRow?.totalTicks??0)+tickCount,
    population: state.population,
    economyScore: state.economyScore,
    avgMood: state.avgMood,
    stability: state.stability,
    lastTickAt: new Date(),
  }).where(eq(worldSimState.worldSlug,slug));

  const durationMs = Date.now()-t0;
  return {
    slug, ticks:tickCount, durationMs, finalState:state,
    anomalies, eventCount:totalEvents, historyCount:totalHistory,
    snapshotCount:totalSnaps, logCount:tickCount,
    ticksPerSecond: Math.round(tickCount/(durationMs/1000)),
  };
}

/* ─── Verify data isolation ─── */
interface IsolationResult {
  slug: string;
  simLogCount: number;
  eventLogCount: number;
  historyCount: number;
  snapshotCount: number;
  territoryCount: number;
  npcCount: number;
  factionCount: number;
  armyCount: number;
  crossContaminationFound: boolean;
  issues: string[];
}

async function verifyIsolation(slugs: string[]): Promise<IsolationResult[]> {
  const results: IsolationResult[] = [];

  for(const slug of slugs){
    const [[simLogs],[evLogs],[hist],[snaps],[terrs],[npcs],[facs]] = await Promise.all([
      db.select({c:count()}).from(worldSimLog).where(eq(worldSimLog.worldSlug,slug)),
      db.select({c:count()}).from(worldEventLog).where(eq(worldEventLog.worldSlug,slug)),
      db.select({c:count()}).from(worldHistory).where(eq(worldHistory.worldSlug,slug)),
      db.select({c:count()}).from(worldSnapshots).where(eq(worldSnapshots.worldSlug,slug)),
      db.select({c:count()}).from(territories).where(eq(territories.worldSlug,slug)),
      db.select({c:count()}).from(npcCores).where(eq(npcCores.worldSlug,slug)),
      db.select({c:count()}).from(npcFactions).where(eq(npcFactions.worldSlug,slug)),
    ]);

    /* Army count via territories join */
    const armyRows = await db.select({c:count()}).from(militaryForces)
      .innerJoin(territories,eq(militaryForces.territoryId,territories.id))
      .where(eq(territories.worldSlug,slug));
    const armyCount = Number(armyRows[0]?.c??0);

    const issues: string[] = [];
    if(Number(simLogs.c)<900)  issues.push(`world_sim_log thiếu rows: ${simLogs.c} < 1000`);
    if(Number(snaps.c)<9)      issues.push(`world_snapshots thiếu: ${snaps.c} < 10`);
    if(Number(terrs.c)<20)     issues.push(`territories thiếu: ${terrs.c} < 20`);
    if(Number(npcs.c)<100)     issues.push(`npc_cores thiếu: ${npcs.c} < 100`);
    if(Number(facs.c)<2)       issues.push(`npc_factions thiếu: ${facs.c} < 2`);
    if(armyCount<2)            issues.push(`military_forces thiếu: ${armyCount} < 2`);

    /* Cross-contamination check: look for any sim_log rows with wrong world_slug */
    const leakCheck = await db.select({c:count()}).from(worldSimLog)
      .where(sql`world_slug != ${slug} AND id IN (SELECT id FROM world_sim_log WHERE world_slug = ${slug} LIMIT 1)`);

    results.push({
      slug,
      simLogCount:    Number(simLogs.c),
      eventLogCount:  Number(evLogs.c),
      historyCount:   Number(hist.c),
      snapshotCount:  Number(snaps.c),
      territoryCount: Number(terrs.c),
      npcCount:       Number(npcs.c),
      factionCount:   Number(facs.c),
      armyCount,
      crossContaminationFound: false,
      issues,
    });
  }

  /* Global cross-check: for each world, verify sim_log has exactly that world_slug */
  for(const r of results){
    const other = slugs.filter(s=>s!==r.slug);
    for(const otherSlug of other){
      const [row] = await db.select({c:count()}).from(worldSimLog)
        .where(and(eq(worldSimLog.worldSlug,r.slug),sql`world_slug != ${r.slug}`));
      if(Number(row?.c??0)>0){
        r.crossContaminationFound=true;
        r.issues.push(`⛔ DATA LEAK: world_sim_log có rows không phải '${r.slug}'`);
      }
    }
  }

  return results;
}

/* ─── DB size snapshot ─── */
async function getDbStats(): Promise<Record<string,number>> {
  const [sl,ev,hi,sn,tr,nc,nf,mf,tl] = await Promise.all([
    db.select({c:count()}).from(worldSimLog),
    db.select({c:count()}).from(worldEventLog),
    db.select({c:count()}).from(worldHistory),
    db.select({c:count()}).from(worldSnapshots),
    db.select({c:count()}).from(territories),
    db.select({c:count()}).from(npcCores),
    db.select({c:count()}).from(npcFactions),
    db.select({c:count()}).from(militaryForces),
    db.select({c:count()}).from(territoryLogs),
  ]);
  return {
    world_sim_log:     Number(sl[0]?.c??0),
    world_event_log:   Number(ev[0]?.c??0),
    world_history:     Number(hi[0]?.c??0),
    world_snapshots:   Number(sn[0]?.c??0),
    territories:       Number(tr[0]?.c??0),
    npc_cores:         Number(nc[0]?.c??0),
    npc_factions:      Number(nf[0]?.c??0),
    military_forces:   Number(mf[0]?.c??0),
    territory_logs:    Number(tl[0]?.c??0),
  };
}

/* ═════════════════════════════════════════
   POST /api/multi-world/run
   Streams SSE: seed → tick progress → verify → report
═════════════════════════════════════════ */
router.post("/multi-world/run", async (req, res) => {
  const TICK_COUNT = 1000;
  const WORLDS = WORLD_DEFS;
  const slugs = WORLDS.map(w=>w.slug);

  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache");
  res.setHeader("Connection","keep-alive");

  const send = (d: object) => res.write(`data: ${JSON.stringify(d)}\n\n`);
  const t0 = Date.now();

  try {
    send({ type:"started", worlds:slugs, ticks:TICK_COUNT, message:"Bắt đầu multi-world stress test" });

    /* ─── Phase 1: Seed all worlds ─── */
    send({ type:"phase", phase:"seed", message:"Đang khởi tạo 5 worlds..." });
    const dbStatsBefore = await getDbStats();
    const seedResults: Record<string,any> = {};

    for(const def of WORLDS){
      send({ type:"seeding", slug:def.slug, message:`Seeding ${def.name}...` });
      try {
        const r = await seedWorld(def);
        seedResults[def.slug] = r;
        send({ type:"seeded", slug:def.slug, territories:r.territoryIds.length, factions:r.factionIds.length, armies:r.armyIds.length, npcs:r.npcCount });
      } catch(e:any){
        send({ type:"error", slug:def.slug, message:`Seed lỗi: ${e.message}` });
        seedResults[def.slug] = { error: e.message };
      }
    }

    /* ─── Phase 2: Run 1000 ticks per world in PARALLEL ─── */
    send({ type:"phase", phase:"tick", message:`Chạy ${TICK_COUNT} ticks × ${WORLDS.length} worlds song song...` });

    const runPromises = WORLDS.map(def =>
      runWorldTicks(def.slug, TICK_COUNT, (pct) => {
        send({ type:"progress", slug:def.slug, pct });
      }).catch(e => ({
        slug:def.slug, ticks:0, durationMs:0, finalState:{} as SimState,
        anomalies:[`Error: ${e.message}`], eventCount:0, historyCount:0,
        snapshotCount:0, logCount:0, ticksPerSecond:0, error:e.message,
      } as WorldRunResult))
    );

    const runResults: WorldRunResult[] = await Promise.all(runPromises);
    send({ type:"ticks_done", results: runResults.map(r=>({slug:r.slug, durationMs:r.durationMs, ticksPerSecond:r.ticksPerSecond, anomalies:r.anomalies.length})) });

    /* ─── Phase 3: Verify isolation ─── */
    send({ type:"phase", phase:"verify", message:"Đang xác minh data isolation..." });
    const isolation = await verifyIsolation(slugs);
    const allClean = isolation.every(r=>!r.crossContaminationFound && r.issues.length===0);
    send({ type:"isolation", results:isolation, allClean });

    /* ─── Phase 4: Final DB stats ─── */
    const dbStatsAfter = await getDbStats();
    const dbGrowth: Record<string,{before:number,after:number,added:number}> = {};
    for(const tbl of Object.keys(dbStatsAfter)){
      dbGrowth[tbl]={before:dbStatsBefore[tbl]??0,after:dbStatsAfter[tbl],added:dbStatsAfter[tbl]-(dbStatsBefore[tbl]??0)};
    }

    /* ─── Build complete report payload ─── */
    const totalMs = Date.now()-t0;
    const report = {
      type:"completed",
      totalDurationMs: totalMs,
      worlds: WORLDS.map(def=>{
        const run  = runResults.find(r=>r.slug===def.slug)!;
        const isol = isolation.find(r=>r.slug===def.slug)!;
        const seed = seedResults[def.slug];
        return {
          slug:def.slug, name:def.name, genre:def.genre, theme:def.theme,
          seed: { territories:seed?.territoryIds?.length??0, factions:seed?.factionIds?.length??0, armies:seed?.armyIds?.length??0, npcs:seed?.npcCount??0, error:seed?.error??null },
          ticks: { count:run.ticks, durationMs:run.durationMs, ticksPerSecond:run.ticksPerSecond },
          finalState: run.finalState,
          events: { simLogs:run.logCount, eventLog:run.eventCount, history:run.historyCount, snapshots:run.snapshotCount },
          isolation: { ok:!isol.crossContaminationFound && isol.issues.length===0, issues:isol.issues, counts:{ simLog:isol.simLogCount, eventLog:isol.eventLogCount, history:isol.historyCount, snapshots:isol.snapshotCount, territories:isol.territoryCount, npcs:isol.npcCount, factions:isol.factionCount, armies:isol.armyCount } },
          anomalies: run.anomalies,
        };
      }),
      dbGrowth,
      isolation: { allClean, summary: isolation.map(r=>({ slug:r.slug, ok:!r.crossContaminationFound && r.issues.length===0, issues:r.issues })) },
    };

    send(report);
    res.end();

  } catch(e:any){
    console.error("[MultiWorldTest] error:", e);
    if(!res.headersSent) res.status(500).json({ error:e.message });
    else { send({ type:"error", message:e.message }); res.end(); }
  }
});

/* GET /api/multi-world/status — quick DB counts for 5 worlds */
router.get("/multi-world/status", async (req, res) => {
  try {
    const slugs = WORLD_DEFS.map(w=>w.slug);
    const results: Record<string,any> = {};
    for(const slug of slugs){
      const [[sl],[ev],[hi],[sn],[tr],[np],[fa]] = await Promise.all([
        db.select({c:count()}).from(worldSimState).where(eq(worldSimState.worldSlug,slug)),
        db.select({c:count()}).from(worldSimLog).where(eq(worldSimLog.worldSlug,slug)),
        db.select({c:count()}).from(worldHistory).where(eq(worldHistory.worldSlug,slug)),
        db.select({c:count()}).from(worldSnapshots).where(eq(worldSnapshots.worldSlug,slug)),
        db.select({c:count()}).from(territories).where(eq(territories.worldSlug,slug)),
        db.select({c:count()}).from(npcCores).where(eq(npcCores.worldSlug,slug)),
        db.select({c:count()}).from(npcFactions).where(eq(npcFactions.worldSlug,slug)),
      ]);
      results[slug]={ simState:Number(sl?.c??0), simLogs:Number(ev?.c??0), history:Number(hi?.c??0), snapshots:Number(sn?.c??0), territories:Number(tr?.c??0), npcs:Number(np?.c??0), factions:Number(fa?.c??0) };
    }
    res.json(results);
  } catch(e:any){ res.status(500).json({ error:e.message }); }
});

export default router;
