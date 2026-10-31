import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BABY_STATUS_QUERY_ROOT,
  BABY_STATUS_STALE_TIME,
  ageFromFedDays,
  babyStatusQueryKey,
  growthFloorStorageKey,
  toBabyStatus,
  withGrowthFloor,
  type BabyStatus,
} from "@/lib/baby";
import { preloadBabyImage } from "@/lib/babyImages";

const readFloor = (key: string): number | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
};

const writeFloor = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* stockage indisponible : le serveur reste la référence */
  }
};

/** État du bébé de l'utilisateur connecté, ou null s'il n'en a pas encore. */
export async function fetchBabyStatus(userId: string): Promise<BabyStatus | null> {
  const { data, error } = await supabase.rpc("get_baby_status");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  const raw = toBabyStatus(row);
  // La croissance ne recule jamais, même si des transactions sont supprimées.
  const key = growthFloorStorageKey(userId, raw.bornAt);
  const status = withGrowthFloor(raw, readFloor(key));
  if (status.fedDays !== readFloor(key)) writeFloor(key, status.fedDays);
  // L'image « content » sert à la célébration du prochain repas.
  preloadBabyImage(status.variant, ageFromFedDays(status.fedDays), "happy");
  return status;
}

export const babyStatusQueryOptions = (userId: string) => ({
  queryKey: babyStatusQueryKey(userId),
  queryFn: () => fetchBabyStatus(userId),
  staleTime: BABY_STATUS_STALE_TIME,
  gcTime: 30 * 60_000,
  retry: 1,
});

/**
 * Au retour sur le tableau de bord, on relit le serveur dès que l'état a
 * plus de quelques secondes : un repas noté ailleurs (scan, assistant,
 * import Wave, autre appareil) se voit tout de suite, sans attendre la
 * minute de BABY_STATUS_STALE_TIME. Juste après une saisie (l'état vient
 * d'être relu par la célébration), pas de second appel.
 */
const REMOUNT_FRESH_MS = 5_000;

export function useBabyStatus() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useQuery({
    ...babyStatusQueryOptions(userId ?? ""),
    queryKey: babyStatusQueryKey(userId),
    enabled: !!userId,
    refetchOnMount: (query) => (Date.now() - query.state.dataUpdatedAt > REMOUNT_FRESH_MS ? "always" : false),
  });
}

/** Charge l'état du bébé en avance (sans abonnement ni rendu). */
export function prefetchBabyStatus(queryClient: QueryClient, userId: string) {
  return queryClient.prefetchQuery(babyStatusQueryOptions(userId));
}

/** Marque le bébé comme périmé : les écrans abonnés le rechargent. */
export function invalidateBabyStatus(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: BABY_STATUS_QUERY_ROOT });
}

/** Met à jour le cache tout de suite (réglages, adoption), sans attendre la RPC. */
export function patchBabyStatus(
  queryClient: QueryClient,
  userId: string,
  patch: Partial<BabyStatus> | BabyStatus | null,
) {
  queryClient.setQueryData<BabyStatus | null>(babyStatusQueryKey(userId), (prev) => {
    if (patch === null) return null;
    if (!prev) return "name" in patch && "bornAt" in patch ? (patch as BabyStatus) : prev;
    return { ...prev, ...patch };
  });
}
