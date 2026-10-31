import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls, useInView, useReducedMotion } from "framer-motion";
import { Baby, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBabyImage } from "@/lib/babyImages";
import type { BabyAge, BabyMood, BabyVariant } from "@/lib/baby";

/**
 * Le bébé animé, dans une boîte carrée de taille fixe (aucun saut de mise en
 * page pendant le chargement de l'image).
 *
 *   • respiration douce en continu ;
 *   • content : petits rebonds et cœurs ;
 *   • petit creux : il se balance ;
 *   • faim / très faim : le ventre gargouille (secousse légère + ondes).
 *     Le biberon vide et les petites larmes sont dans les images.
 *
 * Toutes les boucles s'arrêtent hors écran et avec « réduire les animations ».
 */

/** Hauteur du ventre (en % de l'image) selon l'âge : assis → debout. */
const BELLY_Y: Record<BabyAge, number> = { newborn: 80, baby: 78, toddler: 70, kid: 65 };
/** Haut de la tête, pour les cœurs. */
const HEAD_TOP_Y: Record<BabyAge, number> = { newborn: 24, baby: 18, toddler: 12, kid: 8 };

const BREATH = { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const };

/** Hauteur du rebond, proportionnelle à la boîte (7 px max, 3,5 px pour une vignette de 56). */
const hop = (size: number, ratio: number, max: number) => -Math.min(max, size * ratio);

function moodAction(mood: BabyMood, size: number) {
  switch (mood) {
    case "happy":
      return {
        animate: { y: [0, hop(size, 0.0625, 7), 0, hop(size, 0.027, 3), 0], scaleY: [1, 1.03, 0.97, 1.01, 1] },
        transition: { duration: 1.1, repeat: Infinity, repeatDelay: 2.8, ease: "easeOut" as const },
      };
    case "peckish":
      return {
        animate: { rotate: [0, -2.5, 2.5, -1.5, 0] },
        transition: { duration: 1.8, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" as const },
      };
    case "hungry":
    case "starving":
      return {
        animate: { x: [0, -2, 2, -1.5, 1.5, -1, 0] },
        transition: { duration: 0.6, repeat: Infinity, repeatDelay: mood === "starving" ? 2 : 3, ease: "easeInOut" as const },
      };
  }
}

export interface BabyAvatarProps {
  variant: BabyVariant;
  age: BabyAge;
  mood: BabyMood;
  /** Côté de la boîte, en px. */
  size: number;
  alt: string;
  /** false : image figée (aperçus de choix, listes). */
  animated?: boolean;
  /** Indices visuels autour du bébé (cœurs, biberon, gargouillis, larme). */
  cues?: boolean;
  /** Incrémenté à chaque toucher : petit « boing ». */
  pokeKey?: number;
  /** Bulle temporaire (réaction au toucher). */
  speech?: string | null;
  priority?: boolean;
  className?: string;
}

export function BabyAvatar({
  variant,
  age,
  mood,
  size,
  alt,
  animated = true,
  cues = true,
  pokeKey = 0,
  speech = null,
  priority = false,
  className,
}: BabyAvatarProps) {
  const { src, ready } = useBabyImage(variant, age, mood);
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { margin: "80px" });
  const live = animated && !reduce && inView;
  const [shown, setShown] = useState(false);
  const poke = useAnimationControls();

  useEffect(() => {
    if (!pokeKey || reduce) return;
    poke.start({
      scaleY: [1, 0.86, 1.08, 0.97, 1],
      scaleX: [1, 1.1, 0.95, 1.02, 1],
      transition: { duration: 0.55, ease: "easeOut" },
    });
  }, [pokeKey, poke, reduce]);

  const action = moodAction(mood, size);
  const hungry = mood === "hungry" || mood === "starving";

  return (
    <div
      ref={box}
      className={cn("relative shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      {/* Ombre au sol pour l'emplacement de remplacement (les images ont la leur). */}
      {!src && (
        <motion.span
          aria-hidden="true"
          className="absolute left-[28%] w-[44%] rounded-[50%]"
          style={{
            bottom: "5%",
            height: "6%",
            background: "radial-gradient(closest-side, rgba(0,0,0,0.30), rgba(0,0,0,0))",
          }}
          animate={live ? { scaleX: [1, 0.93, 1] } : { scaleX: 1 }}
          transition={live ? BREATH : { duration: 0 }}
        />
      )}

      {/* Respiration */}
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: "50% 92%" }}
        animate={live ? { scaleY: [1, 1.018, 1], scaleX: [1, 0.996, 1] } : { scaleY: 1, scaleX: 1 }}
        transition={live ? { ...BREATH, duration: mood === "starving" ? 4.2 : 3.2 } : { duration: 0 }}
      >
        {/* Geste d'humeur (rebond, balancement, gargouillis) */}
        <motion.div
          key={mood}
          className="absolute inset-0"
          style={{ transformOrigin: "50% 92%" }}
          animate={live ? action.animate : { x: 0, y: 0, rotate: 0, scaleY: 1 }}
          transition={live ? action.transition : { duration: 0 }}
        >
          {/* Réaction au toucher */}
          <motion.div className="absolute inset-0" style={{ transformOrigin: "50% 92%" }} animate={poke}>
            {src ? (
              <img
                src={src}
                alt={alt}
                width={size}
                height={size}
                draggable={false}
                decoding="async"
                loading={priority ? "eager" : "lazy"}
                onLoad={() => setShown(true)}
                className="block h-full w-full object-contain transition-opacity duration-300"
                style={{ opacity: shown ? 1 : 0 }}
              />
            ) : ready ? (
              <BabyPlaceholder label={alt} />
            ) : null}
          </motion.div>
        </motion.div>
      </motion.div>

      {cues && mood === "happy" && live && <FloatingHearts top={HEAD_TOP_Y[age]} />}
      {cues && hungry && <BellyRumble y={BELLY_Y[age]} live={live} repeatDelay={mood === "starving" ? 2 : 3} />}

      <AnimatePresence>
        {speech && (
          <motion.span
            key={speech}
            aria-hidden="true"
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-foreground shadow-md"
          >
            {speech}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Emplacement doux si l'image n'existe pas (encore). */
function BabyPlaceholder({ label }: { label: string }) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className="absolute inset-0 flex items-end justify-center pb-[8%]"
    >
      <div
        className="flex aspect-square w-[62%] items-center justify-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, hsl(var(--primary) / 0.35), hsl(var(--primary) / 0.12) 60%, hsl(var(--primary) / 0.05))",
          boxShadow: "inset 0 -6px 14px hsl(var(--primary) / 0.12)",
        }}
      >
        <Baby className="h-1/2 w-1/2 text-primary" strokeWidth={1.6} aria-hidden="true" />
      </div>
    </div>
  );
}

function FloatingHearts({ top }: { top: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ left: i ? "74%" : "18%", top: `${Math.max(2, top)}%` }}
          initial={{ opacity: 0, y: 6, scale: 0.6 }}
          animate={{ opacity: [0, 1, 0], y: [6, -10, -18], scale: [0.6, 1, 0.9] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.6, delay: i * 0.9, ease: "easeOut" }}
        >
          <Heart className="h-3 w-3 fill-current text-[#ff6b8b]" strokeWidth={0} />
        </motion.span>
      ))}
    </span>
  );
}

/** Petites ondes « grr » de chaque côté du ventre. */
function BellyRumble({ y, live, repeatDelay }: { y: number; live: boolean; repeatDelay: number }) {
  const arc = (side: "left" | "right") => (
    <motion.svg
      key={side}
      viewBox="0 0 12 20"
      className="absolute h-[14%] w-[7%] text-amber-500"
      style={side === "left" ? { top: `${y - 7}%`, left: "9%" } : { top: `${y - 7}%`, right: "9%" }}
      initial={false}
      animate={live ? { opacity: [0, 1, 1, 0], x: side === "left" ? [2, -2, -2, -4] : [-2, 2, 2, 4] } : { opacity: 0.85, x: 0 }}
      transition={live ? { duration: 0.9, repeat: Infinity, repeatDelay, ease: "easeOut" } : { duration: 0 }}
      aria-hidden="true"
    >
      {side === "left" ? (
        <path d="M9 2C4 6 4 14 9 18M5 5C2 8 2 12 5 15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M3 2C8 6 8 14 3 18M7 5C10 8 10 12 7 15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
    </motion.svg>
  );
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {arc("left")}
      {arc("right")}
    </span>
  );
}
