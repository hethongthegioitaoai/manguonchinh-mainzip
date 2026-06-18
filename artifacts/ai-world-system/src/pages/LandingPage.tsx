import { motion } from "framer-motion";
import { Link } from "wouter";
import { ChevronRight, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-background">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%"],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
          }}
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at center, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="inline-flex items-center justify-center p-4 mb-6 rounded-full bg-primary/10 border border-primary/20 shadow-[0_0_30px_hsl(var(--primary)/0.3)]">
            <Cpu className="w-12 h-12 text-primary" />
          </div>
          <h1 className="font-orbitron text-5xl md:text-7xl lg:text-8xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-br from-white via-primary to-secondary drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            AI WORLD SYSTEM
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
        >
          <p className="text-lg md:text-2xl text-muted-foreground font-semibold tracking-widest uppercase mb-12">
            KHỞI TẠO THẦN KINH KẾT NỐI • BƯỚC VÀO VÙNG HƯ VÔ
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <Link href="/login">
            <Button
              size="lg"
              className="font-orbitron text-lg h-16 px-12 rounded-none border-2 border-primary bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_40px_hsl(var(--primary)/0.8)] relative overflow-hidden group"
              data-testid="button-enter-world"
            >
              <span className="relative z-10 flex items-center gap-2 tracking-widest">
                VÀO THẾ GIỚI <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
