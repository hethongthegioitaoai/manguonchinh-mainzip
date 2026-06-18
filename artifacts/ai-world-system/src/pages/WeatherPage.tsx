import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, CloudRain, CloudLightning, Wind, Snowflake, Sun, Zap, Sparkles, ArrowLeft, RefreshCw, Globe, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const WORLD_SLUGS = [
  { slug: "cultivation", name: "Tu Tiên Giới", color: "#22d3ee" },
  { slug: "cyberpunk",   name: "Cyberpunk City", color: "#a855f7" },
  { slug: "wasteland",   name: "Vùng Hoang Phế", color: "#f97316" },
];

const WEATHER_ICONS: Record<string, any> = {
  clear:        Sun,
  rain:         CloudRain,
  storm:        Wind,
  fog:          Cloud,
  blizzard:     Snowflake,
  heatwave:     Sun,
  thunderstorm: CloudLightning,
  aurora:       Sparkles,
  sandstorm:    Wind,
  blessing_sky: Sparkles,
};

const WEATHER_COLORS: Record<string, string> = {
  clear:        "#fbbf24",
  rain:         "#60a5fa",
  storm:        "#94a3b8",
  fog:          "#cbd5e1",
  blizzard:     "#bae6fd",
  heatwave:     "#f97316",
  thunderstorm: "#a78bfa",
  aurora:       "#34d399",
  sandstorm:    "#d97706",
  blessing_sky: "#facc15",
};

const INTENSITY_LABEL: Record<string, string> = {
  light: "Nhẹ", moderate: "Trung Bình", severe: "Dữ Dội",
};

function MultiplierBadge({ label, value }: { label: string; value: number }) {
  const isPositive = value >= 1;
  const color = value > 1 ? "#22d3ee" : value < 1 ? "#f87171" : "#94a3b8";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
      <span className="font-orbitron text-sm font-bold" style={{ color }}>
        ×{value.toFixed(2)}
      </span>
    </div>
  );
}

function WeatherCard({ worldSlug, worldName, color }: { worldSlug: string; worldName: string; color: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ current: any; history: any[] }>({
    queryKey: ["/api/weather", worldSlug],
    queryFn: () => fetch(`/api/weather/${worldSlug}`).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const generateMut = useMutation({
    mutationFn: (force: boolean) =>
      fetch(`/api/weather/generate/${worldSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldName, force }),
      }).then(r => r.json()),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["/api/weather", worldSlug] });
      queryClient.invalidateQueries({ queryKey: ["/api/weather/all/active"] });
      toast({ title: d.generated ? "⛅ Thời tiết mới đã sinh" : d.message });
    },
  });

  const weather = data?.current;
  const history = data?.history ?? [];
  const WeatherIcon = weather ? (WEATHER_ICONS[weather.weatherType] ?? Cloud) : Cloud;
  const wColor = weather ? (WEATHER_COLORS[weather.weatherType] ?? color) : color;

  const timeLeft = weather ? Math.max(0, Math.floor((new Date(weather.endsAt).getTime() - Date.now()) / 60000)) : 0;
  const hoursLeft = Math.floor(timeLeft / 60);
  const minsLeft = timeLeft % 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border bg-card/50 p-5 flex flex-col gap-4"
      style={{ borderColor: `${color}40` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color }} />
          <span className="font-orbitron text-sm font-bold" style={{ color }}>{worldName}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={generateMut.isPending}
          onClick={() => generateMut.mutate(true)}
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${generateMut.isPending ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {isLoading ? (
        <div className="h-24 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : weather ? (
        <>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded flex items-center justify-center border" style={{ borderColor: `${wColor}50`, background: `${wColor}15` }}>
              <WeatherIcon className="w-8 h-8" style={{ color: wColor }} />
            </div>
            <div className="flex-1">
              <div className="font-orbitron text-lg font-bold" style={{ color: wColor }}>{weather.weatherName}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs px-1.5 py-0.5 border" style={{ borderColor: `${wColor}40`, color: wColor }}>
                  {INTENSITY_LABEL[weather.intensity] ?? weather.intensity}
                </span>
                <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft} phút`} còn lại
                </span>
              </div>
            </div>
          </div>

          {weather.aiNarrative && (
            <p className="font-mono text-xs text-muted-foreground italic border-l-2 pl-3" style={{ borderColor: `${wColor}50` }}>
              {weather.aiNarrative}
            </p>
          )}

          <div className="grid grid-cols-4 gap-2 border border-border/50 p-3 bg-background/30">
            <MultiplierBadge label="EXP" value={weather.effects?.expMult ?? 1} />
            <MultiplierBadge label="Vàng" value={weather.effects?.goldMult ?? 1} />
            <MultiplierBadge label="Thu hoạch" value={weather.effects?.harvestMult ?? 1} />
            <MultiplierBadge label="Chiến đấu" value={weather.effects?.battleMult ?? 1} />
          </div>
        </>
      ) : (
        <div className="text-center text-muted-foreground font-mono text-sm py-6">
          Chưa có dữ liệu thời tiết
        </div>
      )}

      {history.length > 0 && (
        <div className="border-t border-border/40 pt-3">
          <div className="font-mono text-xs text-muted-foreground mb-2">LỊCH SỬ GẦN ĐÂY</div>
          <div className="flex flex-wrap gap-1.5">
            {history.slice(0, 5).map((h) => {
              const HIcon = WEATHER_ICONS[h.weatherType] ?? Cloud;
              const hc = WEATHER_COLORS[h.weatherType] ?? "#94a3b8";
              return (
                <div key={h.id} className="flex items-center gap-1 px-2 py-1 border border-border/40 text-xs font-mono" style={{ color: hc }}>
                  <HIcon className="w-3 h-3" />
                  <span>{h.weatherName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function WeatherPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: allWeather } = useQuery<any[]>({
    queryKey: ["/api/weather/all/active"],
    queryFn: () => fetch("/api/weather/all/active").then(r => r.json()),
  });

  const severeCounts = allWeather?.filter(w => w.intensity === "severe").length ?? 0;
  const blessingCounts = allWeather?.filter(w => ["aurora", "blessing_sky"].includes(w.weatherType)).length ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
          </Button>
        </div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <CloudLightning className="w-8 h-8 text-cyan-400" />
            <h1 className="font-orbitron text-3xl font-black text-cyan-400 tracking-wider">THỜI TIẾT THẾ GIỚI</h1>
          </div>
          <p className="text-muted-foreground text-sm">Thời tiết thay đổi mỗi 8–12 giờ — ảnh hưởng trực tiếp đến EXP, vàng và chiến đấu của bạn.</p>
        </motion.div>

        {/* Global summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8"
        >
          {[
            { label: "Thế Giới Active", value: WORLD_SLUGS.length, color: "#22d3ee" },
            { label: "Thời Tiết Khắc Nghiệt", value: severeCounts, color: "#f87171" },
            { label: "Phúc Lành", value: blessingCounts, color: "#34d399" },
          ].map((s) => (
            <div key={s.label} className="border border-border/50 bg-card/40 p-4 text-center">
              <div className="font-orbitron text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* World weather cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {WORLD_SLUGS.map((w, i) => (
            <motion.div key={w.slug} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.1 }}>
              <WeatherCard worldSlug={w.slug} worldName={w.name} color={w.color} />
            </motion.div>
          ))}
        </div>

        {/* Legend */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 border border-border/40 p-4">
          <div className="font-orbitron text-xs text-muted-foreground mb-3">BẢNG ÝNghĩa THỜI TIẾT</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(WEATHER_ICONS).map(([type, Icon]) => (
              <div key={type} className="flex items-center gap-2 text-xs font-mono">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: WEATHER_COLORS[type] ?? "#94a3b8" }} />
                <span className="text-muted-foreground capitalize">{type.replace("_", " ")}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono text-muted-foreground">
            <div><span className="text-cyan-400">×EXP</span> — điểm kinh nghiệm</div>
            <div><span className="text-yellow-400">×Vàng</span> — gold drop từ battle</div>
            <div><span className="text-green-400">×Thu hoạch</span> — tài nguyên thế giới</div>
            <div><span className="text-purple-400">×Chiến đấu</span> — damage/defense</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
