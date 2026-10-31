import { Component, lazy, Suspense, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { QueryClientContext } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Settings2, Sprout, Sparkles, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  describeBaby,
  elide,
  growthMessage,
  pokeBubble,
  shortBabyName,
  type BabyMood,
  type BabyStatus,
} from "@/lib/baby";
import { BabyAvatar } from "./BabyAvatar";
import { BabyBottle } from "./BabyBottle";
import { HungerGauge } from "./HungerGauge";
import { useBabyStatus } from "./useBabyStatus";

const AdoptBabySheet = lazy(() => import("./AdoptBabySheet"));
const BabyDetailsSheet = lazy(() => import("./BabyDetailsSheet"));

/** Taille de l'image dans la carte : réservée dès le premier rendu. */
const AVATAR = 112;

const CARD_BG: Record<BabyMood, string> = {
  happy: "linear-gradient(150deg, hsl(var(--primary) / 0.13) 0%, hsl(var(--card)) 58%)",
  peckish: "linear-gradient(150deg, hsl(var(--primary) / 0.09) 0%, hsl(var(--card)) 58%)",
  hungry: "linear-gradient(150deg, rgba(245, 165, 36, 0.16) 0%, hsl(var(--card)) 60%)",
  starving: "linear-gradient(150deg, rgba(245, 140, 36, 0.22) 0%, hsl(var(--card)) 64%)",
};

const STAGE_BG: Record<BabyMood, string> = {
  happy: "radial-gradient(circle at 50% 62%, hsl(var(--primary) / 0.26), hsl(var(--primary) / 0.06) 58%, transparent 72%)",
  peckish: "radial-gradient(circle at 50% 62%, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.04) 58%, transparent 72%)",
  hungry: "radial-gradient(circle at 50% 62%, rgba(245, 165, 36, 0.24), rgba(245, 165, 36, 0.05) 58%, transparent 72%)",
  starving: "radial-gradient(circle at 50% 62%, rgba(245, 140, 36, 0.28), rgba(245, 140, 36, 0.06) 58%, transparent 72%)",
};

const cardClass = "baby-card glass-card relative mb-4 overflow-hidden rounded-[22px] p-3.5";

/** Re-dessine à minuit : la faim avance même si l'écran reste ouvert. */
function useToday(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const next = new Date(now);
    next.setHours(24, 0, 1, 0);
    const timer = window.setTimeout(() => setNow(new Date()), Math.max(1000, next.getTime() - now.getTime()));
    const onVisible = () => {
      if (document.visibilityState === "visible" && new Date().toDateString() !== now.toDateString()) setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [now]);
  return now;
}

// ─── Vues (sans données : réutilisables et testables) ─────────

export interface BabyCardViewProps {
  status: BabyStatus;
  now?: Date;
  onFeed: () => void;
  onOpenDetails: () => void;
  className?: string;
}

/** Carte du bébé sur l'accueil. */
export function BabyCardView({ status, now, onFeed, onOpenDetails, className }: BabyCardViewProps) {
  const view = describeBaby(status, now);
  const [poke, setPoke] = useState(0);
  const [speech, setSpeech] = useState<string | null>(null);
  const speechTimer = useRef<number>();
  const reduce = useReducedMotion();
  const titleId = useId();

  useEffect(() => () => window.clearTimeout(speechTimer.current), []);

  const onPoke = () => {
    const n = poke + 1;
    setPoke(n);
    setSpeech(pokeBubble(view.mood, n));
    window.clearTimeout(speechTimer.current);
    speechTimer.current = window.setTimeout(() => setSpeech(null), 1600);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* vibration indisponible */
    }
  };

  const hungry = view.mood === "hungry" || view.mood === "starving";

  return (
    <section
      aria-labelledby={titleId}
      data-mood={view.mood}
      className={cn(cardClass, className)}
      style={{ background: CARD_BG[view.mood] }}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPoke}
          aria-label={`Faire un câlin à ${status.name}`}
          className="relative -my-1 -ml-1 shrink-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ width: AVATAR + 8, height: AVATAR + 8 }}
        >
          <span aria-hidden="true" className="absolute inset-0 rounded-[18px]" style={{ background: STAGE_BG[view.mood] }} />
          <BabyAvatar
            variant={status.variant}
            age={view.age}
            mood={view.mood}
            size={AVATAR}
            alt={`${status.name}, ${view.ageLabel.toLowerCase()}`}
            pokeKey={poke}
            speech={speech}
            priority
            className="m-1"
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
              <h2 id={titleId} className="min-w-0 max-w-full truncate text-[17px] font-extrabold leading-tight text-foreground">
                {status.name}
              </h2>
              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-primary">
                {view.ageLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenDetails}
              aria-label={`Réglages ${elide("de", status.name)}`}
              className="-mr-2.5 -mt-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Settings2 className="h-[18px] w-[18px]" />
            </button>
          </div>

          <p className="mt-0.5 line-clamp-3 text-[12.5px] leading-snug text-muted-foreground">
            {view.message}
          </p>

          <HungerGauge percent={view.hunger} name={status.name} className="mt-2.5" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-start gap-1 text-[11px] font-semibold leading-tight text-muted-foreground">
            <Sprout className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="line-clamp-2 min-w-0">{growthMessage(status.name, status.variant, status.fedDays)}</span>
          </p>
          <div
            role="progressbar"
            aria-label={view.next ? `Croissance vers ${view.next.label.toLowerCase()}` : "Croissance terminée"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(view.progress * 100)}
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(4, view.progress * 100)}%` }} />
          </div>
        </div>
        <motion.button
          type="button"
          onClick={onFeed}
          whileTap={reduce ? undefined : { scale: 0.96 }}
          animate={hungry && !reduce ? { scale: [1, 1.035, 1] } : { scale: 1 }}
          transition={hungry && !reduce ? { duration: 1.6, repeat: Infinity, repeatDelay: 1.2 } : { duration: 0.2 }}
          className="bg-primary inline-flex h-11 max-w-[58%] shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-extrabold text-primary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <BabyBottle level={0.6} size={16} milk="currentColor" className="shrink-0" />
          <span className="truncate">Nourrir {shortBabyName(status.name)}</span>
        </motion.button>
      </div>
    </section>
  );
}

/** Invitation à adopter, quand l'utilisateur n'a pas encore de bébé. */
export function AdoptTeaserView({ onAdopt, className }: { onAdopt: () => void; className?: string }) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(cardClass, className)}
      style={{ background: CARD_BG.happy }}
    >
      <div className="flex gap-3">
        <div
          className="relative -my-1 -ml-1 shrink-0 rounded-[18px]"
          style={{ width: AVATAR + 8, height: AVATAR + 8, background: STAGE_BG.happy }}
        >
          <BabyAvatar
            variant="girl"
            age="newborn"
            mood="happy"
            size={AVATAR - 18}
            alt=""
            cues={false}
            className="absolute bottom-1 left-0"
          />
          <BabyAvatar
            variant="boy"
            age="newborn"
            mood="happy"
            size={AVATAR - 18}
            alt=""
            cues={false}
            className="absolute bottom-1 right-0"
          />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-primary">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Nouveau
          </span>
          <h2 id={titleId} className="mt-1.5 text-[17px] font-extrabold leading-tight text-foreground">
            Adopte ton bébé Jeton
          </h2>
          <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
            Il grandit chaque jour où tu notes tes dépenses. Si tu l'oublies, il a faim 🍼
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAdopt}
        className="bg-primary mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold text-primary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] transition-transform"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Adopter mon bébé
      </button>
    </section>
  );
}

/** Même encombrement que la carte : rien ne saute au chargement. */
export function BabyCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn(cardClass, "animate-pulse", className)}>
      <div className="flex gap-3">
        <div className="-my-1 -ml-1 shrink-0 rounded-[18px] bg-muted/60" style={{ width: AVATAR + 8, height: AVATAR + 8 }} />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-24 rounded bg-muted/70" />
          <div className="h-3 w-full rounded bg-muted/50" />
          <div className="h-3 w-3/4 rounded bg-muted/50" />
          <div className="mt-4 h-2 w-full rounded-full bg-muted/60" />
        </div>
      </div>
      <div className="mt-3 h-11 rounded-xl bg-muted/50" />
    </div>
  );
}

// ─── Conteneur (données + fenêtres) ───────────────────────────

/** Le bébé ne doit jamais casser l'accueil : en cas d'erreur, il s'efface. */
class BabyBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[BabyCard]", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function BabyCardContainer({ className }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isPending, isError } = useBabyStatus();
  const now = useToday();
  const [open, setOpen] = useState<"adopt" | "details" | null>(null);
  // Les fenêtres ne sont téléchargées qu'à la première ouverture.
  const [loaded, setLoaded] = useState({ adopt: false, details: false });

  const show = (which: "adopt" | "details") => {
    setLoaded((l) => ({ ...l, [which]: true }));
    setOpen(which);
  };
  const onOpenChange = (which: "adopt" | "details") => (value: boolean) => setOpen(value ? which : null);

  if (!user) return null;
  if (isPending) return <BabyCardSkeleton className={className} />;
  // RPC indisponible (migration pas encore appliquée, réseau) : on s'efface.
  if (isError) return null;

  return (
    <>
      {data ? (
        <BabyCardView
          status={data}
          now={now}
          onFeed={() => navigate("/transactions/new")}
          onOpenDetails={() => show("details")}
          className={className}
        />
      ) : (
        <AdoptTeaserView onAdopt={() => show("adopt")} className={className} />
      )}

      <Suspense fallback={null}>
        {/* Reste monté après l'adoption pour se refermer en douceur. */}
        {loaded.adopt && (
          <AdoptBabySheet open={open === "adopt" && !data} onOpenChange={onOpenChange("adopt")} userId={user.id} />
        )}
        {loaded.details && data && (
          <BabyDetailsSheet
            open={open === "details"}
            onOpenChange={onOpenChange("details")}
            userId={user.id}
            status={data}
            now={now}
          />
        )}
      </Suspense>
    </>
  );
}

/**
 * Carte « bébé Jeton » de l'accueil : le bébé, sa faim, sa croissance, et le
 * bouton pour le nourrir. Sans bébé : invitation à l'adopter.
 */
export default function BabyCard({ className }: { className?: string }) {
  // Sans QueryClient (tests isolés de l'accueil), la carte ne s'affiche pas.
  const client = useContext(QueryClientContext);
  if (!client) return null;
  return (
    <BabyBoundary>
      <BabyCardContainer className={className} />
    </BabyBoundary>
  );
}

