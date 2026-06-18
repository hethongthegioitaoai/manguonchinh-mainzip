import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Wand2, CheckCircle, ArrowLeft, Loader2, Globe, Sparkles, ChevronRight, Sword, Coins, Users, Map, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Preset = { id: string; name: string; style: string; icon: string; desc: string };
type Framework = {
  themeName: string; themeStyle: string; history: string;
  geography: any; economy: any; military: any; culture: any;
  uniqueItems: any[]; uniqueQuests: any[]; currencyName: string;
  currencySymbol: string; npcTitles: string[]; enemyTypes: string[];
};

const RARITY_COLORS: Record<string, string> = {
  common: "#94a3b8", uncommon: "#22c55e", rare: "#3b82f6", epic: "#a855f7", legendary: "#f59e0b",
};

function FrameworkPreview({ fw }: { fw: Framework }) {
  return (
    <div className="space-y-4">
      <div className="border border-cyan-400/30 bg-cyan-400/5 p-4">
        <h3 className="font-orbitron text-base font-bold text-cyan-400 mb-1">{fw.themeName}</h3>
        <p className="font-mono text-xs text-muted-foreground leading-relaxed">{fw.history}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {/* Địa lý */}
        <div className="border border-border/40 bg-card/30 p-3 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Map className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-mono text-xs font-bold text-blue-400">ĐỊA LÝ</span>
          </div>
          <p className="font-mono text-xs"><span className="text-muted-foreground">Thủ đô:</span> {fw.geography?.capital}</p>
          <p className="font-mono text-xs"><span className="text-muted-foreground">Địa hình:</span> {fw.geography?.terrain}</p>
          <p className="font-mono text-xs"><span className="text-muted-foreground">Địa danh:</span> {fw.geography?.landmark}</p>
          {fw.geography?.regions && (
            <div className="flex flex-wrap gap-1 mt-1">
              {fw.geography.regions.map((r: string) => (
                <span key={r} className="font-mono text-xs border border-border/30 px-2 py-0.5 text-muted-foreground">{r}</span>
              ))}
            </div>
          )}
        </div>

        {/* Kinh tế */}
        <div className="border border-border/40 bg-card/30 p-3 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-3.5 h-3.5 text-yellow-400" />
            <span className="font-mono text-xs font-bold text-yellow-400">KINH TẾ</span>
          </div>
          <p className="font-mono text-xs"><span className="text-muted-foreground">Tiền tệ:</span> {fw.currencySymbol} {fw.currencyName}</p>
          <p className="font-mono text-xs"><span className="text-muted-foreground">Tài nguyên:</span> {fw.economy?.mainResource}</p>
          <p className="font-mono text-xs"><span className="text-muted-foreground">Phong cách:</span> {fw.economy?.tradingStyle}</p>
        </div>

        {/* Quân sự */}
        <div className="border border-border/40 bg-card/30 p-3 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Sword className="w-3.5 h-3.5 text-red-400" />
            <span className="font-mono text-xs font-bold text-red-400">QUÂN SỰ</span>
          </div>
          <p className="font-mono text-xs"><span className="text-muted-foreground">Quân đội:</span> {fw.military?.armyName}</p>
          <p className="font-mono text-xs"><span className="text-muted-foreground">Boss:</span> {fw.military?.bossEnemy}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {fw.enemyTypes?.slice(0, 3).map((e: string) => (
              <span key={e} className="font-mono text-xs border border-red-500/20 text-red-400/70 px-1.5 py-0.5">{e}</span>
            ))}
          </div>
        </div>

        {/* Văn hóa */}
        <div className="border border-border/40 bg-card/30 p-3 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-mono text-xs font-bold text-purple-400">VĂN HÓA</span>
          </div>
          <p className="font-mono text-xs"><span className="text-muted-foreground">Xã hội:</span> {fw.culture?.socialSystem}</p>
          <p className="font-mono text-xs"><span className="text-muted-foreground">Tín ngưỡng:</span> {fw.culture?.religion}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {fw.npcTitles?.slice(0, 3).map((t: string) => (
              <span key={t} className="font-mono text-xs border border-purple-500/20 text-purple-400/70 px-1.5 py-0.5">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Items */}
      {fw.uniqueItems?.length > 0 && (
        <div className="border border-border/40 bg-card/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span className="font-mono text-xs font-bold text-yellow-400">VẬT PHẨM ĐẶC TRƯNG</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {fw.uniqueItems.slice(0, 6).map((item: any) => (
              <div key={item.name} className="border border-border/30 bg-card/20 p-2">
                <div className="flex items-center gap-1.5">
                  <span>{item.icon}</span>
                  <span className="font-mono text-xs truncate" style={{ color: RARITY_COLORS[item.rarity] ?? "#94a3b8" }}>{item.name}</span>
                </div>
                <p className="font-mono text-xs text-muted-foreground/60 mt-0.5 line-clamp-1">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quests */}
      {fw.uniqueQuests?.length > 0 && (
        <div className="border border-border/40 bg-card/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-xs font-bold text-cyan-400">NHIỆM VỤ MẪU</span>
          </div>
          <div className="space-y-1.5">
            {fw.uniqueQuests.slice(0, 4).map((q: any) => (
              <div key={q.title} className="flex items-start gap-2 border border-border/20 bg-card/20 p-2">
                <ChevronRight className="w-3 h-3 mt-0.5 text-cyan-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold">{q.title}</p>
                  <p className="font-mono text-xs text-muted-foreground/60 line-clamp-1">{q.description}</p>
                </div>
                <div className="ml-auto flex-shrink-0 text-right">
                  <p className="font-mono text-xs text-yellow-400">+{q.expReward} EXP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorldThemePage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"gallery" | "custom" | "apply">("gallery");
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [generatedFramework, setGeneratedFramework] = useState<Framework | null>(null);
  const [applyWorldSlug, setApplyWorldSlug] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: presets = [] } = useQuery<Preset[]>({
    queryKey: ["/api/world-theme/presets"],
    queryFn: () => fetch("/api/world-theme/presets").then(r => r.json()),
  });

  const { data: myWorlds = [] } = useQuery<any[]>({
    queryKey: ["/api/diplomacy/my-worlds"],
    queryFn: () => fetch("/api/diplomacy/my-worlds").then(r => r.json()),
    enabled: !!user,
  });

  const generateMut = useMutation({
    mutationFn: (body: any) => fetch("/api/world-theme/generate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: (d) => {
      setGeneratedFramework(d.framework);
      setActiveTab("apply");
      toast.success("Theme đã được tạo!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const applyMut = useMutation({
    mutationFn: (body: any) => fetch(`/api/world-theme/apply/${body.worldSlug}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.message); return d; }),
    onSuccess: () => {
      toast.success("Theme đã được áp dụng vào thế giới!");
      setGeneratedFramework(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handlePresetGenerate = async (preset: Preset) => {
    setSelectedPreset(preset);
    setIsGenerating(true);
    try {
      await generateMut.mutateAsync({ themeInput: preset.name, presetId: preset.id });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomGenerate = async () => {
    if (!customInput.trim()) return;
    setIsGenerating(true);
    try {
      await generateMut.mutateAsync({ themeInput: customInput });
    } finally {
      setIsGenerating(false);
    }
  };

  const tabs = [
    { id: "gallery", label: "15 PRESET", icon: Palette },
    { id: "custom",  label: "CUSTOM AI",  icon: Wand2 },
    { id: "apply",   label: "ÁP DỤNG",    icon: CheckCircle },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-orbitron text-2xl font-bold tracking-wider text-purple-400">THEME THẾ GIỚI</h1>
            <p className="font-mono text-xs text-muted-foreground">Chọn từ 15 preset hoặc nhập ý tưởng bất kỳ — AI sinh framework hoàn chỉnh</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 font-mono text-xs transition-all ${
                  activeTab === t.id ? "text-purple-400 border-b-2 border-purple-400" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
                {t.id === "apply" && generatedFramework && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 ml-1" />
                )}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* Tab: Gallery 15 Preset */}
          {activeTab === "gallery" && (
            <motion.div key="gallery" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {presets.map((preset) => (
                  <motion.button
                    key={preset.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handlePresetGenerate(preset)}
                    disabled={isGenerating}
                    className={`border p-3 text-center transition-all relative ${
                      selectedPreset?.id === preset.id
                        ? "border-purple-400/60 bg-purple-400/10"
                        : "border-border/50 bg-card/30 hover:border-border"
                    } ${isGenerating && selectedPreset?.id === preset.id ? "opacity-60" : ""}`}
                  >
                    {isGenerating && selectedPreset?.id === preset.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                      </div>
                    )}
                    <div className="text-2xl mb-1">{preset.icon}</div>
                    <div className="font-orbitron text-xs font-bold leading-tight">{preset.name}</div>
                    <div className="font-mono text-xs text-muted-foreground/60 mt-1 line-clamp-2">{preset.desc}</div>
                  </motion.button>
                ))}
              </div>
              <p className="font-mono text-xs text-muted-foreground/50 text-center mt-4">Click vào preset để AI sinh framework đầy đủ</p>
            </motion.div>
          )}

          {/* Tab: Custom AI */}
          {activeTab === "custom" && (
            <motion.div key="custom" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="max-w-lg space-y-4">
              <div className="border border-purple-500/30 bg-card/30 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-purple-400" />
                  <p className="font-orbitron text-sm text-purple-400">NHẬP Ý TƯỞNG BẤT KỲ</p>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  Ví dụ: "Đế chế kiến khổng lồ văn minh", "Thế giới trong cốc nước", "Civilization trong máy tính", "Thế giới âm nhạc sống"...
                </p>
                <Input
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  placeholder="Nhập chủ đề thế giới của bạn..."
                  className="font-mono text-xs"
                  onKeyDown={e => e.key === "Enter" && handleCustomGenerate()}
                />
                <Button className="w-full font-orbitron text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/30"
                  onClick={handleCustomGenerate}
                  disabled={!customInput.trim() || isGenerating}>
                  {isGenerating
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />AI đang sinh framework (5-10s)...</>
                    : <><Wand2 className="w-4 h-4 mr-2" />SINH FRAMEWORK</>}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Tab: Áp dụng */}
          {activeTab === "apply" && (
            <motion.div key="apply" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {!generatedFramework ? (
                <div className="border border-border/30 bg-card/20 p-8 text-center">
                  <Palette className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="font-mono text-xs text-muted-foreground/50">Chọn preset hoặc nhập custom để sinh framework trước</p>
                  <div className="flex gap-2 justify-center mt-4">
                    <Button variant="outline" className="font-mono text-xs" onClick={() => setActiveTab("gallery")}>Chọn Preset</Button>
                    <Button variant="outline" className="font-mono text-xs" onClick={() => setActiveTab("custom")}>Nhập Custom</Button>
                  </div>
                </div>
              ) : (
                <>
                  <FrameworkPreview fw={generatedFramework} />

                  <div className="border border-purple-500/30 bg-card/30 p-4 space-y-3">
                    <p className="font-orbitron text-sm text-purple-400">ÁP DỤNG VÀO THẾ GIỚI</p>
                    {myWorlds.length === 0 ? (
                      <div>
                        <p className="font-mono text-xs text-muted-foreground/60 mb-2">Bạn chưa có thế giới nào. Tạo thế giới trước!</p>
                        <Button variant="outline" className="font-mono text-xs" onClick={() => setLocation("/world-creator")}>
                          <Globe className="w-3.5 h-3.5 mr-1.5" /> Tạo Thế Giới
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Select value={applyWorldSlug} onValueChange={setApplyWorldSlug}>
                          <SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Chọn thế giới để áp dụng..." /></SelectTrigger>
                          <SelectContent>
                            {myWorlds.map((w: any) => (
                              <SelectItem key={w.slug} value={w.slug} className="font-mono text-xs">{w.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          className="w-full font-orbitron text-xs"
                          onClick={() => applyMut.mutate({
                            worldSlug: applyWorldSlug,
                            themeInput: selectedPreset?.name ?? customInput,
                            presetId: selectedPreset?.id,
                            framework: generatedFramework,
                          })}
                          disabled={!applyWorldSlug || applyMut.isPending}
                        >
                          {applyMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                          ÁP DỤNG THEME
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
