// Quotas mensuels par plan (gratuit, Pro, Ultra Pro).
//
// La source de vérité est la base de données : la fonction SQL consume_feature
// décompte un crédit et refuse au-delà de la limite, et des déclencheurs
// bloquent l'enregistrement du résultat même si l'app est contournée.
// Ici on ne fait qu'interroger cette source et traduire ses réponses en
// messages lisibles.

import { supabase } from "@/integrations/supabase/client";

export type FreeFeature =
  | "manual_expense"
  | "scan"
  | "chat"
  | "voice"
  | "budget_suggest"
  | "budget_plan"
  | "financial_score";

export interface FeatureQuota {
  allowed: boolean;
  unlimited: boolean;
  used: number;
  limit: number | null;
  resetsAt: string | null;
  /** Plan qui a fixé la limite : free | pro | ultra (absent sur l'ancienne base). */
  plan?: string;
}

const LABELS: Record<FreeFeature, string> = {
  manual_expense: "dépenses saisies à la main",
  scan: "scans de reçus",
  chat: "messages à l'assistant",
  voice: "dictées vocales",
  budget_suggest: "suggestions de budget",
  budget_plan: "plans de coaching",
  financial_score: "scores financiers",
};

export const featureLabel = (feature: FreeFeature) => LABELS[feature] ?? feature;

/**
 * Consomme un crédit mensuel pour l'utilisateur courant.
 *
 * En cas d'erreur réseau, on autorise l'action : mieux vaut offrir un scan de
 * trop que bloquer un client qui a payé. Le garde-fou en base reste actif.
 */
export async function consumeFeature(
  userId: string,
  feature: FreeFeature
): Promise<FeatureQuota> {
  const { data, error } = await supabase.rpc("consume_feature", {
    _user_id: userId,
    _feature: feature,
  });

  if (error) {
    console.warn("[freePlan] consume_feature indisponible", error.message);
    return { allowed: true, unlimited: false, used: 0, limit: null, resetsAt: null };
  }

  const r = (data ?? {}) as Record<string, unknown>;
  return {
    allowed: r.allowed === true,
    unlimited: r.unlimited === true,
    used: Number(r.used ?? 0),
    limit: r.limit == null ? null : Number(r.limit),
    resetsAt: (r.resets_at as string) ?? null,
    plan: typeof r.plan === "string" ? r.plan : undefined,
  };
}

/** Compteurs du mois pour affichage (« il te reste 3 scans »). */
export async function fetchMonthlyUsage(userId: string) {
  const { data, error } = await supabase.rpc("monthly_usage", { _user_id: userId });
  if (error) {
    console.warn("[freePlan] monthly_usage indisponible", error.message);
    return null;
  }
  const rows = (data ?? []) as Array<{
    feature: string;
    used: number;
    free_limit: number | null;
    unlimited: boolean;
    resets_at: string;
  }>;
  return rows.reduce<Record<string, FeatureQuota>>((acc, row) => {
    acc[row.feature] = {
      allowed: row.unlimited || row.free_limit == null || row.used < row.free_limit,
      unlimited: row.unlimited,
      used: row.used,
      limit: row.free_limit,
      resetsAt: row.resets_at,
    };
    return acc;
  }, {});
}

/** Reconnaît le refus renvoyé par les déclencheurs de la base. */
export function isFreePlanLimitError(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : ((error as { message?: string })?.message ?? "");
  return message.includes("free_plan_limit_reached");
}

/**
 * Quota joint par la base à son refus (champ `details` de l'erreur), pour
 * afficher la bonne limite et le bon plan dans le message.
 */
export function quotaFromLimitError(error: unknown): FeatureQuota | undefined {
  const details = (error as { details?: string })?.details;
  if (!details) return undefined;
  try {
    const r = JSON.parse(details) as Record<string, unknown>;
    return {
      allowed: false,
      unlimited: false,
      used: Number(r.used ?? 0),
      limit: r.limit == null ? null : Number(r.limit),
      resetsAt: (r.resets_at as string) ?? null,
      plan: typeof r.plan === "string" ? r.plan : undefined,
    };
  } catch {
    return undefined;
  }
}

/** Date de remise à zéro, formatée en français (« 1 octobre »). */
export function formatResetDate(resetsAt: string | null): string {
  if (!resetsAt) return "le 1er du mois prochain";
  try {
    return new Date(resetsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  } catch {
    return "le 1er du mois prochain";
  }
}

/** Message à afficher quand la limite est atteinte. */
export function limitReachedMessage(feature: FreeFeature, quota?: FeatureQuota) {
  const reset = quota?.resetsAt
    ? `le ${formatResetDate(quota.resetsAt).replace(/^1 /, "1er ")}`
    : formatResetDate(null);
  if (quota?.plan === "pro") {
    return {
      title: "Limite du plan Pro atteinte",
      description: `Tu as utilisé tes ${quota.limit ?? ""} ${featureLabel(feature)} de ce mois. Le compteur repart ${reset} — ou passe à Ultra Pro pour continuer sans limite.`.replace(
        /\s+/g,
        " "
      ),
    };
  }
  return {
    title: "Limite du plan gratuit atteinte",
    description: `Tu as utilisé tes ${quota?.limit ?? ""} ${featureLabel(feature)} de ce mois. Le compteur repart ${reset} — ou passe au Pro pour continuer.`.replace(
      /\s+/g,
      " "
    ),
  };
}
