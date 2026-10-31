import type { BabyAge, BabyVariant } from "@/lib/baby";
import { BabyAvatar } from "./BabyAvatar";

/**
 * Agrandissement de la vignette (56 px), par âge. Les images ne sont pas
 * cadrées pareil : le haut de la tête est vers 19 % (nouveau-né), 14 %
 * (bébé), 9 % (petit marcheur) et 5 % (grand bébé, couettes de la fille).
 * Chaque valeur garde toute la tête dans la vignette, même au sommet du
 * petit rebond (3,5 px) et de la respiration : environ 3 % de marge.
 * Résultat : le bébé occupe à peu près 80 % de la hauteur à tous les âges.
 */
const THUMB_SCALE: Record<BabyAge, number> = { newborn: 1.06, baby: 1, toddler: 0.95, kid: 0.91 };

/** Contenu des toasts du bébé : son image (content) et un message court. */
export function BabyToast({
  variant,
  age,
  title,
  subtitle,
}: {
  variant: BabyVariant;
  age: BabyAge;
  title: string;
  subtitle?: string;
}) {
  return (
    // Marge haute = encoche de l'iPhone (PWA plein écran).
    <div className="w-full" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2.5 pr-4 text-card-foreground shadow-xl">
        <span
          className="relative flex h-14 w-14 shrink-0 items-end justify-center overflow-hidden rounded-xl"
          style={{ background: "radial-gradient(circle at 50% 65%, hsl(var(--primary) / 0.3), hsl(var(--primary) / 0.08) 70%)" }}
        >
          <span className="block" style={{ transform: `scale(${THUMB_SCALE[age]})`, transformOrigin: "50% 100%" }}>
            <BabyAvatar variant={variant} age={age} mood="happy" size={56} alt="" cues={false} priority />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold leading-snug text-foreground">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
