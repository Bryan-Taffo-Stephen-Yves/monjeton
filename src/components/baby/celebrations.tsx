import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
  BABY_STATUS_QUERY_ROOT,
  ageFromFedDays,
  agree,
  babyStatusQueryKey,
  fedMessage,
  growthMessage,
  grewUp,
  levelUpMessage,
  nextAge,
  type BabyAge,
  type BabyStatus,
  type BabyVariant,
} from "@/lib/baby";
import { BabyToast } from "./BabyToast";
import { babyStatusQueryOptions } from "./useBabyStatus";

/**
 * Célébrations du bébé : repas (après chaque transaction enregistrée),
 * passage à l'âge suivant (confettis) et adoption.
 * Les toasts ne bloquent jamais la navigation.
 */

const CONFETTI_COLORS = ["#7cff3a", "#6BD62C", "#3FAE0C", "#F7C04A", "#ffffff"];

async function fireConfetti(strong = false) {
  try {
    const { default: confetti } = await import("canvas-confetti");
    const base = { colors: CONFETTI_COLORS, disableForReducedMotion: true, zIndex: 9999 };
    confetti({ ...base, particleCount: strong ? 110 : 70, spread: 75, startVelocity: 38, origin: { x: 0.5, y: 0.25 } });
    if (strong) {
      window.setTimeout(() => {
        confetti({ ...base, particleCount: 45, angle: 60, spread: 60, origin: { x: 0, y: 0.5 } });
        confetti({ ...base, particleCount: 45, angle: 120, spread: 60, origin: { x: 1, y: 0.5 } });
      }, 220);
    }
  } catch {
    /* confettis indisponibles : la célébration reste le toast */
  }
}

const TOAST_OPTIONS = {
  position: "top-center" as const,
  // Le style du Toaster global (fond, ombre) est pour les toasts texte.
  className: "!bg-transparent !shadow-none !border-0 !p-0",
};

function showBabyToast(
  id: string,
  content: { variant: BabyVariant; age: BabyAge; title: string; subtitle?: string },
  duration: number,
) {
  toast.custom(() => <BabyToast {...content} />, { ...TOAST_OPTIONS, id, duration });
}

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | undefined> =>
  new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(undefined), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(undefined);
      },
    );
  });

/**
 * À appeler juste AVANT d'enregistrer : mémorise l'état du bébé pour
 * détecter ensuite un passage d'âge. Ne rejette jamais.
 */
export function snapshotBabyBeforeSave(queryClient: QueryClient, userId: string): Promise<BabyStatus | null | undefined> {
  const cached = queryClient.getQueryData<BabyStatus | null>(babyStatusQueryKey(userId));
  if (cached !== undefined) return Promise.resolve(cached);
  return queryClient.ensureQueryData(babyStatusQueryOptions(userId)).catch(() => undefined);
}

/**
 * Après un enregistrement réussi (une fois par enregistrement, même pour
 * plusieurs transactions dictées) : rafraîchit le bébé, affiche « X s'est
 * régalé(e) » avec son image, et des confettis s'il change d'âge.
 *
 * Renvoie true si la célébration a remplacé le toast « Transaction
 * enregistrée » (le texte est repris en sous-titre), false sinon (pas de
 * bébé, ou état inconnu) : l'appelant affiche alors son toast habituel.
 */
export async function celebrateBabyFeeding({
  queryClient,
  userId,
  before,
  savedLabel,
}: {
  queryClient: QueryClient;
  userId: string;
  before: Promise<BabyStatus | null | undefined>;
  savedLabel: string;
}): Promise<boolean> {
  const previous = await withTimeout(before, 1200);

  // Le repas compte côté serveur : on marque l'état périmé puis on le relit,
  // même si plus aucun écran n'est abonné (on a déjà quitté la saisie).
  await queryClient.invalidateQueries({ queryKey: BABY_STATUS_QUERY_ROOT, refetchType: "none" }).catch(() => {});
  const after = queryClient.fetchQuery(babyStatusQueryOptions(userId)).catch(() => undefined);

  if (!previous) return false;

  const id = `baby-fed-${Date.now()}`;
  const age = ageFromFedDays(previous.fedDays);
  showBabyToast(
    id,
    { variant: previous.variant, age, title: fedMessage(previous.name, previous.variant), subtitle: savedLabel },
    3200,
  );

  void after.then((next) => {
    if (!next) return;
    const grown = grewUp(previous.fedDays, next.fedDays);
    if (!grown) return;
    // Même toast, nouveau contenu : un seul message à l'écran.
    showBabyToast(
      id,
      {
        variant: next.variant,
        age: grown,
        title: levelUpMessage(next.name, next.variant, grown),
        // Dernier âge : le titre dit déjà « grand bébé », pas de doublon.
        subtitle: nextAge(next.fedDays, next.variant)
          ? growthMessage(next.name, next.variant, next.fedDays)
          : `Continue de ${agree(next.variant, "le", "la")} nourrir chaque jour 💚`,
      },
      5200,
    );
    void fireConfetti(true);
  });

  return true;
}

/** Bienvenue au nouveau bébé. */
export function celebrateAdoption(name: string, variant: BabyVariant) {
  showBabyToast(
    `baby-adopted-${Date.now()}`,
    {
      variant,
      age: "newborn",
      title: `Bienvenue ${name} ! 💚`,
      subtitle: `Note une dépense chaque jour pour ${agree(variant, "le", "la")} faire grandir.`,
    },
    4200,
  );
  void fireConfetti(false);
}
