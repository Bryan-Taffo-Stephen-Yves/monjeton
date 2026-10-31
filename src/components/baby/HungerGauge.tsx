import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { elide, hungerTone, type HungerTone } from "@/lib/baby";
import { BabyBottle } from "./BabyBottle";

const TONE_FILL: Record<HungerTone, string> = {
  full: "linear-gradient(90deg, #3FAE0C, #6BD62C 55%, #7cff3a)",
  low: "linear-gradient(90deg, #F08A24, #F5A524 60%, #F7C04A)",
  empty: "linear-gradient(90deg, #D93B3F, #E5484D 60%, #F06A6E)",
};

const TONE_TEXT: Record<HungerTone, string> = {
  full: "ventre bien rempli",
  low: "ventre qui se vide",
  empty: "ventre presque vide",
};

/** Jauge du ventre : vert → orange → rouge, avec un petit biberon. */
export function HungerGauge({ percent, name, className }: { percent: number; name: string; className?: string }) {
  const reduce = useReducedMotion();
  const tone = hungerTone(percent);
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold leading-none">
        <span className="flex items-center gap-1 text-muted-foreground">
          <BabyBottle level={value / 100} size={14} milk={tone === "full" ? "#6BD62C" : tone === "low" ? "#F5A524" : "#E5484D"} />
          Ventre
        </span>
        <span className="tabular-nums text-foreground">{value} %</span>
      </div>
      <div
        role="progressbar"
        aria-label={`Ventre ${elide("de", name)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value} %, ${TONE_TEXT[tone]}`}
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: TONE_FILL[tone] }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${Math.max(value, 3)}%` }}
          transition={{ duration: reduce ? 0 : 0.7, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
