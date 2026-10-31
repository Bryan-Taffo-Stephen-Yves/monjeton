import { Crown, Infinity as InfinityIcon, Camera, Mic, MessageCircle, Sparkles } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { openJekoMax, openJekoPro } from "@/lib/jeko";
import { isStoreApp } from "@/lib/platform";

/**
 * Fenêtre affichée quand une limite du mois est atteinte : c'est le moment
 * où la valeur du plan supérieur est la plus évidente. Pour un compte Pro qui
 * atteint ses 30 scans ou dictées, on propose Ultra Pro.
 */

const PRO_PERKS = [
  { Icon: InfinityIcon, text: "Dépenses illimitées" },
  { Icon: Camera, text: "30 scans de reçus par mois" },
  { Icon: Mic, text: "30 saisies vocales par mois" },
  { Icon: MessageCircle, text: "Assistant IA sans limite" },
];

const ULTRA_PERKS = [
  { Icon: InfinityIcon, text: "Tout le plan Pro" },
  { Icon: Camera, text: "Scans de reçus illimités" },
  { Icon: Mic, text: "Saisies vocales illimitées" },
  { Icon: Sparkles, text: "Nouveautés en avant-première" },
];

export function UpgradeSheet({
  open,
  onOpenChange,
  title,
  description,
  currentPlan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Plan qui a bloqué : « pro » propose Ultra Pro, sinon Pro. */
  currentPlan?: string;
}) {
  const toUltra = currentPlan === "pro";
  const perks = toUltra ? ULTRA_PERKS : PRO_PERKS;
  const price = toUltra ? 5000 : 2000;
  const planLabel = toUltra ? "Ultra Pro" : "Pro";
  // Dans l'app installée (App Store, Google Play), aucun paiement externe.
  const canPay = !isStoreApp();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border">
        <div className="mx-auto w-full max-w-md px-5 pb-6">
          <DrawerHeader className="px-0 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center neon-glow">
              <Crown className="w-8 h-8 text-primary-foreground" />
            </div>
            <DrawerTitle className="text-xl font-extrabold mt-4">{title}</DrawerTitle>
            <DrawerDescription className="text-sm leading-relaxed">{description}</DrawerDescription>
          </DrawerHeader>

          <div className="rounded-2xl border border-primary/25 p-4 mt-1" style={{ background: "linear-gradient(150deg, hsl(var(--primary) / 0.12), hsl(var(--card)) 70%)" }}>
            <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-primary">Avec {planLabel}</p>
            <ul className="mt-3 space-y-2.5">
              {perks.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm font-semibold">
                  <span className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
            {canPay && (
              <p className="mt-4 text-sm text-muted-foreground">
                <span className="text-2xl font-extrabold text-foreground tabular-nums">{price.toLocaleString("fr-FR")} F</span> / mois
                <span className="block text-xs mt-0.5">
                  soit moins de {Math.ceil(price / 30)} F par jour
                </span>
              </p>
            )}
          </div>

          {canPay && (
            <Button
              className="w-full h-12 mt-5 gradient-primary text-primary-foreground font-bold text-base"
              onClick={() => {
                onOpenChange(false);
                (toUltra ? openJekoMax : openJekoPro)();
              }}
            >
              <Crown className="w-4 h-4 mr-2" /> Passer à {planLabel}
            </Button>
          )}
          <Button variant="ghost" className="w-full h-11 mt-2 text-muted-foreground" onClick={() => onOpenChange(false)}>
            Plus tard
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default UpgradeSheet;
