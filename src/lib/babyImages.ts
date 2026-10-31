import { useEffect, useState } from "react";
import { BABY_AGES, BABY_MOODS, type BabyAge, type BabyMood, type BabyVariant } from "@/lib/baby";

/**
 * Images du bébé : src/assets/baby/{variant}-{age}-{mood}.webp (512 × 512,
 * fond transparent). Chargées à la demande : seule l'URL de l'image voulue
 * est importée, jamais les 32. Si un fichier manque, on se rabat sur la même
 * tranche d'âge (autre humeur), puis sur un autre âge, puis sur un
 * emplacement doux dessiné en CSS (src = null).
 */

type UrlLoader = () => Promise<string>;

const LOADERS = import.meta.glob<string>("/src/assets/baby/*.webp", {
  query: "?url",
  import: "default",
});

export const babyImagePath = (variant: BabyVariant, age: BabyAge, mood: BabyMood) =>
  `/src/assets/baby/${variant}-${age}-${mood}.webp`;

const byDistance = <T,>(list: readonly T[], from: T) => {
  const i = list.indexOf(from);
  return [...list].sort((a, b) => Math.abs(list.indexOf(a) - i) - Math.abs(list.indexOf(b) - i) || list.indexOf(a) - list.indexOf(b));
};

/**
 * Ordre de recherche : l'image exacte, puis la même tranche d'âge avec
 * l'humeur la plus proche, puis la même humeur à l'âge le plus proche.
 */
export function babyImageCandidates(variant: BabyVariant, age: BabyAge, mood: BabyMood): string[] {
  const out: string[] = [];
  for (const m of byDistance(BABY_MOODS, mood)) out.push(babyImagePath(variant, age, m));
  for (const a of byDistance(BABY_AGES, age)) {
    if (a !== age) out.push(babyImagePath(variant, a, mood));
  }
  return out;
}

/** Premier fichier disponible parmi les candidats, ou null. */
export function pickBabyImage(candidates: string[], available: Record<string, unknown>): string | null {
  return candidates.find((path) => path in available) ?? null;
}

const requestKey = (variant: BabyVariant, age: BabyAge, mood: BabyMood) => `${variant}-${age}-${mood}`;
const resolved = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

/** URL déjà connue (synchrone) : string, null si aucun fichier, undefined si pas encore chargée. */
export function peekBabyImage(variant: BabyVariant, age: BabyAge, mood: BabyMood): string | null | undefined {
  return resolved.get(requestKey(variant, age, mood));
}

/** URL de l'image (ou de son remplaçant), null s'il n'y a aucun fichier. */
export function loadBabyImage(variant: BabyVariant, age: BabyAge, mood: BabyMood): Promise<string | null> {
  const key = requestKey(variant, age, mood);
  if (resolved.has(key)) return Promise.resolve(resolved.get(key) ?? null);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const path = pickBabyImage(babyImageCandidates(variant, age, mood), LOADERS);
  const loader: UrlLoader | undefined = path ? LOADERS[path] : undefined;
  const promise = (loader ? loader() : Promise.resolve(null))
    .catch(() => null)
    .then((url) => {
      resolved.set(key, url ?? null);
      pending.delete(key);
      return url ?? null;
    });
  pending.set(key, promise);
  return promise;
}

/** Télécharge l'image en avance (ex. : l'image « content » avant un repas). */
export function preloadBabyImage(variant: BabyVariant, age: BabyAge, mood: BabyMood): void {
  if (typeof window === "undefined") return;
  loadBabyImage(variant, age, mood)
    .then((url) => {
      if (!url) return;
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    })
    .catch(() => {});
}

/**
 * Hook : { src, ready }. `ready` passe à true une fois la recherche terminée,
 * même si aucun fichier n'existe (src = null → emplacement de remplacement).
 */
export function useBabyImage(variant: BabyVariant, age: BabyAge, mood: BabyMood): { src: string | null; ready: boolean } {
  const known = peekBabyImage(variant, age, mood);
  const [state, setState] = useState<{ key: string; src: string | null } | null>(
    known === undefined ? null : { key: requestKey(variant, age, mood), src: known },
  );
  const key = requestKey(variant, age, mood);

  useEffect(() => {
    let alive = true;
    const cached = peekBabyImage(variant, age, mood);
    if (cached !== undefined) {
      setState({ key, src: cached });
      return;
    }
    loadBabyImage(variant, age, mood).then((src) => {
      if (alive) setState({ key, src });
    });
    return () => {
      alive = false;
    };
  }, [key, variant, age, mood]);

  // Pendant le passage d'une humeur à l'autre, on garde l'ancienne image
  // affichée plutôt qu'un trou : aucun clignotement.
  if (known !== undefined) return { src: known, ready: true };
  if (state) return { src: state.src, ready: state.key === key };
  return { src: null, ready: false };
}
