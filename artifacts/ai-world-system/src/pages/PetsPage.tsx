import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Zap, Heart, Shield, TrendingUp, Coins, Sparkles, Star } from "lucide-react";

const RARITY_COLOR: Record<string, string> = {
  common: "#94a3b8", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b",
};
const RARITY_LABEL: Record<string, string> = {
  common: "Thường", uncommon: "Hiếm", rare: "Quý", epic: "Sử Thi", legendary: "Huyền Thoại",
};

interface PetSkills { expBonus: number; goldBonus: number; critBonus: number; hpBonus: number; }
interface Pet {
  id: string; characterId: string; name: string; species: string; icon: string;
  worldSlug: string; rarity: string; tier: number; level: number; exp: number;
  bondLevel: number; skills: PetSkills; isActive: number;
  lastFedAt: string | null; lastSummonedAt: string | null; createdAt: string;
}
interface PetDef { species: string; icon: string; worldSlug: string; baseExpBonus: number; baseGoldBonus: number; baseCritBonus: number; baseHpBonus: number; }
interface PetsInfo { defs: PetDef[]; summonCost: number; cooldownHours: number; rarityPool: {rarity: string; weight: number}[]; }
interface CharInfo { id: string; name: string; level: number; stats: any; }

const TIER_NAMES = ["", "Sơ Sinh", "Trưởng Thành", "Tiến Hóa"];

function canFeed(lastFedAt: string | null): boolean {
  if (!lastFedAt) return true;
  return Date.now() - new Date(lastFedAt).getTime() >= 4 * 3600 * 1000;
}

function feedTimeLeft(lastFedAt: string | null): string {
  if (!lastFedAt || canFeed(lastFedAt)) return "";
  const diff = 4 * 3600 * 1000 - (Date.now() - new Date(lastFedAt).getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}g ${m}p`;
}

export default function PetsPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selectedCharId, setSelectedCharId] = useState("");
  const [tab, setTab] = useState<"pets" | "summon">("pets");

  const { data: chars = [] } = useQuery<CharInfo[]>({
    queryKey: ["/api/pets/my-chars"],
    queryFn: async () => { const r = await fetch("/api/pets/my-chars", { credentials: "include" }); return r.ok ? r.json() : []; },
  });

  const activeCharId = selectedCharId || chars[0]?.id || "";
  const activeChar = chars.find(c => c.id === activeCharId) ?? chars[0];
  const myGold = activeChar?.stats?.gold ?? 0;

  const { data: myPets = [], isLoading } = useQuery<Pet[]>({
    queryKey: ["/api/pets/my", activeCharId],
    enabled: !!activeCharId,
    queryFn: async () => { const r = await fetch(`/api/pets/my/${activeCharId}`, { credentials: "include" }); return r.ok ? r.json() : []; },
    refetchInterval: 30000,
  });

  const { data: info } = useQuery<PetsInfo>({
    queryKey: ["/api/pets/info"],
    queryFn: async () => { const r = await fetch("/api/pets/info", { credentials: "include" }); return r.ok ? r.json() : null; },
  });

  const activePet = myPets.find(p => p.isActive === 1);

  const summonMutation = useMutation({
    mutationFn: async (characterId: string) => {
      const r = await fetch("/api/pets/summon", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (d) => {
      const rc = RARITY_COLOR[d.pet.rarity] ?? "#94a3b8";
      toast.success(`🎉 Triệu hồi thành công: ${d.pet.icon} ${d.pet.name} (${RARITY_LABEL[d.pet.rarity]})`);
      queryClient.invalidateQueries({ queryKey: ["/api/pets/my", activeCharId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pets/my-chars"] });
      setTab("pets");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const equipMutation = useMutation({
    mutationFn: async ({ petId, characterId }: { petId: string; characterId: string }) => {
      const r = await fetch(`/api/pets/${petId}/equip`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => { toast.success("Đã kích hoạt đồng hành!"); queryClient.invalidateQueries({ queryKey: ["/api/pets/my", activeCharId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const unequipMutation = useMutation({
    mutationFn: async ({ petId, characterId }: { petId: string; characterId: string }) => {
      const r = await fetch(`/api/pets/${petId}/unequip`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => { toast.success("Đã gỡ đồng hành"); queryClient.invalidateQueries({ queryKey: ["/api/pets/my", activeCharId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const feedMutation = useMutation({
    mutationFn: async ({ petId, characterId }: { petId: string; characterId: string }) => {
      const r = await fetch(`/api/pets/${petId}/feed`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (d) => {
      if (d.evolved) toast.success(`✨ Pet đã TIẾN HÓA lên Tier ${d.newTier}!`);
      else toast.success(`💖 Bond +1! Level ${d.newLevel} · Bond ${d.newBond}`);
      queryClient.invalidateQueries({ queryKey: ["/api/pets/my", activeCharId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pets/my-chars"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Courier New', monospace" }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-cyan-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">🐾</span>
              <h1 className="text-xl font-bold tracking-widest text-cyan-400">ĐỒNG HÀNH</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wider">TRIỆU HỒI — NUÔI DƯỠNG — TIẾN HÓA</p>
          </div>
          {activeChar && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm font-mono">
              <Coins className="w-4 h-4" /><span>{myGold.toLocaleString()} vàng</span>
            </div>
          )}
        </div>

        {/* Char + tab selector */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {chars.length > 1 && (
            <select
              value={selectedCharId} onChange={e => setSelectedCharId(e.target.value)}
              className="bg-card border border-border text-xs font-mono px-3 py-1.5 text-foreground focus:outline-none focus:border-cyan-400/50"
            >
              {chars.map(c => <option key={c.id} value={c.id}>{c.name} (Lv.{c.level})</option>)}
            </select>
          )}
          <div className="flex gap-1 ml-auto">
            {([["pets", "ĐỒNG HÀNH CỦA TÔI"], ["summon", "TRIỆU HỒI"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-1.5 text-xs font-mono tracking-wider border transition-all ${tab === k ? "border-cyan-400/50 text-cyan-400 bg-cyan-400/5" : "border-border text-muted-foreground hover:border-border"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ACTIVE PET BANNER */}
        {tab === "pets" && activePet && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 border flex items-center gap-4"
            style={{ borderColor: `${RARITY_COLOR[activePet.rarity]}50`, backgroundColor: `${RARITY_COLOR[activePet.rarity]}08` }}
          >
            <div className="text-4xl">{activePet.icon}</div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground tracking-widest mb-0.5">ĐỒNG HÀNH ĐANG HOẠT ĐỘNG</div>
              <div className="font-bold font-mono" style={{ color: RARITY_COLOR[activePet.rarity] }}>{activePet.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {TIER_NAMES[activePet.tier]} · Lv.{activePet.level} · Bond {activePet.bondLevel}
              </div>
              <div className="flex gap-4 mt-1.5 text-xs">
                <span className="text-green-400">+{activePet.skills.expBonus}% EXP</span>
                <span className="text-yellow-400">+{activePet.skills.goldBonus}% Vàng</span>
                <span className="text-red-400">+{activePet.skills.critBonus}% Crit</span>
                <span className="text-blue-400">+{activePet.skills.hpBonus}% HP</span>
              </div>
            </div>
            <button onClick={() => unequipMutation.mutate({ petId: activePet.id, characterId: activeCharId })}
              className="text-xs font-mono text-muted-foreground border border-border px-3 py-1.5 hover:text-red-400 hover:border-red-400/30 transition-all">
              GỠ BỎ
            </button>
          </motion.div>
        )}

        {/* PETS TAB */}
        {tab === "pets" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {isLoading ? (
              <div className="text-center text-muted-foreground py-16 text-sm tracking-widest">ĐANG TẢI...</div>
            ) : myPets.length === 0 ? (
              <div className="text-center py-16 border border-border border-dashed">
                <div className="text-4xl mb-3">🐾</div>
                <p className="text-muted-foreground text-sm tracking-wider mb-4">Chưa có đồng hành nào</p>
                <button onClick={() => setTab("summon")}
                  className="px-6 py-2 text-sm font-mono border border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10 transition-all">
                  TRIỆU HỒI NGAY
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myPets.map(pet => {
                  const rc = RARITY_COLOR[pet.rarity] ?? "#94a3b8";
                  const isActive = pet.isActive === 1;
                  const feedable = canFeed(pet.lastFedAt);
                  const feedLeft = feedTimeLeft(pet.lastFedAt);
                  const bondPct = Math.min((pet.bondLevel / 50) * 100, 100);

                  return (
                    <motion.div key={pet.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className={`border p-4 transition-all ${isActive ? "ring-1" : ""}`}
                      style={{
                        borderColor: isActive ? rc : `${rc}30`,
                        ringColor: rc,
                        backgroundColor: isActive ? `${rc}06` : "hsl(var(--card)/0.5)",
                      }}
                    >
                      {/* Rarity badge */}
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-3xl">{pet.icon}</span>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs px-1.5 py-0.5 border font-mono"
                            style={{ color: rc, borderColor: `${rc}40`, backgroundColor: `${rc}10` }}>
                            {RARITY_LABEL[pet.rarity]}
                          </span>
                          {isActive && <span className="text-xs text-cyan-400 font-mono">⚡ ACTIVE</span>}
                        </div>
                      </div>

                      <div className="font-bold text-sm font-mono mb-0.5" style={{ color: rc }}>{pet.name}</div>
                      <div className="text-xs text-muted-foreground mb-3">{pet.species} · {TIER_NAMES[pet.tier]} · Lv.{pet.level}</div>

                      {/* Bond bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Bond</span><span>{pet.bondLevel}/50</span>
                        </div>
                        <div className="h-1 bg-card border border-border overflow-hidden">
                          <div className="h-full transition-all" style={{ width: `${bondPct}%`, backgroundColor: "#ec4899" }} />
                        </div>
                      </div>

                      {/* Skills */}
                      <div className="grid grid-cols-2 gap-1 text-xs mb-4">
                        <span className="text-green-400 font-mono">EXP +{pet.skills.expBonus}%</span>
                        <span className="text-yellow-400 font-mono">Vàng +{pet.skills.goldBonus}%</span>
                        <span className="text-red-400 font-mono">Crit +{pet.skills.critBonus}%</span>
                        <span className="text-blue-400 font-mono">HP +{pet.skills.hpBonus}%</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {!isActive ? (
                          <button onClick={() => equipMutation.mutate({ petId: pet.id, characterId: activeCharId })}
                            className="flex-1 py-1.5 text-xs font-mono border transition-all"
                            style={{ borderColor: `${rc}40`, color: rc }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${rc}12`)}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            KÍCH HOẠT
                          </button>
                        ) : (
                          <div className="flex-1 py-1.5 text-xs font-mono text-center text-cyan-400/50 border border-cyan-400/20">
                            ĐANG ACTIVE
                          </div>
                        )}
                        <button
                          onClick={() => feedable && feedMutation.mutate({ petId: pet.id, characterId: activeCharId })}
                          disabled={!feedable || feedMutation.isPending}
                          className={`px-3 py-1.5 text-xs font-mono border transition-all ${feedable ? "border-pink-400/40 text-pink-400 hover:bg-pink-400/10" : "border-border text-muted-foreground/40 cursor-not-allowed"}`}
                          title={feedable ? "Cho ăn (50 vàng)" : `Hồi phục sau ${feedLeft}`}
                        >
                          {feedable ? "🍖" : `⏰ ${feedLeft}`}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* SUMMON TAB */}
        {tab === "summon" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto">
            <div className="border border-border bg-card/50 p-6 text-center">
              <div className="text-5xl mb-4 animate-bounce">🔮</div>
              <h2 className="text-lg font-bold font-mono text-cyan-400 tracking-widest mb-2">TRIỆU HỒI ĐỒNG HÀNH</h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Dùng <span className="text-yellow-400 font-bold">{info?.summonCost ?? 200} vàng</span> để triệu hồi 1 đồng hành ngẫu nhiên.<br />
                Cooldown: <span className="text-cyan-400">{info?.cooldownHours ?? 12} giờ</span> giữa các lần triệu hồi.
              </p>

              {/* Rarity rates */}
              {info && (
                <div className="mb-6 text-left border border-border p-3 text-xs font-mono space-y-1">
                  <div className="text-muted-foreground tracking-widest mb-2">TỶ LỆ RARITY</div>
                  {info.rarityPool.map(r => (
                    <div key={r.rarity} className="flex justify-between">
                      <span style={{ color: RARITY_COLOR[r.rarity] }}>{RARITY_LABEL[r.rarity]}</span>
                      <span className="text-muted-foreground">{r.weight}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pet species preview */}
              {info && (
                <div className="mb-6 grid grid-cols-3 gap-2 text-xs">
                  {info.defs.map(d => (
                    <div key={d.species} className="border border-border p-2 text-center">
                      <div className="text-xl mb-0.5">{d.icon}</div>
                      <div className="text-muted-foreground font-mono" style={{ fontSize: "10px" }}>{d.species}</div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => activeCharId && summonMutation.mutate(activeCharId)}
                disabled={summonMutation.isPending || myGold < (info?.summonCost ?? 200)}
                className="w-full py-3 text-sm font-mono tracking-widest border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {summonMutation.isPending ? "ĐANG TRIỆU HỒI..." : `TRIỆU HỒI — ${info?.summonCost ?? 200} 🪙`}
              </button>
              {myGold < (info?.summonCost ?? 200) && (
                <p className="text-xs text-red-400/70 mt-2">Không đủ vàng ({myGold}/{info?.summonCost ?? 200})</p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
