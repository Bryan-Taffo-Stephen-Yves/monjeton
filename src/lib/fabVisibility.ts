import { useEffect, useSyncExternalStore } from "react";

/**
 * Permet à un écran de masquer le bouton flottant « + » de la LimelightNav
 * tant qu'il est affiché (ex. : un parcours dont le bouton principal est
 * collé en bas, que le « + » recouvrirait).
 */
let hiders = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useFabHidden(): boolean {
  return useSyncExternalStore(subscribe, () => hiders > 0, () => false);
}

export function useHideFab(active = true) {
  useEffect(() => {
    if (!active) return;
    hiders++;
    emit();
    return () => {
      hiders--;
      emit();
    };
  }, [active]);
}
