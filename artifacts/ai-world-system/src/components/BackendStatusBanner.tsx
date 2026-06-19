import { useEffect, useRef } from "react";
import { useHealthCheck } from "@/hooks/useHealthCheck";
import { useToast } from "@/hooks/use-toast";

export function BackendStatusBanner() {
  const { health } = useHealthCheck();
  const { toast } = useToast();
  const prevStatus = useRef<string>("unknown");

  useEffect(() => {
    const prev = prevStatus.current;
    const curr = health.status;
    if (prev === curr || prev === "unknown") {
      prevStatus.current = curr;
      return;
    }
    prevStatus.current = curr;

    if (curr === "degraded") {
      toast({
        title: "⚠️ Server không phản hồi",
        description:
          health.db?.status === "error"
            ? "Database lỗi — một số tính năng có thể không hoạt động."
            : "Backend đang gặp sự cố — vui lòng thử lại sau.",
        variant: "destructive",
      });
    } else if (curr === "ok" && prev === "degraded") {
      toast({
        title: "✅ Server đã hoạt động trở lại",
        description: `DB latency: ${health.db?.latencyMs ?? "?"}ms`,
      });
    }
  }, [health.status]);

  if (health.status !== "degraded") return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-red-900/90 px-4 py-2 text-sm text-red-100 backdrop-blur-sm">
      <span className="animate-pulse">●</span>
      <span>
        Backend đang gặp sự cố
        {health.db?.status === "error" ? " — Database lỗi" : ""}
        . Một số tính năng có thể không hoạt động.
      </span>
    </div>
  );
}
