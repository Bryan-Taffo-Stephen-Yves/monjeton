import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-ajustement du budget d'une catégorie en fonction des dépenses réelles.
 * Règle : nouveau_budget = max(budget_actuel, dépensé_ce_mois × (jours_mois / jours_écoulés) × 1.10)
 * - On ne baisse JAMAIS un budget existant.
 * - Si le budget du mois a été défini (ligne dans `budgets`), on ne relève
 *   pas non plus les postes existants : on crée seulement ceux qui manquent.
 * - Si pas d'historique, fallback sur dépensé × 1.20.
 */
export async function syncAutoBudget(
  userId: string,
  categoryId: string,
  month: number,
  year: number
): Promise<{ created: boolean; updated: boolean; amount: number } | null> {
  if (!userId || !categoryId) return null;

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  // Dépensé sur cette catégorie ce mois
  const { data: txMonth } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .eq("category_id", categoryId)
    .gte("date", firstDay)
    .lt("date", lastDay);

  const spent = (txMonth || []).reduce(
    (s, t: any) => s + Number(t.amount || 0),
    0
  );

  if (spent <= 0) return null;

  // Budget existant
  const { data: existing } = await supabase
    .from("category_budgets")
    .select("id, budget_amount")
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  const currentBudget = Number(existing?.budget_amount || 0);

  // Si l'utilisateur a défini son budget du mois, ses montants sont des
  // plafonds : on ne les relève jamais, sinon un poste dépassé serait
  // « rattrapé » au lieu d'être signalé. On crée seulement les postes absents.
  if (existing) {
    const { data: monthBudget } = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", userId)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();
    if (monthBudget) {
      return { created: false, updated: false, amount: currentBudget };
    }
  }

  // Détermination de la cible
  const now = new Date();
  const isCurrentMonth =
    now.getMonth() + 1 === month && now.getFullYear() === year;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysElapsed = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;

  // Extrapolation rythme actuel
  const projected = (spent / daysElapsed) * daysInMonth;

  // Marge 10% sur projection, ou 20% si on n'a que peu de jours (early month)
  const safetyFactor = daysElapsed < 7 ? 1.2 : 1.1;
  const target = Math.max(spent, Math.ceil(projected * safetyFactor));

  // On ne baisse jamais
  const newAmount = Math.max(currentBudget, target);

  // Si pas de changement, on ne touche à rien
  if (existing && newAmount <= currentBudget) {
    return { created: false, updated: false, amount: currentBudget };
  }

  if (existing) {
    const { error } = await supabase
      .from("category_budgets")
      .update({ budget_amount: newAmount })
      .eq("id", existing.id);
    if (error) {
      console.error("syncAutoBudget update error:", error);
      return null;
    }
    return { created: false, updated: true, amount: newAmount };
  }

  const { error } = await supabase.from("category_budgets").insert({
    user_id: userId,
    category_id: categoryId,
    month,
    year,
    budget_amount: newAmount,
  });
  if (error) {
    console.error("syncAutoBudget insert error:", error);
    return null;
  }
  return { created: true, updated: false, amount: newAmount };
}

/**
 * Synchronise tous les budgets des catégories ayant eu des dépenses ce mois.
 * Appelé au mount de la page Budgets.
 */
export async function syncAllAutoBudgets(
  userId: string,
  month: number,
  year: number
): Promise<number> {
  if (!userId) return 0;

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data: tx } = await supabase
    .from("transactions")
    .select("category_id")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("date", firstDay)
    .lt("date", lastDay);

  const categoryIds = Array.from(
    new Set((tx || []).map((t: any) => t.category_id).filter(Boolean))
  );

  let touched = 0;
  for (const catId of categoryIds) {
    const r = await syncAutoBudget(userId, catId as string, month, year);
    if (r && (r.created || r.updated)) touched++;
  }
  return touched;
}
